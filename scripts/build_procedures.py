"""Build interactive procedures from a manual's subsections and its reviewed diagrams.

One procedure per lettered subsection ("c. Inspection") of a paragraph that has numbered
steps and at least one traced figure with reviewed callouts. Each step is tied to the figure
whose callout key best matches the part numbers it names, so figures whose numbering restarts
within a subsection still work.

Reads:  data/manuals/<tm>.json         (scripts/import_manual.py)
        diagrams/<tm>/<id>.json        (reviewed callouts, scripts/tm_diagrams.py)
        assets/diagrams/<tm>-<id>-*.svg (emitted traces)
Writes: data/manuals/<tm>-procedures.json

Usage:  .venv/bin/python scripts/build_procedures.py tm-9-2815-237-34
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from tmdiagrams.capture import slugify  # noqa: E402
from tmdiagrams.callouts import natural  # noqa: E402

REF = re.compile(r"\((\d{1,2}(?:\.\d)?|[A-Z])\)")
CONT = re.compile(r"\s*\(Cont.?d\)$", re.I)
# Capture artifacts after a heading: a note label or the setup table that follows it.
TAIL = re.compile(r"\s+(NOT ?E|NOTE|CAUTION|WARNING|INITIAL SETUP)\b.*$")
# Subsections that already have a hand-written procedure in lib/procedures.ts.
HAND_WRITTEN = {("2-39", "d. Assembly"), ("2-40", "a. Disassembly"), ("2-40", "d. Assembly")}


def words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", s.lower()) if w not in {"and", "the", "with", "from"}}


def subsections(section: dict) -> list[dict]:
    """Split a paragraph's blocks at lettered headings, joining "(Cont'd)" repeats."""
    subs, cur, page, notes = [], None, None, []
    for i, b in enumerate(section["blocks"]):
        if b["t"] == "page":
            page = b["printed"]
        elif b["t"] == "h" and b["level"] == 3:
            name = TAIL.sub("", CONT.sub("", b["text"]).strip())
            if cur and cur["name"].lower() == name.lower():
                continue
            cur = {"name": name, "steps": [], "figs": [], "page": page}
            subs.append(cur)
            notes = []
        elif cur is None:
            continue
        elif b["t"] == "note":
            notes.append({"kind": b["kind"].strip().upper(), "text": b["text"]})
        elif b["t"] == "step":
            cur["steps"].append({"n": b["n"], "text": b["text"], "at": i, "page": page, "notes": notes})
            notes = []
        elif b["t"] == "fig":
            cur["figs"].append({"id": b["id"], "at": i, "page": page})
    return subs


