"""Find circled callouts (numbers or letters in a ring) in 1-bit technical manual line art.

A callout ring is found by its hole: the white disc inside the ring is a near perfect
circle even when a leader arrow touches the outside of the ring. The disc must hold a
small, centred glyph (the number). Each hit is read with tesseract when it is installed
and matched to the figure's expected callout key.

Some manuals (RPSTL parts lists) print callouts as bare numbers at the end of a leader,
with no ring. When a figure has no rings, find_bare_labels() groups digit-sized ink
into words, reads them the same way, and keeps the ones that match the key.
"""
from __future__ import annotations

import math
import re
import shutil
from dataclasses import dataclass, field

import cv2
import numpy as np


@dataclass
class Hit:
    x: float  # centre, image px
    y: float
    r: float  # outer ring radius, image px
    text: str | None = None  # what OCR read, if anything
    n: str | None = None  # assigned callout label
    confidence: float = 0.0
    notes: list[str] = field(default_factory=list)


def load_ink(path: str) -> np.ndarray:
    """Grayscale image to a 0/255 mask where 255 is ink."""
    g = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if g is None:
        raise FileNotFoundError(path)
    _, ink = cv2.threshold(g, 128, 255, cv2.THRESH_BINARY_INV)
    return ink


def find_rings(ink: np.ndarray, min_r: int = 15, max_r: int = 80) -> list[Hit]:
    """Callout rings in a figure.

    Candidates come from two places: round holes in the ink (exact for closed rings,
    even with a leader touching the outside) and a Hough circle search (catches thin
    rings whose 1-bit scan has hairline breaks, so their hole leaks). Every candidate
    then has to look like a callout: a centred glyph inside, a thin stroke, and paper
    just outside on most sides.
    """
    hits: list[Hit] = []

    def add(cx: float, cy: float, r_in: float) -> None:
        if any(math.hypot(cx - o.x, cy - o.y) < o.r for o in hits):
            return
        h = validate(ink, cx, cy, r_in)
        if h:
            hits.append(h)

    for cx, cy, r_in in hole_candidates(ink, min_r, max_r):
        add(cx, cy, r_in)
    for cx, cy, r_in in hough_candidates(ink, min_r, max_r):
        add(cx, cy, r_in)
    return keep_common_size(hits)


def hole_candidates(ink: np.ndarray, min_r: int, max_r: int):
    """Round paper regions fully enclosed by ink."""
    paper = cv2.bitwise_not(ink)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(paper, connectivity=4)
    h, w = ink.shape
    for i in range(1, n):
        x, y, bw, bh, _ = stats[i]
        d = (bw + bh) / 2
        if not (2 * min_r <= d <= 2 * max_r) or x == 0 or y == 0 or x + bw >= w or y + bh >= h:
            continue
        if not (0.85 <= bw / bh <= 1.18):
            continue
        # The hole plus the glyph inside it should fill a disc.
        sub = (labels[y:y + bh, x:x + bw] == i).astype(np.uint8)
        filled = cv2.morphologyEx(sub, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        cnts, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not cnts:
            continue
        c = max(cnts, key=cv2.contourArea)
        area, perim = cv2.contourArea(c), cv2.arcLength(c, True)
        if perim == 0 or 4 * math.pi * area / perim**2 < 0.80 or area < 0.85 * math.pi * (d / 2) ** 2:
            continue
        yield x + bw / 2, y + bh / 2, d / 2


def hough_candidates(ink: np.ndarray, min_r: int, max_r: int):
    """Circles from a Hough search; the inner edge is then measured along rays."""
    blur = cv2.GaussianBlur(ink, (5, 5), 1.5)
    found = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, dp=1, minDist=2 * min_r,
                             param1=120, param2=22, minRadius=min_r, maxRadius=max_r)
    if found is None:
        return
    for cx, cy, r in found[0]:
        r_in = inner_edge(ink, cx, cy, r)
        if r_in:
            yield float(cx), float(cy), r_in


def inner_edge(ink: np.ndarray, cx: float, cy: float, r: float, rays: int = 32) -> float | None:
    """Median distance to the first ink when walking outward from 0.6 r. None if the ring is patchy."""
    h, w = ink.shape
    d = []
    for k in range(rays):
        a = 2 * math.pi * k / rays
        for s in range(int(0.6 * r), int(1.3 * r) + 1):
            px, py = int(round(cx + s * math.cos(a))), int(round(cy + s * math.sin(a)))
            if not (0 <= px < w and 0 <= py < h):
                break
            if ink[py, px]:
                d.append(s)
                break
    if len(d) < 0.8 * rays:
        return None
    med = float(np.median(d))
    # A real ring is round: most rays land on the same radius.
    if sum(abs(v - med) <= max(2.0, 0.08 * med) for v in d) < 0.75 * rays:
        return None
    return med


