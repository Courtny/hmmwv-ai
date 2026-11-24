# Figure verification and callout-key spec ({TITLE})

Inputs (all under {WORK}):
- out/manifest.json  list of figure records (id, pdf_page, caption, paragraph, subsection, callouts (noisy regex guesses), legend_lines, size_px, source_images)
- out/images/<id>.png  the figure, extracted exactly as embedded in the PDF (1-bit, 300 ppi). Large drawings that the PDF stored as stacked strips were already stitched.
- out/scans/p-NNN.png  100 dpi grayscale page render (NNN = PDF page), exists for every page that has figures
- out/pages/page-NNN.md  the page text (steps, warnings) from the PDF text layer. Callout numbers in the drawing refer to the parenthesised numbers in these steps, e.g. "fuel injection nozzles (6)".

For EVERY figure whose pdf_page is in your range:
1. Look at the page scan first, then the figure crop if you need detail. Decide:
   - crop_ok: is the figure complete (nothing cut off, no second unrelated figure glued in, no stray text/rules)? If not, say what is wrong in crop_issue.
   - kind: exploded view | assembly view | photo | decal/label | diagram/chart | symbol/icon | other
   - caption_ok: the caption in the manifest is derived from the paragraph heading above the figure. Is that the right heading for this picture? If the page carries a printed "Figure x" label or the drawing obviously illustrates a different step/subsection, give caption_fix.
2. Write the callout key. Callouts are the circled numbers or letters inside the drawing. Build a clean list {"n": "6", "label": "Fuel injection nozzle"} by reading the drawing together with the step text on the page.
   - One entry per callout shown in the drawing. Labels are nomenclature only (noun phrase, as written in the manual), no verbs, no step text.
   - Keep singular/plural as the manual writes it. If the same number is called out twice in the drawing keep one entry.
   - Lettered callouts (A, B, C ...) are keyed by a legend list beside the art (all-caps names). The circled letters are not in the text layer, so assign each letter to its legend name by looking at the drawing and the legend order; report confidence.
   - If a callout appears in the drawing but no text names it, use "label": null and add a note. If the drawing has no callouts, use an empty list.
   - Never invent names. If you cannot tell, label null.
3. alt: one plain sentence describing the picture for a web page (what part, what view). No marketing language.
4. If a figure on the page is missing from the manifest (you can see a drawing that has no figure record), add it under "missing_figures" with a short description and rough position.

Write ONE json file to the output path you are given, saving after every few pages:
{"range":[first,last],"figures":[
 {"id":"p040-img01","crop_ok":true,"crop_issue":null,"kind":"exploded view","caption_ok":true,"caption_fix":null,
  "callouts":[{"n":"5","label":"Cylinder head"}],"callout_confidence":0.9,"alt":"Exploded view of fuel injection nozzles, hoses and clamps on one cylinder head.","notes":[]}],
 "missing_figures":[{"pdf_page":0,"description":"","position":""}]}
Your final reply is one line with counts (figures checked, crop problems, caption fixes, low-confidence keys). Do not paste data.
