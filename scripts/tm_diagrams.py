#!/usr/bin/env python3
"""Turn technical manual figures into site diagrams (traced SVG + callout positions).

Workflow, per TM capture folder (see scripts/tmdiagrams/README.md):

  prep     copy chosen figures to work/diagrams/<tm>/in/ and find their callouts
  (you)    run VectorMagic batch: in/ -> out/ as SVG
  ingest   check the SVGs in out/ (or trace with potrace), refresh the review page
  review   rebuild review.html after hand edits to figures/<id>.json
  emit     copy approved SVGs to assets/diagrams/ and write procedure drafts
  status   counts per stage
"""
from __future__ import annotations

import argparse
import re
import json
import shutil
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tmdiagrams import callouts, review, svg  # noqa: E402
from tmdiagrams.capture import Capture, parse_page, slugify  # noqa: E402

WORK = ROOT / "work" / "diagrams"
ASSETS = ROOT / "assets" / "diagrams"


def workdir(cap: Capture) -> Path:
    w = WORK / cap.tm
    for sub in ("in", "out", "clean", "traced", "figures", "drafts", "to-trace"):
        (w / sub).mkdir(parents=True, exist_ok=True)
    return w


def load_fig(w: Path, fid: str) -> dict:
    return json.loads((w / "figures" / f"{fid}.json").read_text())


def save_fig(w: Path, fig: dict) -> None:
    (w / "figures" / f"{fig['id']}.json").write_text(json.dumps(fig, indent=1, ensure_ascii=False) + "\n")


def fig_ids(w: Path, ids: list[str] | None) -> list[str]:
    have = sorted(p.stem for p in (w / "figures").glob("*.json"))
    if ids:
        missing = [i for i in ids if i not in have]
        if missing:
            raise SystemExit(f"Not prepped yet: {', '.join(missing)}")
        return ids
    return have


# ---------------------------------------------------------------- prep

def cmd_prep(a) -> None:
    cap = Capture(a.capture)
    figs = cap.select(a.ids, a.pages, a.kind, a.with_callouts)
    if a.limit:
        figs = figs[: a.limit]
    if not figs:
        raise SystemExit("No figures match.")
    w = workdir(cap)
    for i, f in enumerate(figs, 1):
        target = w / "figures" / f"{f.id}.json"
        if target.exists() and not a.force:
            print(f"  {f.id}: already prepped (use --force to redo callouts)")
            shutil.copyfile(f.file, w / "in" / f"{f.id}.png")
            continue
        shutil.copyfile(f.file, w / "in" / f"{f.id}.png")
        expected = [str(c["n"]) for c in f.callouts]
        hits, missing = callouts.detect(str(f.file), expected)
        fig = {
            "id": f.id, "tm": cap.tm, "capture": str(cap.root), "pdf_page": f.pdf_page,
            "printed_page": f.printed_page, "kind": f.kind, "caption": f.caption, "alt": f.alt,
            "size_px": list(f.size_px), "key": f.callouts, "expected": expected,
            "rings": [{k: (round(v, 1) if k in ("x", "y", "r") else v) for k, v in asdict(h).items()} for h in hits],
            "missing": missing,
        }
        save_fig(w, fig)
        ok = sum(h.confidence >= 0.95 for h in hits)
        flag = "" if ok == len(hits) and not missing else "  <- review"
        print(f"  [{i}/{len(figs)}] {f.id}: {len(hits)} rings, {ok} read in key, {len(missing)} missing{flag}")
    page = review.build(w, cap.tm)
    # PNGs with no VectorMagic SVG yet, so a batch never re-traces finished figures.
    todo = w / "to-trace"
    shutil.rmtree(todo, ignore_errors=True)
    todo.mkdir()
    waiting = [png for png in sorted((w / "in").glob("*.png")) if not (w / "out" / f"{png.stem}.svg").exists()]
    for png in waiting:
        shutil.copyfile(png, todo / png.name)
    print(f"""
Prepped {len(figs)} figures in {w.relative_to(ROOT)}/ ({len(waiting)} still to trace)

Next, in VectorMagic (batch mode):
  1. Add every PNG in {todo.relative_to(ROOT)}/
  2. Settings for black-and-white line art: no blending, high quality,
     2 colours (black and white). Same settings as the water crossover.
  3. Export SVG into {(w / 'out').relative_to(ROOT)}/ keeping the file names
     (p193-img01.png -> p193-img01.svg).
Then run:  .venv/bin/python scripts/tm_diagrams.py ingest {a.capture}

Review page: {page}""")