def validate(ink: np.ndarray, cx: float, cy: float, r_in: float) -> Hit | None:
    """Accept a candidate ring only if it holds a centred glyph and stands in clear paper."""
    h, w = ink.shape
    x0, y0, x1, y1 = int(cx - r_in), int(cy - r_in), int(cx + r_in) + 1, int(cy + r_in) + 1
    if x0 < 0 or y0 < 0 or x1 > w or y1 > h:
        return None
    box = ink[y0:y1, x0:x1].astype(bool)
    bh, bw = box.shape
    yy, xx = np.ogrid[:bh, :bw]
    inside = (xx + x0 - cx) ** 2 + (yy + y0 - cy) ** 2 <= (0.8 * r_in) ** 2
    glyph = box & inside
    fill = glyph.sum() / max(inside.sum(), 1)
    if not (0.03 <= fill <= 0.40):
        return None
    gy, gx = np.nonzero(glyph)
    if abs(gx.mean() + x0 - cx) > 0.25 * r_in * 2 or abs(gy.mean() + y0 - cy) > 0.25 * r_in * 2:
        return None
    gh = gy.max() - gy.min() + 1
    if not (0.7 * r_in <= gh <= 1.7 * r_in):  # numbers are tall relative to the ring
        return None
    stroke, clear = ring_profile(ink, cx, cy, r_in)
    # A callout ring is a thin line with paper outside on most sides (leaders aside).
    # Round part ends sit inside more drawing.
    if stroke < 1 or stroke > 0.35 * r_in or clear < 0.7:
        return None
    return Hit(x=cx, y=cy, r=r_in + stroke)


def ring_profile(ink: np.ndarray, cx: float, cy: float, r_in: float, rays: int = 32) -> tuple[float, float]:
    """Ring stroke width (median over rays) and the share of rays that find paper just outside it."""
    h, w = ink.shape
    runs, clear = [], 0
    for k in range(rays):
        a = 2 * math.pi * k / rays
        ca, sa = math.cos(a), math.sin(a)
        run, s = 0, int(r_in) - 1
        while s < r_in * 1.6:
            px, py = int(round(cx + s * ca)), int(round(cy + s * sa))
            if not (0 <= px < w and 0 <= py < h):
                break
            if ink[py, px]:
                run += 1
            elif run:
                break
            s += 1
        runs.append(run)
        # Paper for a band beyond the stroke.
        band = [(int(round(cx + t * ca)), int(round(cy + t * sa))) for t in range(s + 2, int(s + 2 + r_in * 0.35))]
        if band and all(0 <= px < w and 0 <= py < h and not ink[py, px] for px, py in band):
            clear += 1
    return float(np.median(runs)), clear / rays


def keep_common_size(hits: list[Hit], tol: float = 0.22) -> list[Hit]:
    """Callouts in one figure share a ring size. Drop rings far from the median."""
    if len(hits) < 3:
        return hits
    med = float(np.median([h.r for h in hits]))
    return [h for h in hits if abs(h.r - med) <= tol * med]


def glyph_crop(ink: np.ndarray, hit: Hit) -> np.ndarray:
    """Black-on-white crop of the label inside a ring, ring removed, upscaled and padded."""
    r_in = hit.r * 0.78
    x0, y0 = int(hit.x - r_in), int(hit.y - r_in)
    crop = ink[max(y0, 0):int(hit.y + r_in), max(x0, 0):int(hit.x + r_in)].copy()
    hh, ww = crop.shape
    yy, xx = np.ogrid[:hh, :ww]
    crop[(xx - ww / 2) ** 2 + (yy - hh / 2) ** 2 > (0.82 * min(hh, ww) / 2) ** 2] = 0
    crop = cv2.bitwise_not(crop)
    scale = max(1.0, 90 / hh)
    crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return cv2.copyMakeBorder(crop, 40, 40, 60, 60, cv2.BORDER_CONSTANT, value=255)


# Strip layouts tried in turn: (glyph height px, gap as a multiple of height).
# Vision drops different glyphs in different layouts, so readings are pooled.
_LAYOUTS = [(32, 1.0), (32, 1.6), (24, 1.0), (48, 1.0), (48, 1.6), (40, 1.3)]


