"""Check traced SVGs and make the potrace fallback match what the site expects.

The site (lib/procedures.ts diagramSvg) recolours a two-tone trace: every non-white
hex fill becomes ink and #ffffff becomes the card colour. VectorMagic's SVG already has
that shape: viewBox = input pixels, flat <path fill="#rrggbb"> elements.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import cv2


@dataclass
class SvgInfo:
    viewbox: tuple[float, float]
    fills: dict[str, int]  # colour -> path count
    paths: int
    bytes: int


def inspect(path: Path) -> SvgInfo:
    s = path.read_text(errors="replace")
    m = re.search(r'viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)', s)
    if not m:
        raise ValueError(f"{path.name}: no viewBox")
    fills: dict[str, int] = {}
    for f in re.findall(r'fill="(#[0-9a-fA-F]{6})', s):
        fills[f.lower()] = fills.get(f.lower(), 0) + 1
    return SvgInfo((float(m.group(1)), float(m.group(2))), fills, s.count("<path"), len(s.encode()))


def problems(info: SvgInfo, png_size: tuple[int, int]) -> list[str]:
    """Things that would make the trace render wrong on the site."""
    out = []
    w, h = png_size
    sx, sy = info.viewbox[0] / w, info.viewbox[1] / h
    if abs(sx - sy) > 0.01 * max(sx, sy):
        out.append(f"aspect changed: viewBox {info.viewbox[0]:g}x{info.viewbox[1]:g} vs image {w}x{h}")
    if "#ffffff" not in info.fills:
        out.append("no white fill: trace with a white background so the card colour shows through")
    dark = [c for c in info.fills if c != "#ffffff"]
    if len(dark) > 1:
        out.append(f"{len(info.fills)} colours ({', '.join(sorted(info.fills))}); use a 2-colour palette")
    if info.bytes > 1_000_000:
        out.append(f"large file ({info.bytes // 1000} kB); try a lower detail setting")
    return out


def snap_two_tone(src: Path, dst: Path, threshold: float = 0.5) -> int:
    """Copy src to dst with every fill snapped to black or white by luminance.

    VectorMagic sometimes keeps anti-aliasing greys even on 1-bit art. The site turns
    every non-white fill into ink, so a near-white grey would print as a dark blob.
    Paths stay in their original order, so a light layer over a dark one still reads
    correctly. Returns how many distinct colours were snapped.
    """
    s = src.read_text(errors="replace")
    seen: set[str] = set()

    def snap(m: re.Match) -> str:
        c = m.group(1).lower()
        if c in ("#000000", "#ffffff"):
            return f'fill="{c}"'
        seen.add(c)
        r, g, b = (int(c[i:i + 2], 16) / 255 for i in (1, 3, 5))
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return 'fill="#ffffff"' if lum >= threshold else 'fill="#000000"'

    dst.write_text(re.sub(r'fill="(#[0-9a-fA-F]{6})"', snap, s))
    return len(seen)


def potrace_available() -> bool:
    return shutil.which("potrace") is not None


def trace_potrace(png: Path, out_svg: Path, ink: str = "#383838") -> None:
    """Trace 1-bit line art with potrace and write it in the site's two-tone shape."""
    g = cv2.imread(str(png), cv2.IMREAD_GRAYSCALE)
    if g is None:
        raise FileNotFoundError(png)
    h, w = g.shape
    _, bw = cv2.threshold(g, 128, 255, cv2.THRESH_BINARY)
    with tempfile.TemporaryDirectory() as tmp:
        pbm = Path(tmp) / "in.pbm"
        cv2.imwrite(str(pbm), bw)
        raw = Path(tmp) / "out.svg"
        # -u 10: coordinates in tenths of a pixel; --flat: one path; -t 2: drop 2px specks.
        subprocess.run(["potrace", str(pbm), "-s", "--flat", "-u", "10", "-t", "2", "-O", "0.4", "-o", str(raw)],
                       check=True)
        s = raw.read_text()
    tf = re.search(r'<g transform="([^"]+)"', s)
    ds = re.findall(r'<path d="([^"]+)"', s)
    if not tf or not ds:
        raise RuntimeError(f"unexpected potrace output for {png.name}")
    d = " ".join(" ".join(x.split()) for x in ds)
    out_svg.write_text(
        f'<?xml version="1.0" encoding="UTF-8" ?>\n'
        f'<svg width="{w}pt" height="{h}pt" viewBox="0 0 {w} {h}" version="1.1" xmlns="http://www.w3.org/2000/svg">\n'
        f'<path fill="#ffffff" d="M0 0H{w}V{h}H0Z"/>\n'
        f'<path fill="{ink}" fill-rule="evenodd" transform="{tf.group(1)}" d="{d}"/>\n'
        f"</svg>\n"
    )
