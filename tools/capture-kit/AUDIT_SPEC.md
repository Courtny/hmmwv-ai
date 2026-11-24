# Blind audit: count figures and tables per page ({TITLE}, {N} pages)

You are an independent auditor. You have NOT seen any extraction results and must not look at {WORK}/out, {WORK}/tbl or {WORK}/figv. Only use the contact sheets.

Inputs: {WORK}/audit/sheets/s-01.png onward (see plan.json audit_sheets). Each sheet shows 6 PDF pages (3 across, 2 down), each labelled "PDF PAGE n".

For every page report:
- figures: number of distinct illustrations (drawings, exploded views, photos, decals, symbols/graphics that are art). Count each separate drawing once, even when it has many callouts. Do NOT count rules, boxes around headings, page borders, or table grids.
- tables: number of distinct data tables or tabular data blocks (grids of rows and columns, parts lists, specification and torque tables, vector data blocks like a "material block" box). Do NOT count prose, forms with blank lines you cannot read as data, or alphabetical index text.
- unsure: true if the sheet resolution does not let you be certain; add a short note.

Be careful with: pages where one large drawing is split by a text step, two drawings stacked in one column, and small icons next to steps.
Write {WORK}/audit/counts.json as {"pages":{"1":{"figures":0,"tables":0,"unsure":false,"note":""}, ... "{N}":{...}}} and save after every 5 sheets. Cover ALL {N} pages. Final reply: totals only (figures, tables, unsure pages).
