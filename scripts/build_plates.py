"""Build the interactive plates of a parts manual (RPSTL) from its reviewed diagrams.

Each illustration plate with a traced SVG and reviewed callouts becomes a diagram the work
package page shows beside its parts list: tapping a callout finds the item's rows in the list,
and a row finds its callout. The key names come from the parts list (the capture's figure key).

Reads:  data/manuals/<tm>.json          (scripts/import_manual.py)
        diagrams/<tm>/<id>.json         (reviewed callouts, scripts/tm_diagrams.py)
        assets/diagrams/<tm>-<id>-*.svg (emitted traces)
Writes: data/manuals/<tm>-plates.json

Usage:  .venv/bin/python scripts/build_plates.py tm-9-2815-237-34p
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from build_procedures import diagram  # noqa: E402


def main() -> None:
    tm = sys.argv[1]
    data = json.loads((ROOT / "data" / "manuals" / f"{tm}.json").read_text())
    credit = f"US Army technical manual {tm.upper().replace('TM-', 'TM ', 1)}"
    plates, skipped = [], []
    for p in sorted((ROOT / "diagrams" / tm).glob("*.json")):
        reviewed = json.loads(p.read_text())
        fid = reviewed["id"]
        unsure = [r for r in reviewed["rings"] if r.get("confidence", 0) < 0.95]
        if unsure or reviewed.get("missing"):
            skipped.append(f"{fid} (review not finished)")
            continue
        d = diagram(tm, fid, reviewed, data["figures"].get(fid, {}), credit)
        if not d:
            skipped.append(f"{fid} (no emitted trace)")
            continue
        # Keep every key entry, also items the plate names only in a bracket, so the list matches.
        labels = {str(c["n"]): c.get("label") for c in reviewed["key"]}
        d["parts"] = [{"n": n, "name": labels[n] or f"Item {n}"} for n in labels]
        d["notes"] = reviewed.get("review_notes") or []
        plates.append(d)
    out = ROOT / "data" / "manuals" / f"{tm}-plates.json"
    out.write_text(json.dumps({"manual": tm, "plates": plates}, indent=1) + "\n")
    print(f"{len(plates)} plates -> {out.relative_to(ROOT)}")
    for s in skipped:
        print("  skipped", s)


if __name__ == "__main__":
    main()
