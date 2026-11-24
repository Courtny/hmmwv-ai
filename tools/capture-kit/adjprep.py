#!/usr/bin/env python3
"""After audit/counts.json exists. Usage: python3 -I adjprep.py <pdf>
Lists pages where blind audit and extraction disagree, writes adj/p-NNN.png + adj/current_figures.json, and tbl pages needing adjudication."""
import sys, os, json, fitz
doc = fitz.open(sys.argv[1]); C = json.load(open("audit/counts.json"))["pages"]; M = json.load(open("out/manifest.json"))
fig = {}; 
for m in M:
    if m.get("type", "figure") == "figure": fig.setdefault(m["pdf_page"], []).append(m)
import glob
tabs = {}
for f in glob.glob("tbl/out2/*.json"):
    for t in json.load(open(f))["tables"]: tabs[t["pdf_page"]] = tabs.get(t["pdf_page"], 0) + 1
fp, tp = [], []
for k, v in C.items():
    pg = int(k)
    if v["figures"] != len(fig.get(pg, [])): fp.append(pg)
    if pg in range(1, len(doc) + 1) and v["tables"] != tabs.get(pg, 0): tp.append(pg)
for pg in fp: doc[pg - 1].get_pixmap(dpi=100, colorspace=fitz.csGRAY).save(f"adj/p-{pg:03d}.png")
for pg in tp: doc[pg - 1].get_pixmap(dpi=130).save(f"adj/t-{pg}.png")
json.dump([dict(id=m["id"], bbox_pt=m["bbox_pt"], caption=m["caption"], kind=m.get("kind")) for pg in fp for m in fig.get(pg, [])], open("adj/current_figures.json", "w"), indent=1)
json.dump(dict(figure_pages=fp, table_pages=tp), open("adj/disagreements.json", "w"), indent=1)
print("figure disagreements", len(fp), "table disagreements", len(tp))
