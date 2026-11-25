#!/usr/bin/env python3
"""Import a technical manual capture into the site.

  .venv/bin/python scripts/import_manual.py CAPTURE --pdf "path/to/manual.pdf" --pdf-name NAME.pdf

CAPTURE is the capture-technical-manual output (the folder with manifest.json, pages/
and web/). Two layouts, picked from the printed page numbers:

  paragraphs   maintenance manuals (2-15. TITLE): one section per numbered paragraph or appendix
  parts        repair parts lists (RPSTL), whose folios are work packages ("0002 00-1"): one
               section per work package (illustration plate plus parts list, the special tools,
               the cross-reference indexes), titled from the contents list

Writes:

  data/manuals/<tm>.json          sections (paragraphs, appendices) as blocks, figures, tables
  public/manuals/<tm>/images/     figure WebP (and thumbs/), table crops in tables/
  public/manuals/<tm>/cover.webp  first PDF page (rendered with macOS sips)
  public/manuals/<tm>/<NAME>.pdf  the original PDF, renamed

Text stays exactly as the capture has it (typos included). The only repairs are to
headings the PDF text layer letter-spaced ("2 - 3 5 . 2 ." -> "2-35.2."), so the
section split works. Repairs for display happen at render time.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Words kept upper case when headings are turned into sentence case.
ACRONYMS = {"TMDE", "NSN", "SAE", "DDA", "EIR", "EIRS", "FTIS", "RPM", "TDC", "UNC", "UNF", "DB2", "PSI", "ID", "OD", "I", "II", "III", "IV", "V", "VI", "VII"}
PROPER = {"ARMY": "Army", "MARINE": "Marine", "CORPS": "Corps", "AIR": "Air", "FORCE": "Force"}


def sentence_case(s: str) -> str:
    words = []
    for w in s.split():
        core = re.sub(r"[^A-Za-z]", "", w)
        if core in PROPER:
            words.append(w.replace(core, PROPER[core]))
        elif not core or any(c.isdigit() for c in w) or core.upper() in ACRONYMS or core != core.upper():
            words.append(w)  # numbers, part numbers, acronyms, already mixed case
        else:
            words.append(w.lower())
    out = " ".join(words)
    return out[:1].upper() + out[1:]


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


CONT = re.compile(r"\s*[\(\[]\s*C[oe]nt.?d\s*\)", re.I)


def strip_cont(s: str) -> str:
    """Title before any "(Cont'd)" marker (text after it is body text on the page)."""
    return CONT.split(s, 1)[0].strip()


def split_title(s: str) -> tuple[str, str]:
    """'TABULATED DATA. Engine tabulated data is ...' -> ('TABULATED DATA', 'Engine tabulated data is ...').

    Also returns text that followed a "(Cont'd)" marker as the remainder."""
    parts = CONT.split(s, 1)
    head, rest = parts[0].strip(), (parts[1].strip() if len(parts) > 1 else "")
    m = re.match(r"^(.*?[A-Z0-9)\]])\.?\s+([A-Z][a-z].*)$", head)
    if m and m.group(1) == m.group(1).upper():
        head, rest = m.group(1), (m.group(2) + " " + rest).strip()
    return head, rest


def join_spaced(s: str) -> str:
    """Rejoin words the text layer letter-spaced: 'I N TAKE' -> 'INTAKE', 'CALIBRAT I O N' -> 'CALIBRATION'."""
    s = s.replace("TABUL ATED", "TABULATED")
    s = re.sub(r"\b((?:[A-Z] ){2,})([A-Z]{2,})\b", lambda m: m.group(1).replace(" ", "") + m.group(2), s)
    s = re.sub(r"\b([A-Z]{2,})((?: [A-Z]){2,})\b", lambda m: m.group(1) + m.group(2).replace(" ", ""), s)
    return s


# "2 - 3 5 . 2 . ( 6 . 5 L ) FUEL ... CALIBRAT I O N This task covers:" (letter-spaced text layer)
SPACED_ID = re.compile(r"^((?:\d ?)+- ?(?:\d ?)+(?:\. ?(?:\d ?)+)?)\. ?(.+)$")


def despace_heading(line: str) -> tuple[str, str] | None:
    m = SPACED_ID.match(line)
    if not m or " " not in m.group(1) or " | " in line:
        return None
    if not re.match(r"^[(A-Z]", m.group(2)) or not re.search(r"[A-Z]{4,}", m.group(2)):
        return None
    pid = m.group(1).replace(" ", "")
    title = m.group(2)
    title = re.split(r"\s+This task covers:?", title)[0]
    title = re.sub(r"\(\s*([\d .]+L)\s*\)", lambda x: "(" + x.group(1).replace(" ", "") + ")", title)
    title = re.sub(r"\b([A-Z]{2,})((?: [A-Z])+)\b", lambda x: x.group(1) + x.group(2).replace(" ", ""), title)
    title = re.sub(r"\b([A-Z]{2,}) ([A-Z])\b(?= |$)", r"\1\2", title)  # "STA N D" leftovers
    return pid, title.strip()


def parse_toc(md: str) -> dict[str, str]:
    """'CHAPTER 1 | INTRODUCTION . . . 1-1' -> {'CHAPTER 1': 'INTRODUCTION'}"""
    out = {}
    for m in re.finditer(r"^(CHAPTER \d+|APPENDIX [A-Z])\.?\s*\|\s*([A-Z][A-Z/ ,&-]+?)\s*(?:\||\.\s\.)", md, re.M):
        out[m.group(1)] = m.group(2).strip()
    return out


WP_FOLIO = re.compile(r"^(\d{4}) \d{2}(?:-|$)")
WP_ENTRY = re.compile(r"(?:(\d{4}) )?([A-Z][A-Za-z0-9 ,()./&'-]*?)\s*(?:\.\s*){3,}(\d{4}) 00\b")


def parse_wp_toc(md: str) -> list[dict]:
    """RPSTL contents: 'GROUP 01 | ENGINE' then '0100 Engine and container assembly . . . 0002 00'."""
    out, group = [], None
    for line in md.splitlines():
        m = re.match(r"^GROUP (\d+)\s*\|\s*(.+)$", line.strip())
        if m:
            group = f"Group {m.group(1)}. {sentence_case(m.group(2))}"
            continue
        for e in WP_ENTRY.finditer(line):
            code, title, wp = e.group(1), " ".join(e.group(2).split()), e.group(3)
            title = re.sub(r"^TABLE OF CONTENTS.*?\bNo\.\s*", "", title)  # the list's own heading
            if not code:  # introduction and the indexes stand outside the functional groups
                label = "Cross-reference indexes" if "INDEX" in title.upper() else "Introduction"
            else:
                label = group
            out.append({"wp": wp, "code": code, "group": label, "title": sentence_case(title) if title.isupper() else title})
    return out


class Builder:
    skip_text = False

    def __init__(self, capture: Path):
        self.cap = capture
        self.units: list[dict] = []
        self.unit: dict | None = None
        self.chapter: str | None = None
        self.section: str | None = None
        self.page: tuple[int, str | None] = (0, None)
        self.page_marked = False
        self.toc: dict[str, str] = {}
        self.pending_text = ""

    # -- units
    def new_unit(self, **kw) -> None:
        self.unit = {"blocks": [], "pages": [], **kw}
        self.units.append(self.unit)
        self.page_marked = False
        self.mark_page()

    def mark_page(self) -> None:
        if self.unit is None or self.page_marked:
            return
        pdf, printed = self.page
        self.unit["blocks"].append({"t": "page", "pdf": pdf, "printed": printed})
        if pdf not in self.unit["pages"]:
            self.unit["pages"].append(pdf)
        self.page_marked = True

    def add(self, block: dict) -> None:
        self.mark_page()
        self.unit["blocks"].append(block)

    # -- pages
    def run(self, n_pages: int) -> None:
        self.toc = {}
        for n in range(1, n_pages + 1):
            p = self.cap / "pages" / f"page-{n:03d}.md"
            if p.exists():
                self.toc.update(parse_toc(p.read_text()))
        self.new_unit(slug="front-matter", kind="front", id=None, chapter=None, section=None,
                      title="Warnings and front matter")
        for n in range(1, n_pages + 1):
            p = self.cap / "pages" / f"page-{n:03d}.md"
            if p.exists():
                self.read_page(n, p.read_text())

    @staticmethod
    def printed_of(md: str) -> str | None:
        m = re.search(r"printed page (.+?) -->", md)
        return m.group(1).strip() if m and m.group(1).strip() != "None" else None

    def read_page(self, n: int, md: str) -> None:
        self.page = (n, self.printed_of(md))
        self.page_marked = False
        self.read_body(md)

    def read_body(self, md: str) -> None:
        body, _, figs = md.partition("\n---\n")
        lines = [] if self.skip_text else [l.rstrip() for l in body.splitlines()]
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            i += 1
            if not line or line.startswith("<a id=") or line.startswith("<!--"):
                continue
            if line.startswith("# Section") and re.search(r"(,| AND)$", line, re.I):
                # A section heading that wraps: the rest is the next upper-case line.
                j = i
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if j < len(lines) and lines[j].strip() == lines[j].strip().upper():
                    line, i = f"{line} {lines[j].strip()}", j + 1
            if line == "INDEX" and self.unit["kind"] != "back":
                self.chapter = self.section = None
                self.new_unit(slug="index-and-back-matter", kind="back", id=None, chapter=None, section=None,
                              title="Index and back matter")
                continue
            if self.heading(line):
                continue
            if line in self.toc.values():
                continue  # the chapter title line printed under "CHAPTER N"
            if line.startswith("> **") and line.endswith("**"):
                kind = line.strip("> *").upper()
                text = []
                while i < len(lines) and not lines[i].strip():
                    i += 1
                while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith(("#", "> **")):
                    text.append(lines[i].strip())
                    i += 1
                self.add({"t": "note", "kind": kind, "text": " ".join(text)})
                continue
            if " | " in line:
                last = self.unit["blocks"][-1] if self.unit["blocks"] else None
                cells = [c.strip() for c in line.split(" | ")]
                if last and last["t"] == "rows":
                    last["rows"].append(cells)
                else:
                    self.add({"t": "rows", "rows": [cells]})
                continue
            m = re.match(r"^(\d+)\.\s+(.+)$", line)
            if m:
                self.add({"t": "step", "n": m.group(1), "text": m.group(2)})
                continue
            m = re.match(r"^([a-z])\.\s+([A-Z][^.]{1,60})$", line)
            if m:
                self.add({"t": "h", "level": 3, "text": line})
                continue
            self.add({"t": "p", "text": line})
        for m in re.finditer(r"^\*\*(p\d+-(img|tbl)\d+)\*\*.*?(?:\[data: data/tables/([^\]]+)\.json\])?$", figs, re.M):
            fid, kind, key = m.group(1), m.group(2), m.group(3)
            self.add({"t": "fig", "id": fid} if kind == "img" else {"t": "tbl", "id": fid, "key": key})

    def heading(self, line: str) -> bool:
        """Handle chapter, appendix, section and paragraph headings. True if consumed."""
        if line.startswith("# "):
            text = strip_cont(line[2:])
            m = re.match(r"^CHAPTER (\d+)", text)
            if m:
                self.chapter, self.section = m.group(1), None
                return True
            m = re.match(r"^APPENDIX ([A-Z])", text)
            if m:
                letter = m.group(1)
                if not (self.unit and self.unit["kind"] == "appendix" and self.unit["id"] == letter):
                    name = self.toc.get(f"APPENDIX {letter}", "")
                    self.chapter, self.section = None, None
                    self.new_unit(slug=f"appendix-{letter.lower()}-{slugify(name)}".rstrip("-"), kind="appendix",
                                  id=letter, chapter=None, section=None,
                                  title=f"Appendix {letter}. {sentence_case(name)}" if name else f"Appendix {letter}")
                return True
            m = re.match(r"^Section ([IVX]+)\.\s*(.+)$", text)
            if m and self.chapter:
                self.section = f"Section {m.group(1)}. {sentence_case(m.group(2))}"
                return True
            self.add({"t": "h", "level": 2, "text": text})
            return True
        para = None
        if line.startswith("## "):
            m = re.match(r"^(\d+-\d+(?:\.\d+)?|[A-F]-\d+)\.\s+(.+)$", line[3:])
            if m:
                para = (m.group(1), m.group(2))
            else:
                self.add({"t": "h", "level": 2, "text": strip_cont(line[3:])})
                return True
        else:
            if not self.chapter:
                return False  # front matter: change lists look like spaced ids
            para = despace_heading(line)
        if not para:
            return False
        pid, title = para
        title, rest = split_title(join_spaced(title))
        if rest:
            self.pending_text = rest
        if re.match(r"^[A-F]-", pid) or self.unit["kind"] == "appendix":
            self.add({"t": "h", "level": 2, "text": f"{pid}. {title}"})
            if self.pending_text:
                self.add({"t": "p", "text": self.pending_text})
                self.pending_text = ""
            return True
        if not (self.unit["kind"] == "para" and self.unit["id"] == pid):
            nice = sentence_case(title)
            self.new_unit(slug=f"{pid}-{slugify(nice)}"[:80].rstrip("-"), kind="para", id=pid, chapter=self.chapter,
                          section=self.section, title=nice)
        if self.pending_text:
            self.add({"t": "p", "text": self.pending_text})
            self.pending_text = ""
        return True


class PartsBuilder(Builder):
    """Repair parts list: one unit per work package, found from each page's folio."""

    def run(self, n_pages: int) -> None:
        self.wps = {}
        for n in range(1, min(n_pages, 12) + 1):
            p = self.cap / "pages" / f"page-{n:03d}.md"
            if p.exists():
                for e in parse_wp_toc(p.read_text()):
                    self.wps.setdefault(e["wp"], e)
        self.new_unit(slug="front-matter", kind="front", id=None, chapter=None, section=None,
                      title="Warnings and front matter")
        for n in range(1, n_pages + 1):
            p = self.cap / "pages" / f"page-{n:03d}.md"
            if p.exists():
                self.read_page(n, p.read_text())

    def read_page(self, n: int, md: str) -> None:
        printed = self.printed_of(md)
        self.page = (n, printed)
        self.page_marked = False
        m = WP_FOLIO.match(printed or "")
        # Back matter opens with the authentication page or the DA Form 2028 (printed in capitals).
        if re.search(r"^(By Order of the Secretary|RECOMMENDED CHANGES TO\b)", md, re.M) and self.unit["kind"] != "back":
            self.new_unit(slug="forms-and-back-matter", kind="back", id=None, chapter=None, section=None,
                          title="Forms and back matter")
        elif m and self.unit["kind"] != "back" and not (self.unit["kind"] == "wp" and self.unit["id"] == m.group(1)):
            wp = m.group(1)
            e = self.wps.get(wp, {"group": None, "title": f"Work package {wp}", "code": None})
            self.new_unit(slug=f"{wp}-{slugify(e['title'])}"[:80].rstrip("-"), kind="wp", id=wp,
                          chapter=e["group"], section=None, title=e["title"], code=e["code"])
        # Plates and parts lists are carried by their figure and table records; the page text
        # of a parts list would only repeat the table. Introduction and front matter keep text.
        self.skip_text = self.unit["kind"] == "wp" and self.unit["id"] != "0001"
        self.read_body(md)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("capture")
    ap.add_argument("--pdf", required=True, help="the original PDF")
    ap.add_argument("--pdf-name", required=True, help="download file name, from the cover")
    ap.add_argument("--id", help="manual id (default: the capture folder name, e.g. tm-9-2815-237-34)")
    a = ap.parse_args()

    cap = Path(a.capture).expanduser().resolve()
    if not (cap / "manifest.json").exists():
        subs = [d for d in cap.iterdir() if (d / "manifest.json").exists()]
        cap = subs[0]
    tm = a.id or cap.name
    web = cap / "web"
    manifest = {r["id"]: r for r in json.loads((cap / "manifest.json").read_text())}
    content = {r["id"]: r for r in json.loads((web / "content.json").read_text())}
    tables_index = json.loads((web / "data" / "tables_index.json").read_text())
    n_pages = len(json.loads((cap / "structure.json").read_text()))

    structure = json.loads((cap / "structure.json").read_text())
    wp_pages = sum(bool(WP_FOLIO.match(r.get("printed_page") or "")) for r in structure)
    layout = "parts" if wp_pages > 0.3 * len(structure) else "paragraphs"
    b = PartsBuilder(cap) if layout == "parts" else Builder(cap)
    b.run(n_pages)
    units = [u for u in b.units if any(x["t"] != "page" for x in u["blocks"])]
    for u in units:  # a page marker with nothing after it belongs to the next section
        while u["blocks"][-1]["t"] == "page":
            u["pages"].remove(u["blocks"].pop()["pdf"])

    # Unique slugs (a paragraph id can only start one unit, but be safe).
    seen: dict[str, int] = {}
    for u in units:
        k = seen.get(u["slug"], 0)
        seen[u["slug"]] = k + 1
        if k:
            u["slug"] = f"{u['slug']}-{k + 1}"
        printed = [x["printed"] for x in u["blocks"] if x["t"] == "page" and x["printed"]]
        u["printed"] = [printed[0], printed[-1]] if printed else None
        u.setdefault("code", None)

    figures = {}
    # Work packages that share a contents title ("Special tools" x4): add the figure number.
    titles = [u["title"] for u in units if u["kind"] == "wp"]
    for u in units:
        if u["kind"] == "wp" and titles.count(u["title"]) > 1:
            fig = next((x["id"] for x in u["blocks"] if x["t"] == "fig"), None)
            m = re.match(r"Figure (\d+)", (content.get(fig) or {}).get("caption") or "")
            if m:
                u["title"] = f"{u['title']} (figure {m.group(1)})"
                u["slug"] = f"{u['id']}-{slugify(u['title'])}"
    for fid, c in content.items():
        m = manifest.get(fid, {})
        figures[fid] = {
            "id": fid, "kind": c.get("kind"), "page": c["page"], "printed_page": c.get("printed_page"),
            "caption": c.get("caption"), "alt": c.get("alt"), "callouts": c.get("callouts") or [],
            "width": c["width"], "height": c["height"], "needs_review": bool(c.get("needs_review")),
            "image": f"manuals/{tm}/{c['image']}", "thumb": f"manuals/{tm}/{c['thumb']}",
            "paragraph": m.get("paragraph"),
        }

    tables = {}
    by_source = {}
    for t in tables_index:
        for sid in t["source_ids"]:
            by_source[sid] = t["key"]
    for f in sorted((web / "data" / "tables").glob("*.json")):
        t = json.loads(f.read_text())
        crops = [f"manuals/{tm}/tables/{sid}.webp" for sid in t.get("source_ids", []) if (web / "tables" / f"{sid}.webp").exists()]
        tables[t["key"]] = {"key": t["key"], "title": t.get("title"), "columns": t.get("columns") or [],
                            "rows": t.get("rows") or [], "pages": t.get("pages") or [], "source_ids": t.get("source_ids") or [],
                            "crops": crops, **({"notes": t["notes"]} if t.get("notes") else {})}
    for u in units:
        for x in u["blocks"]:
            if x["t"] == "tbl" and not x.get("key"):
                x["key"] = by_source.get(x["id"])

    # Assets
    pub = ROOT / "public" / "manuals" / tm
    for sub in ("images", "thumbs", "tables"):
        if (pub / sub).exists():
            shutil.rmtree(pub / sub)
        shutil.copytree(web / sub, pub / sub)
    pdf_src = Path(a.pdf).expanduser()
    for old in pub.glob("*.pdf"):
        old.unlink()
    shutil.copyfile(pdf_src, pub / a.pdf_name)
    cover = render_cover(pdf_src, pub)

    out = {
        "id": tm,
        "source": "Generated by scripts/import_manual.py from the capture-technical-manual output. Do not hand-edit.",
        "pdf": {"file": f"manuals/{tm}/{a.pdf_name}", "bytes": (pub / a.pdf_name).stat().st_size, "pages": n_pages},
        "cover": cover,
        "layout": layout,
        "toc": b.toc,
        "sections": units,
        "figures": figures,
        "tables": tables,
    }
    dest = ROOT / "data" / "manuals" / f"{tm}.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    kinds = {k: sum(u["kind"] == k for u in units) for k in ("front", "para", "appendix", "wp", "back")}
    print(f"{dest.relative_to(ROOT)}: {len(units)} sections {kinds}, {len(figures)} figures, {len(tables)} tables, "
          f"{dest.stat().st_size // 1000} kB")
    for u in units:
        nb = sum(x["t"] != "page" for x in u["blocks"])
        print(f"  {u['slug']:<70} p.{u['printed'][0] if u['printed'] else '?'}  {len(u['pages'])} pages, {nb} blocks")


def render_cover(pdf: Path, pub: Path) -> dict:
    """First page as WebP (sips renders PDFs on macOS; OpenCV writes the WebP)."""
    import cv2

    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "cover.png"
        subprocess.run(["sips", "-s", "format", "png", str(pdf), "--resampleWidth", "900", "--out", str(png)],
                       check=True, capture_output=True)
        img = cv2.imread(str(png))
    cv2.imwrite(str(pub / "cover.webp"), img, [cv2.IMWRITE_WEBP_QUALITY, 85])
    h, w = img.shape[:2]
    return {"image": f"manuals/{pub.name}/cover.webp", "width": w, "height": h}


if __name__ == "__main__":
    main()
