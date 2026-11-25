# RPSTL notes: for Repair Parts and Special Tools Lists. prep copies it into specs/; point the figure and table agents at it; it overrides FIG_SPEC and TBL_SPEC where they differ.

Typical layout (written for TM 9-2815-237-34P; check the contents list of a new manual): an
introduction (WP 0001), then one work package per figure: an illustration plate ("Figure N. Title."
printed at the bottom, no page folio) followed by its parts list pages, then Bulk items and Kits,
special tools (their own figures), and two cross-reference indexes (National Stock Number index,
Part Number index). Printed page numbers are work-package folios like "0002 00-1"; plates show
only "0002 00" in the header.

## Figures (FIG_SPEC)
- Callouts are BARE numbers at the end of a leader line, not circled. Read them on the plate.
- The key comes from the parts list that follows the plate (rows headed "FIG. N ..."), not from step
  text. One entry per item number shown on the plate. Label = the item's nomenclature, the first
  part of column (6) before any qualifier, written in sentence case with a space after each comma:
  "WASHER,FLAT" -> "Washer, flat". The print truncates nomenclature at 19 characters
  ("SCREW,CAP,HEXAGON H"); complete a truncated last word only when the full word is certain
  ("Screw, cap, hexagon head") and add a note; otherwise keep it as printed.
- An item number with several rows (different years, engines or part numbers): one entry, the first
  row's nomenclature; if the nomenclature differs between rows, list the others in notes.
- Footnote markers like "*a" are keyed by a legend on the plate ("*a PART OF ITEM 1"): keep the entry
  with "n": "*a", "label": null, and put the legend text in notes.
- Bracket boxes ("1 -> 2 thru 6", an assembly and its parts) are not callouts; mention them in notes.
- Caption: the printed "Figure N. Title." on the plate is authoritative; caption_fix it if the
  manifest caption is missing or different. "(Sheet 1 of 2)" plates keep the sheet text.
- Every numbered item in the parts list should appear on the plate. List any that do not in notes.

## Tables (TBL_SPEC)
- Parts list pages: one table per figure. table_key "fig-N-parts" (N = the FIG. number); for the
  Bulk and Kits lists use "bulk-parts" and "kits-parts". label "Figure N parts list" (or "Bulk items
  parts list", "Kits parts list"). title = the figure title as printed in the FIG. line. Each page is
  its own id; later pages of the same list use the same table_key and continues_from.
- columns exactly: ["Item no","SMR code","NSN","CAGEC","Part number","Description and usable on codes (UOC)","Qty"]
- The "GROUP 01 ENGINE 0100 ENGINE ASSEMBLY FIG. 1 ENGINE AND CONTAINER ASSEMBLY" line is a
  {"group": ...} row, text as printed.
- One row per parts entry. Column (6) joins every wrapped line of that entry with single spaces, in
  printed order, including qualifiers, "UOC:..." lists and notes. Drop dot leaders (runs of 3 or more
  dots) and nothing else. NSN as printed (13 digits, no dashes). "END OF FIGURE" is not a row.
- Cross-reference indexes ARE tables here (override of "index pages are not tables"): table_key
  "nsn-index" and "part-number-index", columns as printed in their header
  (e.g. ["CAGE","Part number","Stock number","Figure no","Item no"]), one row per line.
- Introduction pages: tables only where there is a real grid (code tables); prose is not a table.
- The DA Form 2028 sample pages are forms: list them under not_tables.