def diagram(tm: str, fig_id: str, reviewed: dict, figure: dict, credit: str) -> dict | None:
    files = sorted((ROOT / "assets" / "diagrams").glob(f"{tm}-{fig_id}-*.svg"))
    if not files or reviewed.get("not_callouts"):
        return None
    s = reviewed["scale"]
    rings = [r for r in reviewed["rings"] if r.get("n")]
    if not rings:
        return None
    labels = {str(c["n"]): c.get("label") for c in reviewed["key"]}
    parts = [{"n": n, "name": labels[n] or f"Part {n}"} for n in sorted(labels, key=natural) if any(r["n"] == n for r in rings)]
    return {
        "figure": fig_id,
        "file": files[0].name,
        "viewBox": [round(reviewed["viewbox"][0]), round(reviewed["viewbox"][1])],
        "ring": round(sorted(r["r"] for r in rings)[len(rings) // 2] * s),
        "callouts": [{"n": r["n"], "x": round(r["x"] * s), "y": round(r["y"] * s)} for r in rings],
        "parts": parts,
        "alt": figure.get("alt") or figure.get("caption") or "",
        "page": figure.get("printed_page"),
        "credit": f"{credit}, page {figure.get('printed_page')}",
    }


def match(step: dict, d: dict, own: bool) -> float:
    """How well a diagram's key fits the part numbers a step names. A figure printed under
    a neighbouring heading only counts where the key's name matches the step's words."""
    labels = {p["n"]: words(p["name"]) for p in d["parts"]}
    score = 0.0
    for m in REF.finditer(step["text"]):
        n = m.group(1)
        if n in labels:
            named = bool(labels[n] & words(step["text"][max(0, m.start() - 40): m.start()]))
            score += 3 if named else (1 if own else 0)
    return score


def short_slug(title: str, name: str, limit: int = 60, para: str = "") -> str:
    """Paragraph title without its bracketed model lists and "into/from subassemblies", plus the subsection."""
    title = re.sub(r"\([^)]*\)", " ", title)
    title = re.sub(r"\b(into|from) subassemblies\b", "", title, flags=re.I)
    head, tail = slugify(title), slugify(name)
    while len(head) + len(tail) > limit and "-" in head:
        head = head.rsplit("-", 1)[0]
    return f"{slugify('para ' + para.replace('.', '-')) + '-' if para else ''}{head}-{tail}"


def build(tm: str) -> dict:
    manual = json.loads((ROOT / "data" / "manuals" / f"{tm}.json").read_text())
    reviewed = {p.stem: json.loads(p.read_text()) for p in (ROOT / "diagrams" / tm).glob("*.json")}
    number = tm.upper().replace("TM-", "TM ", 1)
    credit = f"US Army technical manual {number}"
    out, seen = [], set()
    for sec in manual["sections"]:
        if sec["kind"] != "para":
            continue
        subs = subsections(sec)
        for si, sub in enumerate(subs):
            if not sub["steps"] or (sec["id"], sub["name"]) in HAND_WRITTEN:
                continue
            # Figures often land under the next heading (or the one before), so look there too.
            pool = [(f, k == si) for k in (si - 1, si, si + 1) if 0 <= k < len(subs) for f in subs[k]["figs"]]
            figs = [(f, own, diagram(tm, f["id"], reviewed[f["id"]], manual["figures"][f["id"]], credit))
                    for f, own in pool if f["id"] in reviewed and f["id"] in manual["figures"]]
            figs = [(f, own, d) for f, own, d in figs if d]
            if not figs:
                continue
            # Tie each step to its best diagram; nearer figures (the one after the step first) break ties.
            prev = next((k for k, (_, own, _) in enumerate(figs) if own), 0)
            refs = hits = 0
            steps = []
            for st in sub["steps"]:
                scores = [match(st, d, own) for _, own, d in figs]
                best = max(scores)
                if best > 0:
                    near = lambda k: (figs[k][0]["at"] - st["at"]) if figs[k][0]["at"] > st["at"] else 10_000 + st["at"] - figs[k][0]["at"]
                    prev = min((k for k, sc in enumerate(scores) if sc == best), key=near)
                named = [m.group(1) for m in REF.finditer(st["text"])]
                have = {p["n"] for p in figs[prev][2]["parts"]}
                refs += len(named)
                hits += sum(n in have for n in named)
                step = {"n": st["n"], "text": st["text"], "d": prev}
                if st["notes"]:
                    step["notes"] = st["notes"]
                steps.append(step)
            used = sorted({s["d"] for s in steps})
            remap = {k: i for i, k in enumerate(used)}
            for s in steps:
                s["d"] = remap[s["d"]]
            name = re.sub(r"^\w\.\s+", "", sub["name"])
            slug = short_slug(sec["title"], name)
            if slug in seen:
                slug = short_slug(sec["title"], name, para=sec["id"])
            seen.add(slug)
            coverage = hits / refs if refs else 1.0
            if coverage < 0.5:
                print(f"  skipped {sec['id']} {sub['name']}: steps name parts the figures do not show ({coverage:.2f})")
                continue
            out.append({
                "slug": slug,
                "para": sec["id"],
                "title": sec["title"],
                "section": sub["name"],
                "page": sub["steps"][0]["page"] or sub["page"],
                "steps": steps,
                "diagrams": [figs[k][2] for k in used],
                "coverage": round(coverage, 2),
                # Steps whose part numbers mostly miss the diagrams stay noindex until checked.
                "draft": coverage < 0.8,
            })
    return {"manual": tm, "procedures": out}


def main() -> None:
    tm = sys.argv[1] if len(sys.argv) > 1 else "tm-9-2815-237-34"
    data = build(tm)
    path = ROOT / "data" / "manuals" / f"{tm}-procedures.json"
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    ps = data["procedures"]
    print(f"{len(ps)} procedures, {sum(len(p['steps']) for p in ps)} steps, "
          f"{sum(len(p['diagrams']) for p in ps)} diagrams, {sum(p['draft'] for p in ps)} drafts -> {path.relative_to(ROOT)}")
    for p in sorted(ps, key=lambda p: p["coverage"])[:12]:
        print(f"  {p['coverage']:.2f}  {p['para']} {p['section']}: {len(p['steps'])} steps, {len(p['diagrams'])} diagrams")


if __name__ == "__main__":
    main()
