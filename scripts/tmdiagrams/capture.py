"""Read a TM capture folder (the output of the capture-technical-manual task)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Figure:
    id: str
    file: Path
    pdf_page: int
    printed_page: str | None
    kind: str | None
    caption: str
    alt: str
    callouts: list[dict]  # [{"n": "6", "label": "Capscrew"}]
    size_px: tuple[int, int]
    needs_review: bool
    notes: list[str] = field(default_factory=list)


class Capture:
    def __init__(self, root: str | Path):
        root = Path(root).expanduser().resolve()
        # Accept either the capture folder or its parent (the unzipped archive).
        if not (root / "manifest.json").exists():
            subs = [d for d in root.iterdir() if (d / "manifest.json").exists()] if root.is_dir() else []
            if len(subs) != 1:
                raise SystemExit(f"No manifest.json in {root}")
            root = subs[0]
        self.root = root
        self.tm = root.name  # e.g. tm-9-2815-237-34
        self.figures = {
            r["id"]: Figure(
                id=r["id"], file=root / r["file"], pdf_page=r["pdf_page"], printed_page=r.get("printed_page"),
                kind=r.get("kind"), caption=r.get("caption") or "", alt=r.get("alt") or "",
                callouts=r.get("callouts") or [], size_px=tuple(r.get("size_px") or (0, 0)),
                needs_review=bool(r.get("needs_review")), notes=r.get("notes") or [],
            )
            for r in json.loads((root / "manifest.json").read_text())
            if r.get("type", "figure") == "figure"
        }

    def select(self, ids: list[str] | None = None, pages: str | None = None, kinds: list[str] | None = None,
               with_callouts: bool = False) -> list[Figure]:
        figs = list(self.figures.values())
        if ids:
            unknown = [i for i in ids if i not in self.figures]
            if unknown:
                raise SystemExit(f"Unknown figure ids: {', '.join(unknown)}")
            figs = [self.figures[i] for i in ids]
        if pages:
            keep = parse_pages(pages)
            figs = [f for f in figs if f.pdf_page in keep]
        if kinds:
            figs = [f for f in figs if f.kind in kinds]
        if with_callouts:
            figs = [f for f in figs if f.callouts]
        return sorted(figs, key=lambda f: f.id)

    def page_text(self, pdf_page: int) -> str:
        p = self.root / "pages" / f"page-{pdf_page:03d}.md"
        return p.read_text() if p.exists() else ""


def parse_pages(spec: str) -> set[int]:
    """'190-200,227' -> {190..200, 227} (PDF page numbers)."""
    out: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            out.update(range(int(a), int(b) + 1))
        elif part:
            out.add(int(part))
    return out


@dataclass
class PageProcedure:
    para: str | None  # "2-39"
    title: str | None  # "Water crossover repair"
    section: str | None  # "d. Assembly"
    caution: str | None
    warning: str | None
    note: str | None
    steps: list[str]


def parse_page(md: str) -> PageProcedure:
    """Best-effort read of one page's procedure text. Text stays as printed."""
    body = md.split("\n---\n", 1)[0]  # drop the figure key block
    para = title = section = None
    m = re.search(r"^##\s+(\d+-\d+(?:\.\d+)?)\.\s+(.+?)\s*$", body, re.M)
    if m:
        para = m.group(1)
        title = re.sub(r"\s*\(Cont.?d\)\s*$", "", m.group(2), flags=re.I).strip()
        title = title[:1].upper() + title[1:].lower()
    m = re.search(r"^([a-z])\.\s+([A-Z][^\n]{1,60})$", body, re.M)
    if m:
        section = f"{m.group(1)}. {m.group(2).strip()}"

    def block(word: str) -> str | None:
        m = re.search(rf">\s*\*\*{word}\*\*\s*\n+(.+?)(?:\n\n|$)", body, re.S)
        return " ".join(m.group(1).split()) if m else None

    steps = [" ".join(s.split()) for s in re.findall(r"^\d+\.\s+(.+?)(?=\n\n|\Z)", body, re.M | re.S)]
    return PageProcedure(para, title, section, block("CAUTION"), block("WARNING"), block("NOTE"), steps)


def slugify(text: str) -> str:
    text = re.sub(r"^(\d+-\d+(\.\d+)?|[a-z])\.\s*", "", text)
    text = re.sub(r"\(Cont.?d\)", "", text, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "figure"
