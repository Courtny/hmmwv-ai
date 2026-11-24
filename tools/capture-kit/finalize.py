#!/usr/bin/env python3
import json, os, re, glob, shutil, collections, cv2
from PIL import Image
OUT = "out"; CFG = json.load(open("config.json")) if os.path.exists("config.json") else {}
M = json.load(open(f"{OUT}/manifest.json")); S = json.load(open(f"{OUT}/structure.json"))
figs = [m for m in M if m["type"] == "figure"] if all("type" in m for m in M) else M
figs = [m for m in M if m.get("type") == "figure"]; tabs = [m for m in M if m.get("type") == "table"]
by_f = collections.defaultdict(list); by_t = collections.defaultdict(list)
for m in figs: by_f[m["pdf_page"]].append(m)
for m in tabs: by_t[m["pdf_page"]].append(m)

# 1. page md: append figure/table references, rebuild manual.md
full = []
for s in S:
    p = s["pdf_page"]; f = f"{OUT}/pages/page-{p:03d}.md"; txt = open(f).read().rstrip() + "\n"
    if by_f[p] or by_t[p]:
        txt += "\n---\n"
        for m in by_f[p]:
            txt += f"\n**{m['id']}** ({m.get('kind') or 'figure'}): {m['caption']}\n"
            if m["callouts"]: txt += "  Key: " + "; ".join(f"({c['n']}) {c['label'] or 'unnamed'}" for c in m["callouts"]) + "\n"
        for m in by_t[p]:
            txt += f"\n**{m['id']}** (table): {m.get('label') or ''} {m['title']}  [data: data/tables/{m['table_key']}.json]\n"
    open(f, "w").write(txt); full.append(txt)
open(f"{OUT}/manual.md", "w").write("\n\n---\n\n".join(full))

# 2. diagrams.json (callout keys) and captions.md
diag = [dict(diagram_id=m["id"], page=m["pdf_page"], kind=m.get("kind"), caption=m["caption"], alt=m.get("alt"),
             callouts=m["callouts"], callout_confidence=m.get("callout_confidence"), needs_review=m.get("needs_review", False)) for m in figs]
json.dump(diag, open(f"{OUT}/data/diagrams.json", "w"), indent=1)
cap = ["# Figure captions and callout keys\n", "Captions are built from the manual's paragraph headings, since the manual prints no figure captions (except Appendix C figure labels). Callout keys come from the drawing plus the step text.\n"]
for m in figs:
    cap.append(f"\n## {m['id']}  (pdf page {m['pdf_page']}, printed {m['printed_page']})\n**{m['caption']}**  \n*{m.get('kind') or ''}.* {m.get('alt') or ''}")
    if m["callouts"]: cap.append("\n| Callout | Name |\n|---|---|\n" + "\n".join(f"| {c['n']} | {c['label'] or '(not named in the text)'} |" for c in m["callouts"]))
    if m.get("needs_review"): cap.append("\n*Needs review: " + "; ".join(m["notes"][-2:]) + "*")
open(f"{OUT}/captions.md", "w").write("\n".join(cap) + "\n")

# 3. review.md
TITLE = CFG.get("title") or os.path.splitext(os.path.basename(os.environ.get("TM_PDF", "manual")))[0]
rev = [f"# Review list: {TITLE} capture\n"]
rev.append("## Source problems (not extraction errors)\n")
blank = [s["pdf_page"] for s in S if s["words"] < 5]
rev += CFG.get("source_problems", [])
if blank: rev.append("- Pages with no text layer content (blank or image-only in the PDF): " + ", ".join(map(str, blank)) + ". Check whether content is missing.")
rev.append("- Printed page numbers are blank on pages with no folio: " + ", ".join(str(s['pdf_page']) for s in S if not s['printed_page']) + ".\n")
rev.append("## Representation choices\n")
rev += ["- Figures are page-region renders at 300 dpi with page text removed except circled callout digits and letters, so callouts survive and orientation is correct.",
        "- Neighbouring panels that touch can leave a sliver of the next panel at an edge (noted on those figures).",
        "- Printed typos and odd numbers are kept as printed in the data.\n"] + CFG.get("representation_notes", [])
