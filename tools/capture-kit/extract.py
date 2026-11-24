#!/usr/bin/env python3
"""Extract text, figures (with context captions + callout keys) from a text-layer technical manual PDF.
Usage: python3 -I extract.py in.pdf outdir
Writes: pages/page-NNN.md, manual.md, images/pNNN-imgNN.png, excluded/, manifest.json (figures), structure.json
"""
import sys, os, re, json, shutil
import fitz

PDF, OUT = sys.argv[1], sys.argv[2]
CFG = json.load(open("config.json")) if os.path.exists("config.json") else {}
DPI = 300
Z = DPI / 72.0

for d in ("pages", "images", "excluded", "scans"):
    shutil.rmtree(os.path.join(OUT, d), ignore_errors=True)
    os.makedirs(os.path.join(OUT, d))

doc = fitz.open(PDF)
HEAD_RE = re.compile(r"^((?:\d{1,2}|[A-F])-\d{1,3}(?:\.\d+)?)\.\s+([A-Z0-9(][A-Z0-9 ,/&()'\-\.]+.*)$")   # 2-15. ENGINE DISASSEMBLY
APPX_RE = re.compile(r"^((?:APPENDIX [A-Z]|CHAPTER \d+|Section [IVX]+\.).*)$")
SUB_RE = re.compile(r"^([IVXl]{1,4}|[A-Z])\.\s+([A-Z][A-Za-z0-9 ,/&()'\-]+)$")                      # I. Fuel Injection Nozzles
FIG_RE = re.compile(r"^(Figure|FIGURE)\s+((?:[A-Z0-9]+-)?\d+(?:\.\d+)?)\.?\s*(.*)$")
TAB_RE = re.compile(r"^(Table|TABLE)\s+([A-Z0-9]+-\d+(?:\.\d+)?)\.?\s*(.*)$")
PAGENO_RE = re.compile(r"^(?:[A-Z]|[ivx]+|\d{1,2}|Index)?-?\d{0,3}(?:\.\d+)?(?:/\(.*blank\))?$")
CALL_RE = re.compile(r"([A-Za-z][A-Za-z0-9 /,\-']{2,60}?)\s*\((\d{1,2}|[A-Z])\)")                    # nozzles (6)


import numpy as np

def load_raster(doc, xref):
    try:
        pm = fitz.Pixmap(doc, xref)
        if pm.alpha:
            pm = fitz.Pixmap(pm, 0)
        if pm.colorspace is not None and pm.colorspace.n > 1:
            pm = fitz.Pixmap(fitz.csGRAY, pm)
        return np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width).copy()
    except Exception:
        return None


def stitch(items, tol=1.6):
    """Merge rasters that abut exactly (strips of one drawing). Geometry only; the page render composites them."""
    items = [dict(i) for i in items]
    changed = True
    while changed:
        changed = False
        for i in range(len(items)):
            for j in range(len(items)):
                if i == j: continue
                ra, rb = items[i]["rect"], items[j]["rect"]
                v = abs(ra.x0 - rb.x0) <= tol and abs(ra.x1 - rb.x1) <= tol and abs(rb.y0 - ra.y1) <= tol
                h = abs(ra.y0 - rb.y0) <= tol and abs(ra.y1 - rb.y1) <= tol and abs(rb.x0 - ra.x1) <= tol
                if v or h:
                    items[i] = dict(rect=fitz.Rect(ra) | fitz.Rect(rb), xrefs=items[i]["xrefs"] + items[j]["xrefs"], arr=None)
                    items.pop(j); changed = True
                    break
            if changed: break
    return items


def dedupe(items):
    out = []
    for it in sorted(items, key=lambda i: -(i["rect"].width * i["rect"].height)):
        r = it["rect"]
        if any((fitz.Rect(r) & o["rect"]).get_area() > 0.9 * min(r.get_area(), o["rect"].get_area()) and abs(r.width - o["rect"].width) < 3 and abs(r.height - o["rect"].height) < 3 for o in out):
            continue
        out.append(it)
    return out

def page_blocks(page):
    """Return lines (not blocks): words clustered by y so step numbers rejoin their text."""
    words = page.get_text("words")      # x0,y0,x1,y1,word,block,line,wordno
    words.sort(key=lambda w: ((w[1] + w[3]) / 2, w[0]))
    lines, cur = [], []
    for w in words:
        yc = (w[1] + w[3]) / 2
        if cur and abs(yc - cur[0]) > 3.0:
            lines.append(cur[1:]); cur = []
        if not cur:
            cur = [yc]
        cur.append(w)
    if cur:
        lines.append(cur[1:])
    out = []
    for ln in lines:
        ln.sort(key=lambda w: w[0])
        txt, tab, prev = "", False, None
        for w in ln:
            if prev is not None:
                gap = w[0] - prev[2]
                if gap > 14:
                    txt += " | "; tab = True
                else:
                    txt += " "
            txt += w[4]; prev = w
        out.append(dict(x0=ln[0][0], y0=min(w[1] for w in ln), x1=ln[-1][2], y1=max(w[3] for w in ln), text=txt.strip(), tab=tab))
    return [o for o in out if o["text"]]


