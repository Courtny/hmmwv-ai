#!/usr/bin/env python3
"""Driver for capture-technical-manual.
  python3 -I run_capture.py <manual.pdf> <workdir> <stage> [title]
Stages:
  extract   text, figures (rendered), headings, manifest        [script]   -> then run `prep`
  prep      agent inputs, contact sheets, plan.json, specs/     [script]
  (agents)  see ORCHESTRATION.md: verify, tables x2, audit
  adjprep   after audit/counts.json: disagreement pages + inputs [script]
  (agents)  adjudicate figures and tables
  build     merge_fig, apply_actions, build_tables, finalize     [script]
  all-scripts  extract + prep
"""
import os, sys, shutil, subprocess, json, fitz
pdf, work, stage = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2]), sys.argv[3]
title = sys.argv[4] if len(sys.argv) > 4 else os.path.splitext(os.path.basename(pdf))[0]
kit = os.path.dirname(os.path.abspath(__file__))
os.makedirs(work, exist_ok=True)
for f in os.listdir(kit):
    if f.endswith(".py") and f != "run_capture.py" or f in ("ORCHESTRATION.md", "config.example.json"):
        shutil.copy(os.path.join(kit, f), work)
if not os.path.exists(f"{work}/config.json"):
    json.dump(dict(title=title, subtitle="", profile=None, signature_pages=[], table_drop={}, source_problems=[], representation_notes=[]), open(f"{work}/config.json", "w"), indent=1)
env = dict(os.environ, TM_PDF=pdf, TM_OUT="out", TM_TBL="tbl")
def run(*a): subprocess.run(["python3", "-I", *a], cwd=work, env=env, check=True)
def specs():
    n = len(fitz.open(pdf)); os.makedirs(f"{work}/specs", exist_ok=True)
    for f in os.listdir(kit):
        if f.endswith(".md") and f.endswith(("SPEC.md", "ADJ_TBL.md")):
            t = open(f"{kit}/{f}").read().replace("{WORK}", work).replace("{PDF}", pdf).replace("{TITLE}", title).replace("{N}", str(n))
            open(f"{work}/specs/{f}", "w").write(t)
if stage in ("extract", "all-scripts"): run("extract.py", pdf, "out")
if stage in ("prep", "all-scripts"): run("prep.py", pdf); specs(); print("agent specs in", work + "/specs", "; batches in plan.json; follow ORCHESTRATION.md")
if stage == "adjprep": run("adjprep.py", pdf)
if stage == "build":
    for s in ("merge_fig.py", "apply_actions.py", "build_tables.py", "finalize.py"): run(s)
    print("DONE: web package in", work + "/out/web")
