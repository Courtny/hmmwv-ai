# Table transcription spec ({TITLE})

You get a set of PDF pages. For each page you have:
- {WORK}/tbl/pages/p-NNN.png   (110 dpi page image, NNN = PDF page number; look at it with Read)
- {WORK}/tbl/lines/p-NNN.json  (text layer: lines with y0,y1 in PDF points (page 612x792) and words as [x0,x1,text])
Use BOTH: the text layer gives exact characters, the image gives layout (columns, groups, row spans).

## Your job
1. For every page, decide which regions are TABLES (grid of data: specs, calibration data, parts lists, torque limits, wear limits, abbreviation lists with 2+ columns, and the vector "Figure C-n" data blocks in Appendix C which have a printed label like "Figure C-2. Fuel Supply Hose"). Plain index pages and prose are NOT tables: list them under "not_tables" with a reason (index, TOC, prose, authentication page).
2. Give every table an id `p{pdf_page:03d}-tbl{nn}` (nn = reading order on that page, from 01).
3. Transcribe each to JSON exactly as printed. Do NOT correct typos, spellings or odd numbers. Keep units, fractions, plus-minus signs, dashes as printed. If a cell is empty use "". If two cells are merged/spanned, repeat the value in each covered cell and note it in `notes`.
4. Record the vertical extent so we can crop it: `y_top` and `y_bottom` in PDF points taken from the lines json (include the caption and the table's last row, add ~4pt margin).
5. Continuations: if a table continues from the previous page ("Cont'd", repeated header), give the same `table_key` (e.g. "table-2-2") and set `continues_from` to the previous id.

## Output (write ONE json file to the path you are given, save it every few pages, not only at the end)
{
 "pages_done": [..],
 "tables": [
  {"id":"p239-tbl01","pdf_page":239,"printed_page":"2-217","label":"Table 2-3","table_key":"table-2-3","title":"General Repair Standards (6.5L)","continues_from":null,
   "y_top":70.0,"y_bottom":410.5,
   "columns":["Item","Dimension","Limit"],          // flatten multi-row headers with ": " e.g. "Torque: Pound feet"
   "rows":[ {"group":"Cylinder block"}, {"cells":["Bore","4.0625","4.0655"]} ],
   "footnotes":["..."],"notes":["any layout issue, merged cells, illegible bits"],"confidence":0.0-1.0}
 ],
 "not_tables":[{"pdf_page":18,"reason":"table of contents, captured as text"}]
}
Every row's cells length must equal len(columns). Put row-group labels in {"group": "..."} rows.
Report confidence honestly; anything under 0.85 needs a note saying what is unclear.
Final reply: one line with counts (tables, rows, low-confidence). Do not paste the data in your reply.
