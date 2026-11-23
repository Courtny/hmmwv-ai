# TM figure to diagram pipeline

Turns figures from a technical manual capture (the output of the capture-technical-manual
task: `manifest.json`, `images/`, `pages/`) into what a procedure page needs: a two-tone
SVG trace, the callout ring positions, and a draft `Procedure` entry for `lib/procedures.ts`.

VectorMagic has no command line, so the trace step is a hand-off: the tool fills a folder,
you run one VectorMagic batch, the tool picks the SVGs up. potrace is a fallback that runs
on its own (`ingest --potrace`).

## Setup (once)

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/tmdiagrams/requirements.txt
brew install potrace
```

macOS Vision (through pyobjc) reads the callout numbers. tesseract is used too if it is
installed, but it is not needed.

## Workflow

`CAPTURE` is the unzipped capture folder (the one holding `manifest.json`, or its parent).
Work files go to `work/diagrams/<tm>/` (git ignored). Each figure's callouts and review edits
are kept in `diagrams/<tm>/<id>.json`, which is in git, so commit them after a review.

1. **Prep**: choose figures, copy them to `in/`, find and read their callouts.
   ```bash
   .venv/bin/python scripts/tm_diagrams.py prep CAPTURE --pages 190-200 --with-callouts
   ```
   Select with `--ids p193-img01 ...`, `--pages`, `--kind "exploded view"`, `--limit`.
2. **Trace in VectorMagic** (batch mode): add every PNG in `to-trace/` (prep fills it with the figures that have no SVG in `out/` yet), use black-and-white line
   art settings (no blending, high quality, 2 colours), export SVG to `out/` keeping the
   file names. Any uniform scale is fine (VectorMagic exported at half the PNG size):
   ingest scales the callouts to the SVG's viewBox and flags a changed aspect ratio.
3. **Ingest**: check the SVGs (aspect, two colours, white background, size).
   ```bash
   .venv/bin/python scripts/tm_diagrams.py ingest CAPTURE            # VectorMagic only
   .venv/bin/python scripts/tm_diagrams.py ingest CAPTURE --potrace  # potrace for the rest
   ```
4. **Review**: open `review.html` (start the `diagram-review` server in `.claude/launch.json`,
   then go to `http://localhost:8765/<tm>/review.html`). Each figure shows the scan and the
   trace with the detected rings: green read and in the key, amber guessed, red unread.
   Fix a figure by editing `diagrams/<tm>/<id>.json` (set `n`, and `confidence` to 1 once checked;
   delete false rings; add a ring the detector missed with its `x`, `y`, `r`), then
   `review CAPTURE` to rebuild the page. Other fields the review uses:
   - `review_notes`: a list of strings shown on the card (why a key number was dropped, say).
   - `not_callouts: true`: the numbers are not callouts (a torque sequence); emit refuses it.

   `rematch CAPTURE` matches the stored readings to the key again without re-running OCR.
   It keeps rings set to confidence 1, reads decimal callouts ("51" for 5.1), and swaps the
   keys of two figures on one page when each matches the other's key better.
5. **Emit**: copy approved traces to `assets/diagrams/` and write procedure drafts.
   ```bash
   .venv/bin/python scripts/tm_diagrams.py emit CAPTURE --ids p193-img01
   ```
   The draft lands in `drafts/<id>.ts`. Paste it into `procedures` in `lib/procedures.ts`,
   check the steps and names against the page, and keep `draft: true` until reviewed.
   Text is kept as printed (for example "tO 25 lb-ft"); repair it in the entry by hand.

`status CAPTURE` prints counts per stage.

## How callouts are found

`callouts.py` looks for callout rings two ways: round holes in the ink (exact for closed
rings, even with a leader touching) and a Hough circle search (thin rings whose 1-bit scan
has hairline breaks). A candidate must hold a centred glyph, have a thin stroke and clear
paper outside, and match the figure's common ring size. The numbers are set as one line of
words and read with macOS Vision in several layouts; the reading most layouts agree on
wins, and it is matched against the capture's callout key.

On TM 9-2815-237-34 (228 figures with keys, 1,521 rings): 95% of rings are read and in the
key, 159 figures come out clean before review. Most of the rest are problems in the capture's key rather than the
drawing (keys swapped between figures on one page, keys taken from a neighbouring figure,
numbers that are torque sequence positions or a text overlay rather than rings). The review
page lists each one.
