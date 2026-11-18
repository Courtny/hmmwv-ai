# hmmwv.ai

Next.js (App Router, TypeScript) static reference site built from a scanned Humvee book. Phase 0 only: no server, no database.

## Run
npm install && npm run dev   (http://localhost:3000)
npm run build                (static export to /out)

## Rules
- Content comes from /data/*.json. Do not hand-edit them. Read data/DATA-README.md first.
- Every image has an ID (p127-img01) and a credit. Always render the credit beside the image.
- Table values stay as printed in the book, typos included. Repair only at render time.
- Style: paper ground, olive and rust accents, Barlow Condensed headings, IBM Plex body. No em dashes in copy.
- Remove `output: "export"` in next.config.mjs when adding server features (forum, Supabase, Clerk).

## First task
Join the series tables so each variant page shows engine and performance like the M1025 prototype: map each designation to its series (M998, M998A1, M998A2) and pull the matching columns from tables 3, 8 and 9 in data/tables_data.json. Skip swept volume (Table 1 and Table 3 disagree). See README.md TODO for the rest.