def read_labels(ink: np.ndarray, hits: list[Hit], glyphs: list[np.ndarray] | None = None,
                counts: list[int] | None = None) -> None:
    """Fill hit.text for every ring.

    macOS Vision reads lone characters poorly but reads a line of words well. The
    figure's labels are set as one line of words (tight crops, equal height), read in
    several layouts, and each word is mapped back to its ring by position. The reading
    most layouts agree on wins. Rings left unread fall back to tesseract when installed.
    """
    if not hits:
        return
    if glyphs is None:
        glyphs = [tight_glyph(ink, h) for h in hits]
    votes: list[dict[str, int]] = [{} for _ in hits]
    for height, gap in _LAYOUTS:
        g = int(height * gap)
        parts, spans, x = [], [], g
        for c in glyphs:
            c = cv2.resize(c, (max(1, round(c.shape[1] * height / c.shape[0])), height), interpolation=cv2.INTER_AREA)
            parts += [np.full((height, g), 255, np.uint8), c]
            spans.append((x, x + c.shape[1]))
            x += g + c.shape[1]
        parts.append(np.full((height, g), 255, np.uint8))
        strip = cv2.copyMakeBorder(np.hstack(parts), height, height, 0, 0, cv2.BORDER_CONSTANT, value=255)
        read: dict[int, list[tuple[float, str]]] = {}
        for x0, x1, text in vision_words(strip):
            inside = [i for i, (a, b) in enumerate(spans) if a < x1 and b > x0]
            if len(inside) == 1:  # a word that spans two rings is two labels run together
                read.setdefault(inside[0], []).append((x0, x1, text))
        for i, words in read.items():  # a widely spaced "1 1" comes back as two words
            kept: list[tuple[float, float, str]] = []
            for w in sorted(words):  # Vision sometimes returns one word twice
                if not kept or w[0] >= kept[-1][1] - 0.5 * (kept[-1][1] - kept[-1][0]):
                    kept.append(w)
            text = "".join(t for _, _, t in kept)
            votes[i][text] = votes[i].get(text, 0) + 1
    for i, (h, v) in enumerate(zip(hits, votes)):
        if v:
            # With a known glyph count (bare labels), a reading of that length beats a
            # more common shorter one: Vision often reads "11" as "1".
            fits = (lambda t: len(t) == counts[i]) if counts else (lambda t: False)
            text, n = max(v.items(), key=lambda kv: (kv[1] + 1.5 * fits(kv[0]), kv[1]))
            h.text = text
            if len(v) > 1:
                h.notes.append("readings " + ", ".join(f"{t}×{k}" for t, k in sorted(v.items(), key=lambda kv: -kv[1])))
    if shutil.which("tesseract"):
        for h, c in zip(hits, glyphs):
            if not h.text and h.r:
                h.text = ocr_tesseract(glyph_crop(ink, h))


def tight_glyph(ink: np.ndarray, hit: Hit) -> np.ndarray:
    """The label alone, cropped to its ink, black on white."""
    c = glyph_crop(ink, hit)
    ys, xs = np.nonzero(c < 128)
    if not len(ys):
        return c
    return c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def vision_words(img: np.ndarray) -> list[tuple[float, float, str]]:
    """(left x, right x, text) for each space-separated word macOS Vision finds."""
    return [(x0, x1, t) for x0, _, x1, _, t in vision_boxes(img)]


def vision_boxes(img: np.ndarray) -> list[tuple[float, float, float, float, str]]:
    """(x0, y0, x1, y1, text) in image px, top-left origin, for each word Vision finds."""
    try:
        import Quartz
        import Vision
        from Foundation import NSData
    except ImportError:
        return []
    ok, png = cv2.imencode(".png", img)
    if not ok:
        return []
    data = NSData.dataWithBytes_length_(png.tobytes(), len(png))
    cg = Quartz.CGImageSourceCreateImageAtIndex(Quartz.CGImageSourceCreateWithData(data, None), 0, None)
    req = Vision.VNRecognizeTextRequest.alloc().init()
    req.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    req.setUsesLanguageCorrection_(False)
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, None)
    if not handler.performRequests_error_([req], None)[0]:
        return []
    height, width = img.shape[:2]
    out = []
    for obs in req.results() or []:
        cands = obs.topCandidates_(1)
        if not cands:
            continue
        cand = cands[0]
        line = str(cand.string())
        for m in re.finditer(r"\S+", line):
            text = re.sub(r"[^0-9A-Z]", "", m.group().upper())
            if not text:
                continue
            box, _ = cand.boundingBoxForRange_error_((m.start(), m.end() - m.start()), None)
            if box is None:
                continue
            r = box.boundingBox()
            out.append((r.origin.x * width, (1 - r.origin.y - r.size.height) * height,
                        (r.origin.x + r.size.width) * width, (1 - r.origin.y) * height, text))
    return out


