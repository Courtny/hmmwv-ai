# Orchestration (Claude follows this after `run_capture.py ... prep`)

Work dir has: out/ (figures, pages, manifest), specs/ (agent instructions with paths filled in), plan.json (page batches), tbl/ audit/ figv/ adj/.
Use a mid-tier model for builders and verifiers; a stronger model for the blind second table pass, the audit, and adjudication. Tell every agent to save its JSON after every few pages. Run independent agents in parallel.

1. FIGURE VERIFY. One agent per range in plan.json `figure_verifiers`. Prompt: "Follow specs/FIG_SPEC.md for pdf pages A-B. Write {work}/figv/out/G{n}.json."
2. TABLES PASS 1. One agent per range in `table_transcribers`. Prompt: "Follow specs/TBL_SPEC.md for pages A-B. Write {work}/tbl/out1/{letter}.json."
3. TABLES PASS 2 (blind, stronger model, can run with 1-2 in parallel). Same ranges, same spec, output tbl/out2/{letter}.json. Forbid reading tbl/out1.
4. AUDIT. One stronger agent (or two halves) following specs/AUDIT_SPEC.md. Writes audit/counts.json. Forbid reading out/, tbl/out*, figv/.
5. `python3 -I run_capture.py PDF WORK adjprep` then `python3 -I diff_tables.py` (cwd=work, env TM_TBL=tbl). Review tbl/diff_report.json: settle every real cell difference against the page scan. Where out1 and out2 disagree, correct out2 (the canonical pass) and add a note; never keep a silent fix.
6. ADJUDICATE. One agent for figure_pages (specs/ADJ_SPEC.md -> adj/figure_actions.json). One agent for table_pages (specs/ADJ_TBL.md -> tbl/out2/ADJ.json). If table_pages is empty, skip. If figure_pages is empty write {"pages":[]}.
7. Edit config.json for this manual: signature_pages, table_drop (duplicates found in adjudication), source_problems (blank pages, missing figures or tables the text refers to, printed typos, numbers that look wrong), representation_notes.
8. `python3 -I run_capture.py PDF WORK build` (finalize encodes lossless WebP: it can take minutes, run it in the background).
9. Spot-check: open 10 random figures and 5 tables against the page, confirm counts in review.md, then send the zip of out/ (images, tables, excluded, pages, data, web, manual.md, captions.md, tables.md, manifest.json, review.md) with a short summary: counts, open issues, next steps.

Parts manuals (RPSTL, folios like "0002 00-1"): prep puts RPSTL_NOTES.md in specs/; tell the figure and table agents to follow it with their spec. Callouts there are bare numbers, keys come from the parts list after each plate, and the cross-reference indexes are tables.
`build` can be re-run after editing agent outputs (it starts from figv/manifest_v1.json).

Notes: merge_fig.py expects every v1 figure id from figv/manifest_v1.json to appear in the verifier output; ids that don't match are listed as unmatched. Tables in Appendix-style vector blocks ("Figure C-2" data blocks) are tables, not figures.
9. Optional: `python3 -I run_capture.py PDF WORK vectorize` traces every figure to a two-tone SVG in out/svg named by figure ID (potracer, no hand-off, about 5 to 15 s per figure). Needs `pip install potracer`. Output drops straight into the repo's `scripts/tm_diagrams.py ingest` flow; callout detection and review still happen there.