def printed_page(blocks, h):
    pat = re.compile(r"^(?:[A-Z]-\d{1,3}|\d{1,2}-\d{1,3}(?:\.\d+)?|[ivx]{1,5}|[a-b]|Index\s?\d+|[A-Z]|\d{1,3})(?:/\(.*blank\))?$")
    cands = sorted([b for b in blocks if b["y0"] > h - 70], key=lambda b: -b["y0"])
    for b in cands:
        t = re.sub(r"\bChange \d+\b", " ", b["text"]).replace("|", " ")
        for tok in reversed(t.split()):
            if pat.match(tok) and tok not in ("TM",):
                return tok
        m = re.search(r"(Index\s+\d+|[A-Z]-\d+|\d-\d+(?:\.\d+)?)", t)
        if m:
            return m.group(1)
    return None


def img_boxes(page):
    boxes = []
    for info in page.get_image_info(xrefs=True):
        r = fitz.Rect(info["bbox"])
        boxes.append(dict(rect=r, w=info["width"], h=info["height"], xref=info.get("xref", 0)))
    return boxes


def cluster(rects, gap=6):
    rects = [fitz.Rect(r) for r in rects]
    changed = True
    while changed:
        changed = False
        out = []
        while rects:
            a = rects.pop()
            merged = True
            while merged:
                merged = False
                for i, b in enumerate(rects):
                    if (a.x0 - gap <= b.x1 and b.x0 - gap <= a.x1 and a.y0 - gap <= b.y1 and b.y0 - gap <= a.y1):
                        a |= b
                        rects.pop(i)
                        merged = True
                        changed = True
                        break
            out.append(a)
        rects = out
    return sorted(rects, key=lambda r: (round(r.y0 / 20), r.x0))


# running headers/footers: short lines near the top or bottom that repeat on many pages
from collections import Counter
_c = Counter()
for _p in doc:
    _H = _p.rect.height
    for _b in page_blocks(_p):
        if _b["y0"] < 50 or _b["y0"] > _H - 60:
            _c[re.sub(r"\d+", "#", _b["text"])] += 1