nr = [m for m in figs if m.get("needs_review")]
rev.append(f"## Figures that need a person to look ({len(nr)})\n")
for m in nr: rev.append(f"- **{m['id']}** (page {m['pdf_page']}): " + "; ".join(n for n in m["notes"] if "caption derived" not in n)[:230] + f"; unnamed callouts: {', '.join(c['n'] for c in m['callouts'] if c['label'] is None) or 'none'}")
rev.append("\n## Verification record\n")
try:
    before = json.load(open(f"{OUT}/manifest_before_adjudication.json")); nb = sum(1 for m in before if m.get("type") != "table")
    rev.append(f"- Figures: {nb} after first extraction and agent verification, {len(figs)} after blind-audit adjudication.")
except Exception: pass
try:
    d = json.load(open("tbl/diff_report.json"))["summary"]
    rev.append(f"- Tables transcribed twice independently and compared cell by cell: {d['cells_compared']} cells compared, {d['differing']} differences resolved against the scan.")
except Exception: pass
rev.append("")
open(f"{OUT}/review.md", "w").write("\n".join(rev) + "\n")

# 4. web package
W = f"{OUT}/web"; shutil.rmtree(W, ignore_errors=True)
for d in ("images", "thumbs", "tables"): os.makedirs(f"{W}/{d}")
content = []
for m in figs:
    im = Image.open(f"{OUT}/{m['file']}").convert("L")
    im.save(f"{W}/images/{m['id']}.webp", "WEBP", lossless=True, quality=100, method=6)
    t = im.copy(); t.thumbnail((480, 480), Image.LANCZOS); t.save(f"{W}/thumbs/{m['id']}.webp", "WEBP", quality=85)
    content.append(dict(id=m["id"], kind=m.get("kind"), page=m["pdf_page"], printed_page=m["printed_page"], caption=m["caption"], alt=m.get("alt"),
                        callouts=m["callouts"], paragraph=m.get("paragraph"), subsection=m.get("subsection"), needs_review=m.get("needs_review", False),
                        width=im.width, height=im.height, image=f"images/{m['id']}.webp", thumb=f"thumbs/{m['id']}.webp", original=m["file"]))
tabs_out = []
for m in tabs:
    im = Image.open(f"{OUT}/{m['file']}").convert("L"); im.save(f"{W}/tables/{m['id']}.webp", "WEBP", quality=85, method=6)
    tabs_out.append(dict(id=m["id"], page=m["pdf_page"], printed_page=m["printed_page"], label=m.get("label"), title=m["title"], table_key=m["table_key"],
                         continues_from=m.get("continues_from"), image=f"tables/{m['id']}.webp", data=f"data/tables/{m['table_key']}.json", csv=f"data/tables/{m['table_key']}.csv", needs_review=m.get("needs_review", False)))
json.dump(content, open(f"{W}/content.json", "w"), indent=1); json.dump(tabs_out, open(f"{W}/tables.json", "w"), indent=1)
shutil.copytree(f"{OUT}/data", f"{W}/data"); shutil.copy(f"{OUT}/captions.md", W); shutil.copy(f"{OUT}/tables.md", W)
shutil.copytree(f"{OUT}/pages", f"{W}/pages"); shutil.copy(f"{OUT}/manual.md", W)
json.dump([dict(page=s["pdf_page"], printed_page=s["printed_page"], headings=[h for h in s["headings"] if h["kind"] in ("para",)]) for s in S], open(f"{W}/data/structure.json", "w"), indent=1)
open(f"{W}/README.md", "w").write(f"""# {TITLE} web package

{CFG.get("subtitle", "")} ({len(S)} PDF pages).

- `pages/` and `manual.md`: page text (markdown, page anchors `#p013`, printed page in a comment)
- `images/` (lossless WebP, {len(content)} figures) and `thumbs/` (480 px): id `pNNN-imgNN`, pNNN = PDF page
- `content.json`: per figure id, caption, alt text, callout key, page, size, needs_review
- `tables/` (crops of {len(tabs_out)} table regions), `tables.json`, and `data/tables/*.json|csv`: transcribed tables, one file per table key (continuations merged)
- `data/diagrams.json`: callout keys per figure (n, label)
- `captions.md`, `tables.md`: readable collections
- Data keeps typos exactly as printed. See `review.md` in the parent folder for known source problems.
""")
print("figures", len(content), "tables", len(tabs_out), "needs_review", len(nr))
import subprocess; print(subprocess.run(["du", "-sh", W, f"{W}/images"], capture_output=True, text=True).stdout)
