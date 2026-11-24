#!/usr/bin/env python3
"""Cell-by-cell diff of first-pass (out1) and blind second-pass (out2) table transcriptions.
Writes tbl/diff_report.json and prints a summary. Tables are matched by pdf_page and order on the page."""
import json, glob, re, os, collections

import os; BASE = os.environ.get("TM_TBL","tbl")


def load(d):
    tabs, notab = [], []
    for f in sorted(glob.glob(f"{BASE}/{d}/*.json")):
        j = json.load(open(f))
        tabs += j.get("tables", [])
        notab += j.get("not_tables", [])
    return tabs, notab


def norm(s):
    s = "" if s is None else str(s)
    return re.sub(r"\s+", " ", s).strip()


def loose(s):
    return re.sub(r"[\s ]+", "", norm(s)).replace("’", "'").replace("–", "-").replace("—", "-")


def flat(t):
    """flatten to list of (kind, cells) rows"""
    out = []
    for r in t["rows"]:
        if "group" in r:
            out.append(("group", [norm(r["group"])]))
        else:
            out.append(("row", [norm(c) for c in r["cells"]]))
    return out


a_tabs, a_not = load("out1")
b_tabs, b_not = load("out2")
by_page_a = collections.defaultdict(list)
by_page_b = collections.defaultdict(list)
for t in a_tabs: by_page_a[t["pdf_page"]].append(t)
for t in b_tabs: by_page_b[t["pdf_page"]].append(t)

report = dict(pages=[], summary={})
tot_cells = same = loose_same = differ = 0
struct_issues = []
for page in sorted(set(by_page_a) | set(by_page_b)):
    A, B = by_page_a.get(page, []), by_page_b.get(page, [])
    if len(A) != len(B):
        struct_issues.append(dict(page=page, issue="table count differs", first=len(A), second=len(B),
                                  first_ids=[t["id"] for t in A], second_ids=[t["id"] for t in B]))
    for ta, tb in zip(A, B):
        fa, fb = flat(ta), flat(tb)
        entry = dict(page=page, id=ta["id"], second_id=tb["id"], label=ta.get("label"), rows_first=len(fa), rows_second=len(fb),
                     cols_first=len(ta["columns"]), cols_second=len(tb["columns"]), cell_diffs=[], header_diffs=[])
        for i, (x, y) in enumerate(zip(ta["columns"], tb["columns"])):
            if norm(x) != norm(y):
                entry["header_diffs"].append(dict(col=i, first=norm(x), second=norm(y)))
        if len(fa) != len(fb):
            struct_issues.append(dict(page=page, id=ta["id"], issue="row count differs", first=len(fa), second=len(fb)))
        for ri, (ra, rb) in enumerate(zip(fa, fb)):
            ka, ca = ra; kb, cb = rb
            if ka != kb:
                entry["cell_diffs"].append(dict(row=ri, kind="row-vs-group", first=ca, second=cb)); differ += 1
                continue
            if len(ca) != len(cb):
                entry["cell_diffs"].append(dict(row=ri, kind="width", first=ca, second=cb)); differ += 1
                continue
            for ci, (x, y) in enumerate(zip(ca, cb)):
                tot_cells += 1
                if x == y: same += 1
                elif loose(x) == loose(y): loose_same += 1; same += 1
                else:
                    differ += 1
                    entry["cell_diffs"].append(dict(row=ri, col=ci, first=x, second=y,
                                                    row_label=ca[0] if ca else ""))
        report["pages"].append(entry)

report["struct_issues"] = struct_issues
report["not_tables_first"] = a_not
report["not_tables_second"] = b_not
report["summary"] = dict(tables_first=len(a_tabs), tables_second=len(b_tabs), cells_compared=tot_cells, identical=same,
                         whitespace_or_punct_only=loose_same, differing=differ,
                         tables_with_diffs=sum(1 for e in report["pages"] if e["cell_diffs"] or e["header_diffs"]))
json.dump(report, open(f"{BASE}/diff_report.json", "w"), indent=1)
print(json.dumps(report["summary"], indent=1))
print("structure issues:", len(struct_issues))
for s in struct_issues[:20]: print(" ", s)
for e in report["pages"]:
    if e["cell_diffs"] or e["header_diffs"]:
        print(f"p{e['page']} {e['id']} ({e['label']}): {len(e['cell_diffs'])} cell diffs, {len(e['header_diffs'])} header diffs")
