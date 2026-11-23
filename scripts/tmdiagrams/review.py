"""A static review page: each figure with its detected callouts, and the trace once ingested."""
from __future__ import annotations

import html
import json
from pathlib import Path

CSS = """
:root{--paper:#F4F1E8;--card:#FBF9F4;--ink:#1C201B;--mute:#6B6F63;--line:#D9D4C5;--olive:#5B6B2F;--rust:#A8441A;--amber:#B7791F}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.45 "IBM Plex Sans",system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--paper);border-bottom:1px solid var(--line);padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font:700 20px/1 "Barlow Condensed",system-ui,sans-serif;letter-spacing:.02em;margin:0 12px 0 0;text-transform:uppercase}
button{font:inherit;border:1px solid var(--line);background:var(--card);border-radius:4px;padding:4px 10px;cursor:pointer}
button.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
main{padding:16px;display:grid;gap:16px}
.fig{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px}
.fig h2{font:700 17px/1.2 "Barlow Condensed",system-ui,sans-serif;margin:0 0 4px;text-transform:uppercase}
.meta{color:var(--mute);font-size:12px;margin-bottom:8px}
.badge{display:inline-block;font-size:11px;font-weight:600;border-radius:3px;padding:1px 6px;margin-left:6px;color:#fff;vertical-align:2px}
.ok{background:var(--olive)}.warn{background:var(--amber)}.bad{background:var(--rust)}.none{background:var(--mute)}
.views{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px}
.view{position:relative;border:1px solid var(--line);background:#fff}
.view img{display:block;width:100%;height:auto}
.view svg{position:absolute;inset:0;width:100%;height:100%}
.view .cap{position:absolute;left:6px;top:4px;font-size:11px;color:var(--mute);background:#fffc;padding:0 4px}
.ring circle{fill:none;stroke-width:4}
.ring text{font:700 28px system-ui,sans-serif;paint-order:stroke;stroke:#fff;stroke-width:6px}
.r-ok circle{stroke:var(--olive)}.r-ok text{fill:var(--olive)}
.r-warn circle{stroke:var(--amber)}.r-warn text{fill:var(--amber)}
.r-bad circle{stroke:var(--rust)}.r-bad text{fill:var(--rust)}
ul{margin:8px 0 0;padding-left:18px}li{margin:2px 0}
code{font:12px "IBM Plex Mono",ui-monospace,monospace;background:var(--paper);padding:0 3px;border-radius:2px}
"""

JS = """
const figs=[...document.querySelectorAll('.fig')];
document.querySelectorAll('header button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('header button').forEach(x=>x.classList.toggle('on',x===b));
  const f=b.dataset.f; let n=0;
  figs.forEach(el=>{const show=f==='all'||el.dataset.state.split(' ').includes(f);el.hidden=!show;n+=show});
  document.getElementById('count').textContent=n+' shown';
});
"""


def ring_class(r: dict) -> str:
    if r.get("confidence", 0) >= 0.95:
        return "r-ok"
    return "r-warn" if r.get("n") else "r-bad"


def overlay(rings: list[dict], w: float, h: float, scale: float = 1.0) -> str:
    out = [f'<svg viewBox="0 0 {w:g} {h:g}" aria-hidden="true">']
    for r in rings:
        x, y, rad = r["x"] * scale, r["y"] * scale, r["r"] * scale
        label = r.get("n") or (f'?{r["text"]}' if r.get("text") else "?")
        out.append(f'<g class="ring {ring_class(r)}"><circle cx="{x:.1f}" cy="{y:.1f}" r="{rad + 4 * scale:.1f}"'
                   f' style="stroke-width:{max(2, 4 * scale):.1f}"/>'
                   f'<text x="{x + rad + 6 * scale:.1f}" y="{y - rad:.1f}" style="font-size:{max(14, 28 * scale):.0f}px">'
                   f'{html.escape(label)}</text></g>')
    out.append("</svg>")
    return "".join(out)


