#!/usr/bin/env python3
import json, os, re, shutil, fitz
import os; PDF = os.environ["TM_PDF"]; OUT = os.environ.get("TM_OUT","out"); DPI = 300
doc = fitz.open(PDF)
M = json.load(open(f"{OUT}/manifest.json")); json.dump(M, open(f"{OUT}/manifest_before_adjudication.json", "w"), indent=1)
ACT = {e["pdf_page"]: e for e in json.load(open("adj/figure_actions.json"))["pages"]}
by = {}
for m in M: by.setdefault(m["pdf_page"], []).append(m)

def position(rc, W, H):
    return f"{'top' if rc.y0 < H/3 else 'middle' if rc.y0 < 2*H/3 else 'bottom'}-{'left' if rc.x0 < W/3 else 'right' if rc.x0 > W/2 else 'centre'}"

def render(pno, rc, path):
    scratch = fitz.open(PDF); sp = scratch[pno]
    rc = fitz.Rect(rc)
    for w in sp.get_text("words"):
        wr = fitz.Rect(w[:4]); t = w[4].strip()
        if (wr & rc).get_area() > 0.5 * wr.get_area() and re.fullmatch(r"\(?(\d{1,2}|[A-Z])\)?", t): continue
        sp.add_redact_annot(wr, fill=(1, 1, 1))
    sp.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
    W, H = sp.rect.width, sp.rect.height
    clip = fitz.Rect(max(0, rc.x0-3), max(0, rc.y0-3), min(W, rc.x1+3), min(H, rc.y1+3))
    cp = sp.get_pixmap(dpi=DPI, clip=clip, colorspace=fitz.csGRAY); cp.save(path); scratch.close()
    return [cp.width, cp.height]

final = []
changed_pages = set(ACT)
for m in M:
    if m["pdf_page"] not in changed_pages: final.append(m)
log = []
for pg, e in sorted(ACT.items()):
    pno = pg - 1; W, H = doc[pno].rect.width, doc[pno].rect.height
    figs = {m["id"]: dict(m) for m in by.get(pg, [])}
    consumed = set(); newf = []
    for a in e["actions"]:
        op = a["op"]
        if op == "resize":
            figs[a["id"]]["bbox_pt"] = a["bbox_pt"]; figs[a["id"]].setdefault("notes", []).append("crop adjusted after audit adjudication: " + a.get("reason", ""))
        elif op == "exclude":
            m = figs.pop(a["id"]); consumed.add(a["id"])
            r = fitz.Rect(m["bbox_pt"]); os.makedirs(f"{OUT}/excluded", exist_ok=True)
            shutil.copy(f"{OUT}/{m['file']}", f"{OUT}/excluded/{m['id']}-excluded.png"); log.append(f"excluded {m['id']}: {a.get('reason','')}")
        elif op == "merge":
            ids = a["ids"]; base = figs[ids[0]]
            r = fitz.Rect(base["bbox_pt"])
            for i in ids[1:]:
                o = figs.pop(i); r |= fitz.Rect(o["bbox_pt"])
                have = {(c["n"], c["label"]) for c in base["callouts"]}
                base["callouts"] += [c for c in o["callouts"] if (c["n"], c["label"]) not in have]
                base["notes"] += o.get("notes", [])
            base["bbox_pt"] = [round(v, 1) for v in r]; base["notes"].append(f"merged {', '.join(ids)} after audit adjudication: {a.get('reason','')}")
            log.append(f"merged {ids}")
        elif op == "add":
            newf.append(dict(id=None, type="figure", pdf_page=pg, printed_page=(by[pg][0]["printed_page"] if pg in by else None), bbox_pt=a["bbox_pt"], page_pt=[W, H],
                             caption=a.get("caption") or None, caption_source="visual check", kind=a.get("kind"), alt=a.get("alt"),
                             callouts=[dict(n=str(c["n"]), label=c.get("label")) for c in a.get("callouts", [])], callout_confidence=0.8,
                             paragraph=None, subsection=None, figure_label=None, figure_title=None, source_images=[],
                             notes=["added after blind audit found a drawing the first extraction missed: " + a.get("reason", "")], confidence=0.8, needs_review=False))
            log.append(f"added on p{pg}")
    allf = list(figs.values()) + newf
    allf.sort(key=lambda m: (round(m["bbox_pt"][1] / 20), m["bbox_pt"][0]))
    # clear this page's old images, re-render all of its figures
    for old in by.get(pg, []):
        p = f"{OUT}/{old['file']}"
        if os.path.exists(p): os.remove(p)
    for k, m in enumerate(allf, 1):
        m["id"] = f"p{pg:03d}-img{k:02d}"; m["file"] = f"images/{m['id']}.png"
        m["size_px"] = render(pno, m["bbox_pt"], f"{OUT}/{m['file']}")
        rc = fitz.Rect(m["bbox_pt"]); m["position"] = position(rc, W, H); m["page_pt"] = [W, H]
        m["notes"] = list(dict.fromkeys(m.get("notes", [])))
        final.append(m)
final.sort(key=lambda m: (m["pdf_page"], m["id"]))
json.dump(final, open(f"{OUT}/manifest.json", "w"), indent=1)
print("\n".join(log)); print("figures now", len(final), "on", len({m['pdf_page'] for m in final}), "pages")
