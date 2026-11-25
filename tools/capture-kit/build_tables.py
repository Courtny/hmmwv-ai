#!/usr/bin/env python3
import json, glob, os, re, csv, shutil, fitz, collections
import os; PDF = os.environ["TM_PDF"]; OUT = os.environ.get("TM_OUT","out"); DPI = 300
doc = fitz.open(PDF)
CFG = json.load(open("config.json")) if os.path.exists("config.json") else {}
PROFILE = CFG.get("profile")
for d in ("tables", "data/tables"):
    shutil.rmtree(f"{OUT}/{d}", ignore_errors=True); os.makedirs(f"{OUT}/{d}")
T = []
for f in sorted(glob.glob("tbl/out2/*.json")):
    for t in json.load(open(f))["tables"]:
        t["_src"] = os.path.basename(f); T.append(t)
drop = {tuple(k.split("|")): v for k, v in CFG.get("table_drop", {}).items()}   # "A.json|p008-tbl01": reason
T = [t for t in T if (t["_src"], t["id"]) not in drop]
# tie-break edits from checking the scan
for t in T:
    if PROFILE == "tm-9-2815-237-34" and t["id"] == "p159-tbl01":
        for i, r in enumerate(t["rows"]):
            if r.get("cells") and r["cells"][3].strip() == "****" :
                t["rows"][i - 1]["cells"][3] = t["rows"][i - 1]["cells"][3].rstrip() + "****"; r["cells"][3] = ""
                t["notes"].append("footnote marker **** is printed just beneath the 0.5 min. value; attached to that value (checked against the scan)")
    if PROFILE == "tm-9-2815-237-34" and t["id"] in ("p258-tbl01", "p259-tbl01"):
        t["notes"].append("two-line ranges: the newton-metre cells print the low and high value on separate lines with no hyphen; kept as printed, joined with a space")
by = collections.defaultdict(list)
for t in T: by[t["pdf_page"]].append(t)
manifest = json.load(open(f"{OUT}/manifest.json")); manifest = [m for m in manifest if m.get("type") != "table"]
struct = json.load(open(f"{OUT}/structure.json")); pp = {s["pdf_page"]: s["printed_page"] for s in struct}
idmap = {}
for pg in sorted(by):
    ts = sorted(by[pg], key=lambda t: t["y_top"])
    for k, t in enumerate(ts, 1):
        nid = f"p{pg:03d}-tbl{k:02d}"; idmap[t["id"]] = nid; t["old_id"] = t["id"]; t["id"] = nid
for t in T:
    if t.get("continues_from"): t["continues_from"] = idmap.get(t["continues_from"], t["continues_from"])
    pg = t["pdf_page"]; W, H = doc[pg - 1].rect.width, doc[pg - 1].rect.height
    clip = fitz.Rect(26, max(0, t["y_top"] - 4), W - 26, min(H, t["y_bottom"] + 4))
    cp = doc[pg - 1].get_pixmap(dpi=DPI, clip=clip, colorspace=fitz.csGRAY); cp.save(f"{OUT}/tables/{t['id']}.png")
    t["file"] = f"tables/{t['id']}.png"; t["size_px"] = [cp.width, cp.height]
    t["printed_page"] = t.get("printed_page") or pp.get(pg)
    manifest.append(dict(id=t["id"], file=t["file"], pdf_page=pg, printed_page=t["printed_page"], type="table", bbox_pt=[round(v, 1) for v in clip],
                         page_pt=[W, H], size_px=t["size_px"], label=t.get("label"), table_key=t["table_key"], title=t.get("title") or t.get("label") or t["table_key"],
                         continues_from=t.get("continues_from"), confidence=t.get("confidence"), notes=t.get("notes", []), needs_review=(t.get("confidence") or 1) < 0.85))
# merge continuations by table_key, write json + csv
groups = collections.OrderedDict()
for t in sorted(T, key=lambda t: (t["pdf_page"], t["y_top"])): groups.setdefault(t["table_key"], []).append(t)
index = []; md = ["# Tables\n"]
for key, parts in groups.items():
    cols = parts[0]["columns"]; rows = []; stack = {}
    for t in parts:
        if len(t["columns"]) != len(cols): t["notes"].append("column count differs from the first part")
        for r in t["rows"]:
            r = dict(r); r["source_id"] = t["id"]; r["page"] = t["pdf_page"]; rows.append(r)
    has_group = any("group" in r for r in rows)
    out_rows = []; path = {}
    for r in rows:
        lvl = r.get("level", 1)
        if "group" in r:
            path = {k: v for k, v in path.items() if k < lvl}; path[lvl] = r["group"]; continue
        gp = [path[k] for k in sorted(path) if k < lvl or "level" not in r]
        out_rows.append(dict(group=": ".join(g.rstrip(":") for g in gp) if gp else "", cells=r["cells"], source_id=r["source_id"], page=r["page"]))
    meta = dict(key=key, label=parts[0].get("label"), title=parts[0].get("title") or parts[0].get("label") or key, pages=[t["pdf_page"] for t in parts], source_ids=[t["id"] for t in parts],
                columns=cols, rows=rows, rows_flat=out_rows, footnotes=sum((t.get("footnotes") or [] for t in parts), []), notes=sum((t.get("notes") or [] for t in parts), []),
                confidence=min(t.get("confidence") or 1 for t in parts), printed_as_is=True)
    json.dump(meta, open(f"{OUT}/data/tables/{key}.json", "w"), indent=1)
    with open(f"{OUT}/data/tables/{key}.csv", "w", newline="") as fh:
        w = csv.writer(fh); w.writerow((["group"] if has_group else []) + cols)
        for r in out_rows: w.writerow(([r["group"]] if has_group else []) + r["cells"])
    index.append(dict(key=key, label=meta["label"], title=meta["title"], pages=meta["pages"], source_ids=meta["source_ids"], columns=len(cols), rows=len(out_rows), confidence=meta["confidence"]))
    md.append(f"\n## {meta['label'] or ''} {meta['title']}  \n`{key}`, pages {', '.join(map(str, meta['pages']))}, source {', '.join(meta['source_ids'])}\n")
    md.append("| " + " | ".join((["Group"] if has_group else []) + cols) + " |"); md.append("|" + "---|" * (len(cols) + (1 if has_group else 0)))
    for r in out_rows: md.append("| " + " | ".join(([r["group"]] if has_group else []) + [c.replace("|", "\\|") for c in r["cells"]]) + " |")
    for n in meta["footnotes"]: md.append(f"\n*{n}*")
json.dump(index, open(f"{OUT}/data/tables_index.json", "w"), indent=1)
open(f"{OUT}/tables.md", "w").write("\n".join(md) + "\n")
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=1)
print("tables", len(T), "table_keys", len(groups), "rows", sum(i["rows"] for i in index))