def states(fig: dict) -> list[str]:
    s = []
    rings = fig["rings"]
    if fig.get("not_callouts"):
        s.append("image")
    elif not rings:
        s.append("norings")
    elif all(r.get("confidence", 0) >= 0.95 for r in rings) and not fig["missing"]:
        s.append("clean")
    else:
        s.append("review")
    s.append("traced" if fig.get("svg") else "untraced")
    if fig.get("svg_problems"):
        s.append("review")
    return s


def build(work: Path, tm: str) -> Path:
    figs = [json.loads(p.read_text()) for p in sorted((work / "figures").glob("*.json"))]
    cards = []
    for f in figs:
        st = states(f)
        w, h = f["size_px"]
        rings = f["rings"]
        n_ok = sum(r.get("confidence", 0) >= 0.95 for r in rings)
        badge = ('<span class="badge none">image only, no callouts</span>' if "image" in st else
                 '<span class="badge ok">callouts clean</span>' if "clean" in st else
                 '<span class="badge none">no rings found</span>' if "norings" in st else
                 f'<span class="badge warn">{n_ok}/{len(rings)} rings read</span>')
        badge += ('<span class="badge ok">traced</span>' if f.get("svg") else '<span class="badge none">not traced</span>')
        if f.get("svg_problems"):
            badge += '<span class="badge bad">trace issues</span>'
        views = [f'<div class="view"><span class="cap">scan</span><img src="in/{f["id"]}.png" alt="" loading="lazy">'
                 f'{overlay(rings, w, h)}</div>']
        if f.get("svg"):
            vw, vh = f["viewbox"]
            views.append(f'<div class="view"><span class="cap">trace ({html.escape(f["svg_source"])})</span>'
                         f'<img src="{html.escape(f["svg"])}" alt="" loading="lazy">{overlay(rings, vw, vh, f["scale"])}</div>')
        issues = [f"Reviewed: {html.escape(n)}" for n in f.get("review_notes", [])]
        if f["missing"] and not f.get("not_callouts"):
            issues.append("In the key but not found in the drawing: " + ", ".join(f["missing"]))
        for r in rings:
            for note in r.get("notes", []):
                issues.append(f'Ring at ({r["x"]:.0f}, {r["y"]:.0f}) labelled {r.get("n") or "?"}: {html.escape(note)}')
        if not f["expected"]:
            issues.append("The capture has no callout key for this figure.")
        issues += [html.escape(p) for p in f.get("svg_problems", [])]
        key = ", ".join(f'{c["n"]} {html.escape(c.get("label") or "?")}' for c in f["key"])
        cards.append(
            f'<section class="fig" id="{f["id"]}" data-state="{" ".join(st)}">'
            f'<h2>{f["id"]} · {html.escape(f["caption"])}{badge}</h2>'
            f'<div class="meta">PDF page {f["pdf_page"]}, printed {html.escape(str(f["printed_page"]))} · {html.escape(f.get("kind") or "")}'
            f' · key: {key or "none"}</div>'
            f'<div class="views">{"".join(views)}</div>'
            + (f'<ul>{"".join(f"<li>{i}</li>" for i in issues)}</ul>' if issues else "")
            + f'<div class="meta" style="margin-top:8px">Fix callouts in <code>figures/{f["id"]}.json</code>, then rerun <code>review</code>.</div>'
            "</section>"
        )
    counts = {k: sum(k in states(f) for f in figs) for k in ("review", "clean", "norings", "traced", "untraced")}
    buttons = [("all", f"All {len(figs)}"), ("review", f"Needs review {counts['review']}"), ("clean", f"Clean {counts['clean']}"),
               ("norings", f"No rings {counts['norings']}"), ("traced", f"Traced {counts['traced']}"), ("untraced", f"Not traced {counts['untraced']}")]
    page = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>Diagram review</title><style>{CSS}</style></head><body>'
        f'<header><h1>{html.escape(tm.upper())} diagrams</h1>'
        + "".join(f'<button data-f="{k}"{" class=on" if k == "all" else ""}>{t}</button>' for k, t in buttons)
        + f'<span id="count" class="meta" style="margin:0">{len(figs)} shown</span></header>'
        f'<main>{"".join(cards)}</main><script>{JS}</script></body></html>'
    )
    out = work / "review.html"
    out.write_text(page)
    return out
