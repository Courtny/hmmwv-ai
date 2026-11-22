"""Find circled callouts (numbers or letters in a ring) in 1-bit technical manual line art.

A callout ring is found by its hole: the white disc inside the ring is a near perfect
circle even when a leader arrow touches the outside of the ring. The disc must hold a
small, centred glyph (the number). Each hit is read with tesseract when it is installed
and matched to the figure's expected callout key.
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


def read_labels(ink: np.ndarray, hits: list[Hit]) -> None:
    """Fill hit.text for every ring.

    macOS Vision reads lone characters poorly but reads a line of words well. The
    figure's labels are set as one line of words (tight crops, equal height), read in
    several layouts, and each word is mapped back to its ring by position. The reading
    most layouts agree on wins. Rings left unread fall back to tesseract when installed.
    """
    if not hits:
        return
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
        for x0, x1, text in vision_words(strip):
            inside = [i for i, (a, b) in enumerate(spans) if a < x1 and b > x0]
            if len(inside) == 1:  # a word that spans two rings is two labels run together
                v = votes[inside[0]]
                v[text] = v.get(text, 0) + 1
    for h, v in zip(hits, votes):
        if v:
            text, n = max(v.items(), key=lambda kv: kv[1])
            h.text = text
            if len(v) > 1:
                h.notes.append("readings " + ", ".join(f"{t}×{k}" for t, k in sorted(v.items(), key=lambda kv: -kv[1])))
    if shutil.which("tesseract"):
        for h in hits:
            if not h.text:
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
    width = img.shape[1]
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
            out.append((r.origin.x * width, (r.origin.x + r.size.width) * width, text))
    return out


def ocr_tesseract(crop: np.ndarray) -> str | None:
    import pytesseract

    cfg = "--psm 8 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    txt = pytesseract.image_to_string(crop, config=cfg).strip()
    return re.sub(r"[^0-9A-Z]", "", txt) or None


def assign(hits: list[Hit], expected: list[str]) -> list[str]:
    """Match OCR text to the expected callout key. Returns expected labels never found."""
    exp = set(expected)
    for h in hits:
        if h.text and h.text in exp:
            h.n, h.confidence = h.text, 0.95
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


def detect(path: str, expected: list[str] | None = None) -> tuple[list[Hit], list[str]]:
    ink = load_ink(path)
    hits = find_rings(ink)
    read_labels(ink, hits)
    missing = assign(hits, expected or []) if expected is not None else []
    hits.sort(key=lambda h: (natural(h.n or "~"), h.y, h.x))
    return hits, missing


def natural(s: str):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]
