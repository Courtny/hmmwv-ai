#!/usr/bin/env python3
"""Prepare agent inputs after extract. Usage (run in workdir): python3 -I prep.py <pdf>
Writes: figv/manifest_v1.json, tbl/pages/p-NNN.png (110dpi), tbl/lines/p-NNN.json, audit/sheets/s-NN.png (6 pages per sheet),
        plan.json (page batches for agents)."""
import sys, os, json, shutil, fitz
from PIL import Image, ImageDraw
PDF = sys.argv[1]; doc = fitz.open(PDF); N = len(doc)
for d in ("figv/out", "tbl/pages", "tbl/lines", "tbl/out1", "tbl/out2", "audit/sheets", "adj"):
    os.makedirs(d, exist_ok=True)
shutil.copy("out/manifest.json", "figv/manifest_v1.json")
for i, p in enumerate(doc, 1):
    p.get_pixmap(dpi=110, colorspace=fitz.csGRAY).save(f"tbl/pages/p-{i:03d}.png")
    ws = sorted(p.get_text("words"), key=lambda w: ((w[1] + w[3]) / 2, w[0])); lines, cur = [], []
    for w in ws:
        yc = (w[1] + w[3]) / 2
        if cur and abs(yc - cur[0]) > 3: lines.append(cur[1:]); cur = []
        if not cur: cur = [yc]
        cur.append(w)
    if cur: lines.append(cur[1:])
    out = [dict(y0=round(min(w[1] for w in l), 1), y1=round(max(w[3] for w in l), 1), text=" ".join(w[4] for w in sorted(l, key=lambda w: w[0])),
                words=[[round(w[0], 1), round(w[2], 1), w[4]] for w in sorted(l, key=lambda w: w[0])]) for l in lines]
    json.dump(dict(pdf_page=i, width=p.rect.width, height=p.rect.height, lines=out), open(f"tbl/lines/p-{i:03d}.json", "w"))
# contact sheets, 3 across x 2 down, labelled
per, k = 6, 0
for s0 in range(0, N, per):
    tiles = []
    for pg in range(s0 + 1, min(N, s0 + per) + 1):
        im = Image.open(f"tbl/pages/p-{pg:03d}.png").convert("L"); d = ImageDraw.Draw(im); d.rectangle((0, 0, 190, 22), fill=255); d.text((4, 4), f"PDF PAGE {pg}", fill=0)
        tiles.append(im)
    w, h = tiles[0].size; sheet = Image.new("L", (w * 3, h * 2), 255)
    for j, t in enumerate(tiles): sheet.paste(t, ((j % 3) * w, (j // 3) * h))
    k += 1; sheet.save(f"audit/sheets/s-{k:02d}.png")
def batches(n, size): return [[a, min(n, a + size - 1)] for a in range(1, n + 1, size)]
json.dump(dict(pages=N, figure_verifiers=batches(N, 45), table_transcribers=batches(N, 40), audit_sheets=k), open("plan.json", "w"), indent=1)
print("pages", N, "sheets", k, "plan.json written")