RUNNING = {t for t, n in _c.items() if n >= max(4, 0.25 * len(doc)) and len(t) > 4}
manifest, structure, page_md = [], [], []
cur_head, cur_sub = None, None
n_pages = len(doc)
for pno in range(n_pages):
    page = doc[pno]
    W, H = page.rect.width, page.rect.height
    pdf_page = pno + 1
    blocks = page_blocks(page)
    pp = printed_page(blocks, H)

    # ---- text + headings -------------------------------------------------------------------
    md, heads_here, figs_text, tabs_text = [f"<a id=\"p{pdf_page:03d}\"></a>", f"<!-- pdf page {pdf_page} | printed page {pp} -->"], [], [], []
    buf, buf_y = [], None
    def flush():
        global buf
        if buf:
            md.append(" ".join(buf)); md.append("")
        buf = []
    STEP = re.compile(r"^(\d{1,2}|[a-z])\.\s")
    for b in blocks:
        s_ = b["text"].strip()
        if not s_ or re.sub(r"\d+", "#", s_) in RUNNING or s_ == pp or re.fullmatch(r"(Change \d+)?\s*" + re.escape(pp or "@@") + r"\s*(Change \d+)?", s_):
            continue
        if APPX_RE.match(s_) and len(s_) < 90 and not b["tab"] and (s_.startswith(("APPENDIX", "CHAPTER")) or s_.startswith("Section")):
            flush(); md.append(f"\n# {s_}\n")
            if s_.startswith("Section"):
                cur_sub = s_
            else:
                cur_head, cur_sub = s_, None
            heads_here.append(dict(kind="para", id=s_.split()[0] + " " + s_.split()[1] if s_.startswith(("APPENDIX", "CHAPTER")) else "Section", title=s_, y=b["y0"])) if s_.startswith(("APPENDIX", "CHAPTER")) else heads_here.append(dict(kind="sub", title=s_, y=b["y0"]))
            continue
        m = HEAD_RE.match(s_)
        if m and len(s_) < 110 and not b["tab"]:
            flush(); cur_head, cur_sub = f"{m.group(1)}. {m.group(2)}", None
            heads_here.append(dict(kind="para", id=m.group(1), title=m.group(2), y=b["y0"]))
            md.append(f"\n## {s_}\n"); continue
        m = SUB_RE.match(s_)
        if m and len(s_) < 70 and (b["x1"] - b["x0"]) < 330:
            flush(); cur_sub = s_
            heads_here.append(dict(kind="sub", title=s_, y=b["y0"]))
            md.append(f"\n### {s_}\n"); continue
        m = FIG_RE.match(s_)
        if m:
            figs_text.append(dict(label=f"Figure {m.group(2)}", title=m.group(3).strip(), y=b["y0"], x=b["x0"]))
        m = TAB_RE.match(s_)
        if m:
            tabs_text.append(dict(label=f"Table {m.group(2)}", title=m.group(3).strip(), y=b["y0"]))
        if re.match(r"^(WARNING|CAUTION|NOTE)\b", s_):
            flush(); md.append(f"> **{s_}**"); md.append(""); continue
        if b["tab"]:
            flush(); md.append(s_); md.append(""); continue
        new_item = bool(STEP.match(s_)) or s_.startswith("\u2022") or s_.startswith("-")
        gap_big = buf_y is not None and (b["y0"] - buf_y) > 15
        if new_item or gap_big:
            flush()
        buf.append(s_); buf_y = b["y1"]
    flush()
    text_md = "\n".join(md)
    open(os.path.join(OUT, "pages", f"page-{pdf_page:03d}.md"), "w").write(text_md + "\n")
    page_md.append(text_md)
    structure.append(dict(pdf_page=pdf_page, printed_page=pp, headings=heads_here, tables=tabs_text, figure_labels=figs_text,
                          head_at_end=cur_head, sub_at_end=cur_sub, words=len(page.get_text().split())))

    # ---- figures -----------------------------------------------------------------------------
    raw = img_boxes(page)
    heading_ys = [(h["y"]) for h in heads_here]
    page_has_table = bool(tabs_text) or any("Table" in b["text"][:6] for b in blocks)
    head_lines = [b for b in blocks if HEAD_RE.match(b["text"]) or SUB_RE.match(b["text"]) or APPX_RE.match(b["text"])]
    big = [r for r in raw if r["rect"].width >= 30 and r["rect"].height >= 30 and r["rect"].width * r["rect"].height >= 2500]
    excl = []
    keep = []
    keep_items = []
    for r in big:
        rc = r["rect"]
        # thin rules/bars and full-page-width banners are not figures
        area = rc.width * rc.height
        has_head = any(rc.x0 - 2 <= (b["x0"] + b["x1"]) / 2 <= rc.x1 + 2 and rc.y0 - 2 <= (b["y0"] + b["y1"]) / 2 <= rc.y1 + 2 for b in head_lines)
        if min(rc.width, rc.height) < 30 or (rc.height < 40 and rc.width > 0.8 * W):
            excl.append(rc)
        elif has_head and area < 45000:       # boxed paragraph heading drawn as a raster
            excl.append(rc)
        elif page_has_table and area < 12000 and min(rc.width, rc.height) < 75:   # table rules / dash glyph strips
            excl.append(rc)
        elif pdf_page in CFG.get("signature_pages", []) and rc.height < 100:   # signature blocks on authentication pages
            excl.append(rc)
        else:
            keep.append(rc); keep_items.append((rc, r["xref"]))
    items = [dict(rect=fitz.Rect(rc), xrefs=[xr], arr=None) for rc, xr in keep_items]
    groups = sorted(dedupe(stitch(items)), key=lambda it: (round(it["rect"].y0 / 20), it["rect"].x0))
    if not groups and not excl:
        continue
    pix = page.get_pixmap(dpi=100, colorspace=fitz.csGRAY)
    pix.save(os.path.join(OUT, "scans", f"p-{pdf_page:03d}.png")) if groups else None
    all_x = {xr for _, xr in keep_items if xr}
    words_all = page.get_text("words")
    for k, g in enumerate(groups, 1):
        rc, xref = g["rect"], (g["xrefs"][0] if g["xrefs"] else 0)
        # expand to catch callout bubbles that are vector/text near the raster
        pad = 3
        crop = fitz.Rect(max(0, rc.x0 - pad), max(0, rc.y0 - pad), min(W, rc.x1 + pad), min(H, rc.y1 + pad))
        scratch = fitz.open(PDF); sp = scratch[pno]
        for xr in all_x - set(g["xrefs"]):
            try: sp.delete_image(xr)
            except Exception: pass
        for w in words_all:
            wr = fitz.Rect(w[:4]); t = w[4].strip()
            inside = (wr & rc).get_area() > 0.5 * wr.get_area()
            if inside and re.fullmatch(r"\(?(\d{1,2}|[A-Z])\)?", t):
                continue                           # circled callout digits/letters drawn as text: keep
            sp.add_redact_annot(wr, fill=(1, 1, 1))
        sp.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
        cp = sp.get_pixmap(dpi=DPI, clip=crop, colorspace=fitz.csGRAY)
        cp.save(os.path.join(OUT, "images", f"p{pdf_page:03d}-img{k:02d}.png"))
        size_px = [cp.width, cp.height]
        scratch.close()
        fid = f"p{pdf_page:03d}-img{k:02d}"
        # context caption: nearest heading above this figure on this page, else carried heading
        above = [h for h in heads_here if h["y"] < rc.y0]
        para = next((h for h in reversed(above) if h["kind"] == "para"), None)
        sub = next((h for h in reversed(above) if h["kind"] == "sub"), None)
        ftxt = [f for f in figs_text if abs(f["y"] - rc.y1) < 80 or abs(f["y"] - rc.y0) < 60 or rc.y0 - 10 <= f["y"] <= rc.y1 + 10]
        # text on this page that touches the figure: steps above/below, used for callouts
        ctx = [b["text"] for b in blocks if not (b["y0"] > rc.y1 or b["y1"] < rc.y0) is False or True]
        callouts, seen = [], set()
        for b in blocks:
            for m in CALL_RE.finditer(b["text"]):
                name, n = m.group(1).strip(" ,-"), m.group(2)
                name = re.sub(r"^(?:and|the|from|on|of|to|with|remove|install|using|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+", "", name, flags=re.I)
                if (n, name) not in seen and len(name) > 2:
                    seen.add((n, name))
                    callouts.append(dict(n=n, label=name))
        legend = []
        for b in blocks:   # all-caps legend lines beside the art; circled callout letters are inline glyphs and lost in text
            t = b["text"].strip()
            if (t.isupper() and 3 < len(t) < 45 and not b["tab"] and not HEAD_RE.match(t) and not t.startswith(("WARNING", "CAUTION", "NOTE", "TM ", "ARMY")) and re.sub(r"\d+", "#", t) not in RUNNING
                    and abs((b["y0"] + b["y1"]) / 2 - (rc.y0 + rc.y1) / 2) < (rc.height / 2 + 140)):
                legend.append(t)
        manifest.append(dict(
            id=fid, file=f"images/{fid}.png", pdf_page=pdf_page, printed_page=pp, type="figure",
            bbox_pt=[round(v, 1) for v in rc], page_pt=[W, H], size_px=size_px,
            position=f"{'top' if rc.y0 < H / 3 else 'middle' if rc.y0 < 2 * H / 3 else 'bottom'}-{'left' if rc.x0 < W / 3 else 'right' if rc.x0 > W / 2 else 'centre'}",
            paragraph=(para or {}).get("title") and f"{para['id']}. {para['title']}" or cur_head,
            subsection=(sub or {}).get("title") or cur_sub,
            figure_label=ftxt[0]["label"] if ftxt else None, figure_title=ftxt[0]["title"] if ftxt else None,
            caption=None, callouts=callouts, legend_lines=legend,
            source_images=[dict(xref=x) for x in g["xrefs"]],
            confidence=0.8, notes=[]))
    for k, rc in enumerate(excl, 1):
        cp = page.get_pixmap(dpi=DPI, clip=fitz.Rect(rc), colorspace=fitz.csGRAY)
        cp.save(os.path.join(OUT, "excluded", f"p{pdf_page:03d}-x{k:02d}.png"))

# caption = figure label/title if printed, else "paragraph, subsection"
for m in manifest:
    if m["figure_label"]:
        m["caption"] = f"{m['figure_label']}. {m['figure_title']}".strip(". ")
    else:
        bits = [x for x in (m["paragraph"], m["subsection"]) if x]
        m["caption"] = " > ".join(bits) if bits else None
        m["notes"].append("caption derived from heading context; no printed figure caption")
    if not m["caption"]:
        m["confidence"] = 0.4
        m["notes"].append("no heading context found")

json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
json.dump(structure, open(os.path.join(OUT, "structure.json"), "w"), indent=1)
open(os.path.join(OUT, "manual.md"), "w").write("\n\n---\n\n".join(page_md) + "\n")
print("pages", n_pages, "figures", len(manifest), "pages with figures", len({m['pdf_page'] for m in manifest}))
print("excluded", len(os.listdir(os.path.join(OUT, "excluded"))))
print("no caption:", sum(1 for m in manifest if not m["caption"]), "with callouts:", sum(1 for m in manifest if m["callouts"]))
