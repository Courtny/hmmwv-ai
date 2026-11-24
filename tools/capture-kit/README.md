# capture-technical-manual kit

Drop in a PDF, run the stages. Scripts do the deterministic work, agents do the checking. Claude follows ORCHESTRATION.md.

    python3 -I run_capture.py manual.pdf ./work all-scripts "Manual title"   # extract + prep
    (agents: verify, tables x2, audit; then adjprep, adjudication)           # see ORCHESTRATION.md
    python3 -I run_capture.py manual.pdf ./work build

Needs: PyMuPDF, pillow, numpy. Works on PDFs with a text layer; scans need OCR first (tesseract).
Per-manual settings live in work/config.json (title, signature pages, tables to drop, source problems).
extract.py heading patterns (HEAD_RE, APPX_RE, SUB_RE) match the numbered paragraphs of US Army TMs (2-15. TITLE);
adjust them for other manuals. Tested end to end on TM 9-2815-237-34 (271 pages); the driver stages were tested on a 20 page slice with stub agent outputs.
