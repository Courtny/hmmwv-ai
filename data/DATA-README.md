# Web-ready content package

Source: a scanned 160-page book (PDF). 286 images (278 photos, 8 diagrams or graphics) and 11 tables, each with a stable ID. Captions were proofread against the page scans in three passes.

## Files
- `content.json`: one object per image, sorted by page.
- `tables.json`: one object per table.
- `content.csv`: the same image data as a flat sheet (the `related` column is joined with "; ").
- `images/`: full-size WebP, quality 85, up to 1255 px wide.
- `thumbs/`: 480 px WebP for grids.
- `tables/`: table images as WebP. Tables are provided as pictures and as transcribed data (see Table data below). The raw `ocr_text` in `tables.json` is noisy; use the transcribed data instead.
- All images and tables are retouched (see below). `original` points at the untouched PNG and `retouched_png` at the lossless retouched PNG, both in the extraction zips (`images/` and `tables/`, and `retouched/images/` and `retouched/tables/`).

## content.json fields
| field | meaning |
|---|---|
| `id` | stable ID, `p{pdf page}-img{n}`; same ID names the image file |
| `kind` | `photo` or `diagram` |
| `page` / `printed_page` | PDF page number / page number printed in the book (null where it could not be read) |
| `position` | direction word printed in the caption (ABOVE, BELOW, LEFT, RIGHT, OPPOSITE and so on) |
| `caption` | caption text as printed; null if the photo has none |
| `credit` | photo credit as printed (for attribution) |
| `alt` | suggested alt text: first sentence of the caption, or a generic "Photo from page N" when there is no caption |
| `alt_source` | `caption` or `generic` (10 generic ones should get hand-written alt text) |
| `confidence` / `needs_review` | confidence that the caption belongs to this photo; `needs_review` is true under 0.7 (6 items) |
| `related` | IDs of linked images: the other half of a spread photo, or a photo sharing a caption. Links are two-way. |
| `notes` | free-text notes from the extraction and review passes |
| `image`, `thumb`, `width`, `height` | file paths and pixel size of the WebP |

## tables.json fields
`id` (`p{page}-tbl{n}`), `page`, `printed_page`, `title`, `table_number`, `notes` (intro and footnote text), `continues_from` / `continues_on` (tables that run onto the next page: TABLE 1 on pages 30 to 31, TABLE 8 on pages 148 to 149), `image`, `width`, `height`, `ocr_text`.

## Table data (`data/`)
All 11 table images are transcribed into structured data, checked by two independent transcriptions and a cell-by-cell diff.
- `data/tables_data.json`: Tables 1 to 9, with title, intro, footnotes, column names, and rows. Group (sub-heading) rows appear as `{"group": ...}`. Table 1 joins pages 30 and 31; Table 8 joins pages 148 and 149. Each row carries `page` and `source_id`.
- `data/tables/table-NN.json` and `.csv`: the same, one table per file. In the CSV each row has its page and its group.
- `data/variants.json`: the 56 rows of Table 1 as one record per vehicle (designation, year, engine, transmission, description, series group, page, footnote marks). Footnote marks: `*` means specified but never put into series production (M996, M996A1); `**` means designated XM1109 UA-HHV during development.
- `printed_as_is` in each table lists text kept exactly as printed even though it looks like a misprint in the book (for example "6,468cc (400i cu in)" in Table 3, "86in (2,184mm" for the M996 height, "24in 610mm)" for the M1025 under-chassis, a missing bracket on one Table 9 fording depth, and a high-looking oil capacity in Table 6). Do not auto-correct these.
- Table 8 headers are flattened as "Group: Sub" (for example "Height: Overall"). Tables 6 and 7 have no printed header row, so their column names were added.
- Table 5 is two side-by-side blocks in the book; rows are stored left block first, then right.

## Retouching
The scans were dark (the brightest pixels in a typical photo reached about 138 of 255). Photos and diagrams were denoised, stretched to full range per color channel, given mild local contrast and lightly sharpened. Tables were only brightened and white-balanced to the paper, so their text and rules are not altered. Colors are approximate, and the retouch does not add detail the scan does not contain.

## Things to know before building the site
- **Image resolution is limited by the scan** (about 140 ppi). Most photos are 400 to 900 px wide, so show them at that size or smaller; they will look soft if stretched.
- **Spread photos:** ten photos run across two facing pages and are stored as two halves, linked through `related` (pages 12 and 13, 24 and 25, 54 and 55, 66 and 67, 70 and 71, 100 and 101, 124 and 125, 138 and 139, 146 and 147, 154 and 155). The caption sits on one half. Stitch them into one image before showing them, or display the halves side by side.
- **Shared captions:** p038-img02 and p038-img03 share one caption ("ABOVE AND RIGHT").
- **Uncaptioned photos:** 10, listed with `caption: null`.
- **Not included:** four publisher logos (page 1, 3, 5 and the back cover) were left out of the set.
- **Back cover:** p160-img02 and p160-img03 are reproductions of book spreads, kept as graphics. You will probably want to leave them off the site.
- **Rights:** the photos and captions are the book's content, credited to AM General, the US Department of Defense and individual photographers. Publishing them on a site needs permission from the rights holders. Keep the `credit` field visible next to each image.

## Technical manuals (`manuals/`)
- `manuals/<tm>.json` is generated by `scripts/import_manual.py` from a capture-technical-manual output. Do not hand-edit; re-run the importer.
- `manuals/<tm>-procedures.json` is generated by `scripts/build_procedures.py`: one interactive procedure per lettered subsection with steps as printed, each tied to one of the procedure's traced diagrams (callouts in viewBox units, key from the reviewed figure in `diagrams/<tm>/`). `coverage` is the share of part numbers in the steps found on their diagram. Do not hand-edit; re-run the script.
- `sections`: the manual split into front matter, one entry per numbered paragraph (for example 2-40), one per appendix, and the index and back matter. Each has `blocks` in page order: `page` (PDF and printed page number), `h`, `p`, `step`, `note` (WARNING, CAUTION, NOTE), `rows` (pipe-separated rows from the text layer, not checked), `fig` and `tbl` (references into `figures` and `tables`).
- `figures`: the capture's 247 figures with caption, alt text and callout key; images in `public/manuals/<tm>/images/` and `thumbs/`.
- `tables`: transcribed tables (values as printed) with crops of the scans in `public/manuals/<tm>/tables/`.
- Text is kept as captured, typos included. The only import-time repair is to headings the PDF text layer letter-spaced (for example "2 - 3 5 . 2 ." and "I N TAKE"), so sections split correctly.