def ocr_tesseract(crop: np.ndarray) -> str | None:
    import pytesseract

    cfg = "--psm 8 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    txt = pytesseract.image_to_string(crop, config=cfg).strip()
    return re.sub(r"[^0-9A-Z]", "", txt) or None


def norm(label: str) -> str:
    """A key label as OCR text comes back: letters and digits only, upper case ("*a" -> "A")."""
    return re.sub(r"[^0-9A-Z]", "", label.upper())


def assign(hits: list[Hit], expected: list[str]) -> list[str]:
    """Match OCR text to the expected callout key. Returns expected labels never found."""
    exp = set(expected)
    # Keys with marks OCR drops ("*a" footnote markers): match on letters and digits.
    marked = {norm(e): e for e in exp if norm(e) != e and norm(e) and norm(e) not in exp}
    # Decimal callouts ("5.1"): Vision drops the small point and reads "51".
    undotted = {e.replace(".", ""): e for e in exp if "." in e}
    for h in hits:
        if h.confidence >= 1:  # checked by hand
            continue
        h.n, h.confidence = None, 0.0
        if h.text and h.text in exp:
            h.n, h.confidence = h.text, 0.95
        elif h.text and h.text in marked:
            h.n, h.confidence = marked[h.text], 0.95
        elif h.text and h.text in undotted and h.text not in exp:
            h.n, h.confidence = undotted[h.text], 0.95
            h.notes.append(f"OCR read {h.text!r}, the key has {undotted[h.text]}")
        elif h.text:
            near = [e for e in exp if similar(h.text, e)]
            if len(near) == 1:
                h.n, h.confidence = near[0], 0.6
                h.notes.append(f"OCR read {h.text!r}, assumed {near[0]}")
            else:
                h.notes.append(f"OCR read {h.text!r}, not in the key")
        else:
            h.notes.append("no OCR reading")
    found = {h.n for h in hits if h.n}
    missing = [e for e in expected if e not in found]
    # One unread ring and one missing label: pair them, low confidence.
    unread = [h for h in hits if not h.n]
    if len(unread) == 1 and len(missing) == 1:
        unread[0].n, unread[0].confidence = missing[0], 0.4
        unread[0].notes.append("only unmatched ring, paired with the only missing label")
        missing = []
    return missing


# Common OCR confusions on circled callout digits.
_CONFUSE = {"I": "1", "L": "1", "O": "0", "D": "0", "S": "5", "B": "8", "Z": "2", "G": "6", "T": "7"}


