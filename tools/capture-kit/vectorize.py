#!/usr/bin/env python3
"""Trace figure PNGs to two-tone SVG with potrace (pure python potracer; no hand-off).
Usage: python3 -I vectorize.py <images_dir> <svg_out_dir> [id ...]   (ids optional; default all *.png)
Runs files in parallel (VZ_JOBS, default = CPU count). Needs: pip install potracer pillow numpy
Output: <id>.svg, white background rect + one black path, viewBox = PNG pixel size."""
import sys, os, numpy as np
from PIL import Image
import potrace
src, dst = sys.argv[1], sys.argv[2]; ids = sys.argv[3:]
os.makedirs(dst, exist_ok=True)
files = [f"{i}.png" for i in ids] if ids else sorted(f for f in os.listdir(src) if f.endswith(".png"))
def trace(path):
    im = Image.open(path).convert("L"); w, h = im.size
    bm = potrace.Bitmap(np.array(im) >= 140)  # True = light; potracer inverts internally
    pl = bm.trace(turdsize=4, alphamax=1.0, opticurve=True, opttolerance=0.4)
    d = []
    for c in pl:
        s = c.start_point; d.append(f"M{s.x:.1f},{s.y:.1f}")
        for seg in c.segments:
            if seg.is_corner: d.append(f"L{seg.c.x:.1f},{seg.c.y:.1f}L{seg.end_point.x:.1f},{seg.end_point.y:.1f}")
            else: d.append(f"C{seg.c1.x:.1f},{seg.c1.y:.1f} {seg.c2.x:.1f},{seg.c2.y:.1f} {seg.end_point.x:.1f},{seg.end_point.y:.1f}")
        d.append("Z")
    return w, h, "".join(d)
def one(f):
    w, h, d = trace(os.path.join(src, f))
    open(os.path.join(dst, f[:-4] + ".svg"), "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><rect width="{w}" height="{h}" fill="#fff"/><path d="{d}" fill="#000" fill-rule="evenodd"/></svg>')
    return f, round(os.path.getsize(os.path.join(dst, f[:-4] + ".svg")) / 1024)
if __name__ == "__main__":
    from multiprocessing import Pool
    with Pool(int(os.environ.get("VZ_JOBS", os.cpu_count() or 2))) as p:
        for f, kb in p.imap_unordered(one, files): print(f, kb, "KB", flush=True)
