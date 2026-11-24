# Figure adjudication ({TITLE})
A blind auditor counted illustrations per page and disagreed with the extraction on the pages below. Decide, per page, what the correct set of figures is.

Inputs:
- {WORK}/adj/p-NNN.png : 100 dpi page scans (612x792 pt page; so pt = px * 0.72). Look at them with Read. Crops of extracted figures are in {WORK}/out/images/<id>.png.
- {WORK}/adj/current_figures.json : current extraction on these pages (id, bbox_pt [x0,y0,x1,y1] in PDF points, caption, kind).
- Page text: {WORK}/out/pages/page-NNN.md

A "figure" = one distinct illustration (drawing, exploded view, photo, decal). Insets/magnified detail circles that belong to a main drawing are part of that drawing, not separate figures. Do NOT count rules, heading boxes, page borders, table grids, signatures, forms, or page-number glyphs. Two views that are clearly one split drawing (halves with a shared outline) should be merged.

For EACH page, output one entry:
{"pdf_page":33,"audit_count":2,"extracted_count":3,"verdict":"audit right|extraction right|both defensible","actions":[
   {"op":"keep","id":"p033-img01"},
   {"op":"merge","ids":["p115-img01","p115-img02"],"reason":"two halves of one split view"},
   {"op":"exclude","id":"p264-img01","reason":"signature block"},
   {"op":"add","bbox_pt":[x0,y0,x1,y1],"caption":"","kind":"","alt":"one plain sentence","callouts":[{"n":"1","label":"..."}],"reason":"missed small drawing"},
   {"op":"resize","id":"p047-img01","bbox_pt":[x0,y0,x1,y1],"reason":"crop includes a second drawing that should be its own figure"}],
 "note":"short"}
Be conservative: only propose add/merge/exclude/resize when you can see it on the scan. bbox_pt must be tight around the drawing including its callouts. For "add" write callout labels only if the page text names them; otherwise empty list.
Write {WORK}/adj/figure_actions.json as {"pages":[...entries...]} and save after every 5 pages. Final reply: one line of counts per op type.