def similar(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    return all(x == y or _CONFUSE.get(x) == y or _CONFUSE.get(y) == x for x, y in zip(a, b))


def find_bare_labels(ink: np.ndarray, expected: list[str]) -> list[Hit]:
    """Callouts printed as bare numbers (no ring), for figures where find_rings finds none.

    Ink blobs of glyph size are grouped into words (shared line, small gaps), each word is
    read with read_labels, and only words that match the key are kept, since a drawing has
    plenty of small blobs. Words in a bracket ("5 thru 11", "2 and 3": an assembly's items)
    or after "ITEM" in a footnote legend are dropped: they name items, they do not point at them.
    """
    if not expected:
        return []
    scale = ink.shape[1] / 2000  # glyph sizes below are for a ~2000 px wide figure
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    glyphs = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if not (14 * scale <= h <= 70 * scale and 3 <= w <= 1.2 * h and area >= 0.12 * w * h):
            continue
        if w < 0.35 * h and area > 0.85 * w * h:  # a plain bar (a tick, a centre line), not a "1"
            continue
        glyphs.append([x, y, x + w, y + h, i])
    # Group glyphs left to right into words: overlapping rows, gap under ~0.6 glyph heights.
    glyphs.sort(key=lambda g: g[0])
    words: list[list[list[int]]] = []
    for g in glyphs:
        gh = g[3] - g[1]
        for wd in words:
            x0, y0, x1, y1 = (min(c[0] for c in wd), min(c[1] for c in wd),
                              max(c[2] for c in wd), max(c[3] for c in wd))
            wh = y1 - y0
            overlap = min(y1, g[3]) - max(y0, g[1])
            if 0 <= g[0] - x1 <= 0.6 * max(wh, gh) and overlap >= 0.4 * min(wh, gh) and max(wh, gh) <= 1.8 * min(wh, gh):
                wd.append(g)
                break
        else:
            words.append([g])
    words = [w for w in words if len(w) <= 4]
    hits, crops, counts = [], [], []
    for wd in words:
        x0, y0 = min(c[0] for c in wd), min(c[1] for c in wd)
        x1, y1 = max(c[2] for c in wd), max(c[3] for c in wd)
        # Only this word's own blobs (a leader or part edge in the box would be read too),
        # set close together: Vision reads a widely spaced "1 1" as one "1".
        gap = np.full((y1 - y0, max(2, round(0.12 * (y1 - y0)))), 255, np.uint8)
        parts = []
        for c in sorted(wd):
            m = lab[y0:y1, c[0]:c[2]] == c[4]
            parts += [np.where(m, 0, 255).astype(np.uint8), gap]
        crop = np.hstack(parts[:-1])
        counts.append(len(wd))
        # Clear paper around: other ink in a margin of half a glyph height. A leader line
        # crosses it, a label drawn inside the art (a cast part number) sits in clutter.
        m = int(0.5 * (y1 - y0)) + 2
        X0, Y0, X1, Y1 = max(x0 - m, 0), max(y0 - m, 0), min(x1 + m, ink.shape[1]), min(y1 + m, ink.shape[0])
        around = (ink[Y0:Y1, X0:X1] > 0) & ~np.isin(lab[Y0:Y1, X0:X1], [c[4] for c in wd])
        clutter = around.sum() / max(1, (X1 - X0) * (Y1 - Y0) - (x1 - x0) * (y1 - y0))
        if clutter > 0.045:  # 0.03 at most on RPSTL callouts, 0.05+ on numbers in the art
            continue
        hits.append(Hit((x0 + x1) / 2, (y0 + y1) / 2, 0.6 * max(x1 - x0, y1 - y0) + 4,
                        notes=["bare number, no ring"]))
        crops.append(crop)
    read_labels(ink, hits, crops, counts)
    # Vision's reading of a word depends on its neighbours in the strip, so words left
    # unread or read short (a lone "1", "11" as "1") get another try among themselves.
    for order in (1, -1):
        redo = [i for i, h in enumerate(hits) if not h.text or len(h.text) < counts[i]][::order]
        if not redo:
            break
        again = [Hit(hits[i].x, hits[i].y, hits[i].r) for i in redo]
        read_labels(ink, again, [crops[i] for i in redo], [counts[i] for i in redo])
        for i, h in zip(redo, again):
            if h.text and (not hits[i].text or len(h.text) > len(hits[i].text)):
                hits[i].text = h.text
                hits[i].notes.append(f"read {h.text!r} on a second pass")
    # Brackets ("5 thru 11", "2 and 3") and footnote legends ("*a PART OF ITEM 1") name items,
    # they do not point at them. Vision reads these words well across the whole figure.
    words_all = vision_boxes(cv2.bitwise_not(ink))
    brackets = [b[:4] for b in words_all if b[4] in ("THRU", "THR", "HRU", "TH", "RU", "AND", "OR")]
    legends = [b[:4] for b in words_all if b[4] in ("ITEM", "ITE", "TEM")]
    keys = set(expected) | {norm(e) for e in expected}
    out = []
    for h in hits:
        if any(abs(h.y - (y0 + y1) / 2) < 3.5 * (y1 - y0) and x0 - 5 * (y1 - y0) < h.x < x1 + 2 * (y1 - y0)
               for x0, y0, x1, y1 in brackets):
            continue
        if any(abs(h.y - (y0 + y1) / 2) < 0.8 * (y1 - y0) and x1 - 5 < h.x < x1 + 4 * (y1 - y0)
               for x0, y0, x1, y1 in legends):
            continue
        if h.text in keys:  # exact only: a near miss on a bare blob is usually not a callout
            out.append(h)
    return out


def detect(path: str, expected: list[str] | None = None) -> tuple[list[Hit], list[str]]:
    ink = load_ink(path)
    hits = find_rings(ink)
    read_labels(ink, hits)
    if expected:
        # Bare numbers (parts manuals): try them when the rings found few of the key, since a
        # round part or an inset circle can pass for a ring. Keep whichever reads more labels.
        keys = {norm(e) for e in expected}
        in_key = sum(1 for h in hits if h.text and norm(h.text) in keys)
        if in_key < len(keys) / 2:
            bare = find_bare_labels(ink, expected)
            if len(bare) > in_key:
                hits = bare
    missing = assign(hits, expected or []) if expected is not None else []
    hits.sort(key=lambda h: (natural(h.n or "~"), h.y, h.x))
    return hits, missing


def natural(s: str):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]
