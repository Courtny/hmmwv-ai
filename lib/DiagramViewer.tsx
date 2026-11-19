"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Procedure } from "./procedures";
import { DiagramStage } from "./DiagramStage";

const MIN = 1, MAX = 8;
type View = { s: number; x: number; y: number };

/**
 * Full-screen diagram viewer in a native <dialog> (works on iOS, where the Fullscreen API does not).
 * Zoom: pinch, wheel, double-click, +/- keys or buttons. Pan: drag or arrow keys.
 * The stage is resized rather than CSS-scaled so the SVG re-renders sharp at every zoom level.
 */
export function DiagramViewer({ open, onClose, proc, src, current, pinned, onEnter, onLeave, onPick }: {
  open: boolean; onClose: () => void; proc: Procedure; src: string;
  current: number | null; pinned: number | null;
  onEnter: (n: number) => void; onLeave: () => void; onPick: (n: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const port = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [w, h] = proc.diagram.viewBox;

  // Diagram size at zoom 1: fit inside the viewport.
  const fitW = Math.min(size.w, (size.h * w) / h);
  const fitH = (fitW * h) / w;

  /** Keep the diagram covering the viewport when zoomed in, centred when it is smaller. */
  const clamp = useCallback((v: View): View => {
    const s = Math.min(MAX, Math.max(MIN, v.s));
    const cw = fitW * s, ch = fitH * s;
    const x = cw <= size.w ? (size.w - cw) / 2 : Math.min(0, Math.max(size.w - cw, v.x));
    const y = ch <= size.h ? (size.h - ch) / 2 : Math.min(0, Math.max(size.h - ch, v.y));
    return { s, x, y };
  }, [fitW, fitH, size.w, size.h]);

  /** Zoom by `f` keeping the point (px, py) in the viewport fixed. */
  const zoomAt = useCallback((f: number, px = size.w / 2, py = size.h / 2) => {
    setView((v) => {
      const s = Math.min(MAX, Math.max(MIN, v.s * f)), k = s / v.s;
      return clamp({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
    });
  }, [clamp, size.w, size.h]);

  const reset = useCallback(() => setView(clamp({ s: 1, x: 0, y: 0 })), [clamp]);

  /** Centre the callouts for part n, zooming in if needed. */
  const focusPart = useCallback((n: number, minZoom = 2.5) => {
    const cs = proc.diagram.callouts.filter((c) => c.n === n);
    if (!cs.length || !fitW) return;
    const cx = cs.reduce((a, c) => a + c.x, 0) / cs.length, cy = cs.reduce((a, c) => a + c.y, 0) / cs.length;
    setView((v) => {
      const s = Math.max(v.s, minZoom), u = (fitW * s) / w;
      return clamp({ s, x: size.w / 2 - cx * u, y: size.h / 2 - cy * u });
    });
  }, [proc.diagram.callouts, fitW, w, clamp, size.w, size.h]);

  // Open and close the native dialog; lock page scroll while open.
  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (open && !d.open) { d.showModal(); document.documentElement.classList.add("no-scroll"); }
    if (!open && d.open) d.close();
    return () => document.documentElement.classList.remove("no-scroll");
  }, [open]);

  // Track the viewport size.
  useLayoutEffect(() => {
    const el = port.current; if (!el || !open) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Re-fit when the viewport changes; on open, go straight to the pinned part if there is one.
  const opened = useRef(false);
  useEffect(() => {
    if (!open) { opened.current = false; return; }
    if (!size.w) return;
    if (!opened.current && pinned != null) focusPart(pinned); else setView((v) => clamp(v));
    opened.current = true;
  }, [open, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = port.current; if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, zoomAt]);

  // Drag to pan, two fingers to pinch. A drag longer than a few pixels does not count as a tap on a callout.
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const onPointerDown = (e: React.PointerEvent) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) moved.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId); if (!prev) return;
    const all = [...pts.current.values()];
    if (pts.current.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      moved.current += Math.abs(dx) + Math.abs(dy);
      if (moved.current > 6 && !port.current!.hasPointerCapture(e.pointerId)) port.current!.setPointerCapture(e.pointerId);
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (pts.current.size === 2) {
      const other = all.find((p) => p !== prev)!;
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const r = port.current!.getBoundingClientRect();
      moved.current += 100;
      if (d0 > 0) zoomAt(d1 / d0, (e.clientX + other.x) / 2 - r.left, (e.clientY + other.y) / 2 - r.top);
    }
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => { pts.current.delete(e.pointerId); };
  const pick = (n: number) => { if (moved.current > 6) return; onPick(n); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60;
    const k: Record<string, () => void> = {
      "+": () => zoomAt(1.4), "=": () => zoomAt(1.4), "-": () => zoomAt(1 / 1.4), "0": reset,
      ArrowLeft: () => setView((v) => clamp({ ...v, x: v.x + step })), ArrowRight: () => setView((v) => clamp({ ...v, x: v.x - step })),
      ArrowUp: () => setView((v) => clamp({ ...v, y: v.y + step })), ArrowDown: () => setView((v) => clamp({ ...v, y: v.y - step })),
    };
    if (k[e.key]) { e.preventDefault(); k[e.key](); }
  };

  const name = (n: number) => proc.parts.find((p) => p.n === n)?.name;

  return (
    <dialog ref={dialog} className="viewer" onClose={onClose} onCancel={onClose} aria-label={`${proc.title} diagram, full screen`} onKeyDown={onKeyDown}>
      <div className="viewer-bar">
        <div className="viewer-title">
          <strong>{proc.title}</strong>
          <span className="mono">{current != null ? `(${current}) ${name(current)}` : `${proc.manual} · page ${proc.page}`}</span>
        </div>
        <div className="viewer-tools" role="toolbar" aria-label="Zoom">
          <button type="button" onClick={() => zoomAt(1 / 1.4)} disabled={view.s <= MIN} aria-label="Zoom out">−</button>
          <span className="mono zoom">{Math.round(view.s * 100)}%</span>
          <button type="button" onClick={() => zoomAt(1.4)} disabled={view.s >= MAX} aria-label="Zoom in">+</button>
          <button type="button" onClick={reset} disabled={view.s === 1} className="txt">Fit</button>
          <button type="button" onClick={onClose} className="txt close" autoFocus>Close</button>
        </div>
      </div>

      <div ref={port} className="viewer-port" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={(e) => { const r = port.current!.getBoundingClientRect(); view.s >= 4 ? reset() : zoomAt(2, e.clientX - r.left, e.clientY - r.top); }}>
        {fitW > 0 && (
          <DiagramStage proc={proc} src={src} current={current} onEnter={onEnter} onLeave={onLeave} onPick={pick}
            style={{ position: "absolute", left: 0, top: 0, width: fitW * view.s, height: fitH * view.s, transform: `translate(${view.x}px, ${view.y}px)` }} />
        )}
      </div>

      <div className="viewer-foot">
        <ul className="chips" aria-label="Parts">
          {proc.parts.map((p) => (
            <li key={p.n}>
              <button type="button" className={pinned === p.n ? "on" : ""} aria-pressed={pinned === p.n}
                onClick={() => { onPick(p.n); if (pinned !== p.n) focusPart(p.n); }}
                onMouseEnter={() => onEnter(p.n)} onMouseLeave={onLeave}>
                <span className="num">{p.n}</span>{p.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="mono credit">Diagram: {proc.diagram.credit}.<span className="hint"> Pinch, scroll or double-tap to zoom; drag to move.</span></div>
      </div>
    </dialog>
  );
}
