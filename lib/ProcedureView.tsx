"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Procedure } from "./procedures";

/** Split step text so each "(n)" that names a part becomes a linked chip. "(34 N•m)" is left alone. */
function stepText(text: string, known: Set<number>, ref: (n: number, key: string) => ReactNode) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/\((\d{1,2})\)/g)) {
    const n = Number(m[1]);
    if (!known.has(n)) continue;
    out.push(text.slice(last, m.index));
    out.push(ref(n, `${m.index}`));
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

export function ProcedureView({ proc, src }: { proc: Procedure; src: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const current = active ?? pinned;
  const known = new Set(proc.parts.map((p) => p.n));
  const name = (n: number) => proc.parts.find((p) => p.n === n)?.name ?? `Part ${n}`;
  const stepsFor = (n: number) => proc.steps.flatMap((s, i) => (new RegExp(`\\(${n}\\)`).test(s) ? [i + 1] : []));

  const hover = (n: number) => ({
    onMouseEnter: () => setActive(n),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(n),
    onBlur: () => setActive(null),
    onClick: () => setPinned((p) => (p === n ? null : n)),
    "aria-pressed": pinned === n,
  });

  const [w, h] = proc.diagram.viewBox;

  // On narrow screens the diagram scrolls sideways; bring the selected callout into view.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || current == null || el.scrollWidth <= el.clientWidth) return;
    const xs = proc.diagram.callouts.filter((c) => c.n === current).map((c) => c.x);
    const mid = ((Math.min(...xs) + Math.max(...xs)) / 2 / w) * el.scrollWidth;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: mid - el.clientWidth / 2, behavior: smooth ? "smooth" : "instant" });
  }, [current, proc.diagram.callouts, w]);

  return (
    <div className={`proc${current ? " has-active" : ""}`}>
      <figure className="diagram">
        <div className="scroller" ref={scroller}>
        <div className="stage" style={{ aspectRatio: `${w} / ${h}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="art" src={src} alt={proc.diagram.alt} width={w} height={h} />
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <g className="callouts">
            {proc.diagram.callouts.map((c, i) => (
              <g key={i} className={`co${current === c.n ? " on" : ""}`} onMouseEnter={() => setActive(c.n)} onMouseLeave={() => setActive(null)} onClick={() => setPinned((p) => (p === c.n ? null : c.n))}>
                <circle cx={c.x} cy={c.y} r={24} className="hit" />
                <circle cx={c.x} cy={c.y} r={21} className="ring" />
              </g>
            ))}
          </g>
        </svg>
        </div>
        </div>
        <figcaption>
          <div className="mono">Diagram: {proc.diagram.credit}.</div>
          <div className="mono legend" aria-live="polite">
            {current ? <>Showing <strong>({current}) {name(current)}</strong>{stepsFor(current).length > 0 && <>, used in step {stepsFor(current).join(" and ")}</>}.</> : "Tap a part in the key or the steps to find it in the diagram."}
          </div>
        </figcaption>
      </figure>

      <div className="proc-body">
        {proc.caution && <aside className="callout caution" role="note"><strong>Caution</strong><p>{proc.caution}</p></aside>}
        {proc.note && <aside className="callout note" role="note"><strong>Note</strong><p>{proc.note}</p></aside>}

        <h2>Steps</h2>
        <ol className="steps">
          {proc.steps.map((s, i) => (
            <li key={i} className={current && stepsFor(current).includes(i + 1) ? "on" : ""}>
              {stepText(s, known, (n, key) => (
                <button key={key} type="button" className={`ref${current === n ? " on" : ""}`} {...hover(n)} aria-label={`${name(n)}, part ${n}`}>{n}</button>
              ))}
            </li>
          ))}
        </ol>

        <h2>Key</h2>
        <ul className="key">
          {proc.parts.map((p) => (
            <li key={p.n}>
              <button type="button" className={current === p.n ? "on" : ""} {...hover(p.n)}>
                <span className="num">{p.n}</span>
                <span>{p.name}{p.qty ? ` (${p.qty})` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