# ---------------------------------------------------------------- ingest

def cmd_ingest(a) -> None:
    cap = Capture(a.capture)
    w = workdir(cap)
    n_vm = n_po = n_none = 0
    for fid in fig_ids(w, a.ids):
        fig = load_fig(w, fid)
        vm = w / "out" / f"{fid}.svg"
        po = w / "traced" / f"{fid}.svg"
        snapped = 0
        if vm.exists():
            # Review and emit use a two-tone copy; out/ stays as VectorMagic wrote it.
            path = w / "clean" / f"{fid}.svg"
            snapped = svg.snap_two_tone(vm, path)
            src, n_vm = "VectorMagic", n_vm + 1
        elif a.potrace:
            if not svg.potrace_available():
                raise SystemExit("potrace is not installed (brew install potrace).")
            if not po.exists() or a.force:
                svg.trace_potrace(w / "in" / f"{fid}.png", po)
            src, path, n_po = "potrace", po, n_po + 1
        else:
            n_none += 1
            continue
        info = svg.inspect(path)
        fig.update(svg=str(path.relative_to(w)), svg_source=src, viewbox=list(info.viewbox),
                   scale=info.viewbox[0] / fig["size_px"][0], svg_problems=svg.problems(info, tuple(fig["size_px"])),
                   svg_kb=info.bytes // 1000)
        save_fig(w, fig)
        fig["svg_snapped"] = snapped
        save_fig(w, fig)
        issues = "; ".join(fig["svg_problems"]) or "ok"
        note = f", {snapped} grey shades snapped to black/white" if snapped else ""
        print(f"  {fid}: {src}, {info.paths} paths, {info.bytes // 1000} kB{note}: {issues}")
    page = review.build(w, cap.tm)
    print(f"\n{n_vm} from VectorMagic, {n_po} from potrace, {n_none} not traced yet.\nReview page: {page}")


def cmd_review(a) -> None:
    cap = Capture(a.capture)
    print(review.build(workdir(cap), cap.tm))


# ---------------------------------------------------------------- rematch

_ASSIGN_NOTES = ("OCR read", "no OCR reading", "only unmatched ring")


def _hits(fig: dict) -> list[callouts.Hit]:
    return [callouts.Hit(**{**r, "notes": [n for n in r.get("notes", []) if not n.startswith(_ASSIGN_NOTES)]}) for r in fig["rings"]]


def _score(fig: dict, expected: list[str]) -> int:
    hits = _hits(fig)
    callouts.assign(hits, expected)
    return sum(h.confidence >= 0.95 for h in hits)


def cmd_rematch(a) -> None:
    """Match stored ring readings to the key again (no OCR). Keeps rings checked by hand."""
    cap = Capture(a.capture)
    w = workdir(cap)
    figs = {i: load_fig(w, i) for i in fig_ids(w, a.ids)}
    # Keys swapped between figures on one page: swap when both match better.
    by_page: dict[int, list[dict]] = {}
    for f in figs.values():
        by_page.setdefault(f["pdf_page"], []).append(f)
    for group in by_page.values():
        for i, f in enumerate(group):
            for g in group[i + 1:]:
                if "key_from" in f or "key_from" in g:
                    continue
                own = (_score(f, f["expected"]), _score(g, g["expected"]))
                swapped = (_score(f, g["expected"]), _score(g, f["expected"]))
                if swapped[0] > own[0] and swapped[1] > own[1]:
                    f["key"], g["key"] = g["key"], f["key"]
                    f["expected"], g["expected"] = g["expected"], f["expected"]
                    f["key_from"], g["key_from"] = g["id"], f["id"]
                    print(f"  {f['id']} <-> {g['id']}: callout keys swapped (the capture has them the wrong way round)")
    for f in figs.values():
        before = sum(r.get("confidence", 0) >= 0.95 for r in f["rings"]), len(f["missing"])
        hits = _hits(f)
        f["missing"] = callouts.assign(hits, f["expected"])
        hits.sort(key=lambda h: (callouts.natural(h.n or "~"), h.y, h.x))
        f["rings"] = [asdict(h) for h in hits]
        save_fig(w, f)
        after = sum(h.confidence >= 0.95 for h in hits), len(f["missing"])
        if after != before:
            print(f"  {f['id']}: {before[0]} -> {after[0]} read in key, {before[1]} -> {after[1]} missing")
    print(review.build(w, cap.tm))


# ---------------------------------------------------------------- emit

def cmd_emit(a) -> None:
    cap = Capture(a.capture)
    w = workdir(cap)
    tm_name = cap.tm.upper().replace("TM-", "TM ", 1)
    for fid in a.ids:
        fig = load_fig(w, fid)
        if not fig.get("svg"):
            raise SystemExit(f"{fid}: no trace yet; run ingest first.")
        if fig.get("not_callouts"):
            raise SystemExit(f"{fid}: marked image only (no callout rings), so it has no procedure diagram.")
        if fig.get("svg_problems") and not a.force:
            raise SystemExit(f"{fid}: trace issues ({'; '.join(fig['svg_problems'])}). Use --force to emit anyway.")
        unsure = [r for r in fig["rings"] if r.get("confidence", 0) < 0.95]
        if (unsure or fig["missing"]) and not a.force:
            raise SystemExit(f"{fid}: {len(unsure)} unconfirmed rings, {len(fig['missing'])} missing labels. "
                             f"Fix figures/{fid}.json (set confidence to 1 once checked) or use --force.")
        page = parse_page(cap.page_text(fig["pdf_page"]))
        steps_page = fig["printed_page"]
        if not page.steps:
            # Figure-only page: the steps it illustrates are usually on the page before.
            prev_md = cap.page_text(fig["pdf_page"] - 1)
            prev = parse_page(prev_md)
            if prev.steps and prev.para == page.para:
                page = prev
                m = re.search(r"printed page (\S+)", prev_md)
                steps_page = m.group(1) if m else steps_page
                print(f"  {fid}: no steps on its own page, using page {steps_page}")
        fig = {**fig, "steps_page": steps_page}
        slug = slugify(fig["caption"])
        name = f"{cap.tm}-{fid}-{slug}.svg"
        shutil.copyfile(w / fig["svg"], ASSETS / name)
        draft = procedure_draft(fig, page, name, tm_name, slug)
        (w / "drafts" / f"{fid}.ts").write_text(draft)
        print(f"  {fid}: assets/diagrams/{name}\n          draft: {(w / 'drafts' / f'{fid}.ts').relative_to(ROOT)}")
    print("\nPaste each draft into the procedures array in lib/procedures.ts and check the steps against the page.")


def procedure_draft(fig: dict, page, file: str, tm_name: str, slug: str) -> str:
    s = fig["scale"]
    rings = [r for r in fig["rings"] if r.get("n")]
    ring_r = round(sorted(r["r"] for r in rings)[len(rings) // 2] * s) if rings else 21
    labels = {str(c["n"]): c.get("label") for c in fig["key"]}
    counts: dict[str, int] = {}
    for r in rings:
        counts[r["n"]] = counts.get(r["n"], 0) + 1

    def lit(v):
        return json.dumps(v, ensure_ascii=False)

    def num(n: str) -> str:
        return n if n.isdigit() else lit(n)

    parts = []
    for n in sorted(labels, key=callouts.natural):
        name = labels[n] or "TODO name"
        parts.append(f"      {{ n: {num(n)}, name: {lit(name)} }},")
    cos = [f"{{ n: {num(r['n'])}, x: {round(r['x'] * s)}, y: {round(r['y'] * s)} }}" for r in rings]
    co_lines = ["        " + ", ".join(cos[i:i + 3]) + "," for i in range(0, len(cos), 3)]
    title = page.title or fig["caption"]
    lines = [
        "  {",
        f"    slug: {lit(slug + ('-' + slugify(page.section) if page.section else ''))},",
        f"    manual: {lit(tm_name)},",
        f"    para: {lit(page.para or 'TODO')},",
        f"    title: {lit(title)},",
        f"    section: {lit(page.section or 'TODO')},",
        f"    page: {lit(fig.get('steps_page') or fig['printed_page'] or '')},",
        "    draft: true, // Generated by scripts/tm_diagrams.py: check steps and names against the page.",
    ]
    if page.warning:
        lines.append(f"    // WARNING on the page: {page.warning}")
    if page.caution:
        lines.append(f"    caution: {lit(page.caution)},")
    if page.note:
        lines.append(f"    note: {lit(page.note)},")
    lines.append("    steps: [")
    lines += [f"      {lit(st)}," for st in page.steps] or ["      // TODO: no numbered steps found on this page"]
    lines += ["    ],", "    // Names from the capture's callout key. Callout numbers are the diagram's.", "    parts: [", *parts, "    ],",
              "    diagram: {", f"      file: {lit(file)},",
              f"      viewBox: [{round(fig['viewbox'][0])}, {round(fig['viewbox'][1])}],",
              f"      ring: {ring_r},",
              "      // Callout ring centres in viewBox units, found by scripts/tm_diagrams.py.",
              "      callouts: [", *co_lines, "      ],",
              f"      alt: {lit(fig['alt'])},",
              f"      credit: {lit(f'US Army technical manual {tm_name}, page {fig['printed_page']}')},",
              "    },", "  },", ""]
    return "\n".join(lines)


# ---------------------------------------------------------------- status

def cmd_status(a) -> None:
    cap = Capture(a.capture)
    w = workdir(cap)
    figs = [load_fig(w, i) for i in fig_ids(w, None)]
    clean = sum(1 for f in figs if f["rings"] and all(r.get("confidence", 0) >= 0.95 for r in f["rings"]) and not f["missing"])
    images = sum(1 for f in figs if f.get("not_callouts"))
    traced = sum(1 for f in figs if f.get("svg"))
    waiting = len(list((w / "in").glob("*.png"))) - len(list((w / "out").glob("*.svg")))
    emitted = len(list((w / "drafts").glob("*.ts")))
    print(f"{cap.tm}: {len(cap.figures)} figures in capture, {len(figs)} prepped, {clean} with clean callouts, {images} image only,\n"
          f"{traced} traced, {max(waiting, 0)} PNGs without a VectorMagic SVG, {emitted} emitted.")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("prep", help="choose figures, copy them for VectorMagic, find callouts")
    s.add_argument("capture", help="TM capture folder (the unzipped capture task output)")
    s.add_argument("--ids", nargs="+", help="figure ids, e.g. p193-img01")
    s.add_argument("--pages", help="PDF pages, e.g. 190-200,227")
    s.add_argument("--kind", nargs="+", help='e.g. "exploded view" "assembly view"')
    s.add_argument("--with-callouts", action="store_true", help="only figures that have a callout key")
    s.add_argument("--limit", type=int)
    s.add_argument("--force", action="store_true", help="redo callout detection, discarding hand edits")
    s.set_defaults(fn=cmd_prep)

    s = sub.add_parser("ingest", help="check VectorMagic output (or trace with potrace)")
    s.add_argument("capture")
    s.add_argument("--ids", nargs="+")
    s.add_argument("--potrace", action="store_true", help="trace figures that have no VectorMagic SVG with potrace")
    s.add_argument("--force", action="store_true", help="re-run potrace even if a trace exists")
    s.set_defaults(fn=cmd_ingest)

    s = sub.add_parser("review", help="rebuild review.html")
    s.add_argument("capture")
    s.set_defaults(fn=cmd_review)

    s = sub.add_parser("rematch", help="match stored ring readings to the key again, keeping hand edits")
    s.add_argument("capture")
    s.add_argument("--ids", nargs="+")
    s.set_defaults(fn=cmd_rematch)

    s = sub.add_parser("emit", help="copy approved diagrams to assets/diagrams and write procedure drafts")
    s.add_argument("capture")
    s.add_argument("--ids", nargs="+", required=True)
    s.add_argument("--force", action="store_true", help="emit even with unconfirmed callouts or trace issues")
    s.set_defaults(fn=cmd_emit)

    s = sub.add_parser("status")
    s.add_argument("capture")
    s.set_defaults(fn=cmd_status)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
