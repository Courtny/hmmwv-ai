"use client";

import { useState } from "react";
import type { Procedure } from "./procedures";
import { DiagramStage } from "./DiagramStage";
import { useDiagramSync } from "./useDiagramSync";

/**
 * A procedure's diagrams on their own, sized to the window, for a second screen. Follows the
 * procedure page (figure, pinned and hovered part) and sends picks made here back to it.
 */
export function DiagramWindow({ proc, srcs, path }: { proc: Procedure; srcs: string[]; path: string }) {
  const [view, setView] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  useDiagramSync(proc.slug, { view, pinned, active }, (s) => { setView(s.view); setPinned(s.pinned); setActive(s.active); });

  const current = active ?? pinned;
  const diagram = proc.diagrams[view];
  const [w, h] = diagram.viewBox;
  const multi = proc.diagrams.length > 1;
  const pick = (n: string) => setPinned((p) => (p === n ? null : n));
  const name = current ? diagram.parts.find((p) => String(p.n) === current)?.name : null;

  return (
    <div className={`dw${current ? " has-active" : ""}`}>
      <header className="dw-bar">
        <div className="dw-title">
          <strong>{proc.title}</strong>
          <span className="mono">
            {proc.section}
            {multi && ` · figure ${view + 1} of ${proc.diagrams.length}${diagram.page ? `, page ${diagram.page}` : ""}`}
            {current && name && <> · <b>({current}) {name}</b></>}
          </span>
        </div>
        {multi && (
          <div className="fig-tabs" role="group" aria-label="Figures">
            {proc.diagrams.map((d, i) => (
              <button key={d.file} type="button" className={i === view ? "on" : ""} aria-pressed={i === view}
                onClick={() => { setView(i); setPinned(null); setActive(null); }}>{i + 1}</button>
            ))}
          </div>
        )}
        <a className="mono dw-back" href={path} target="_blank" rel="noopener"
          onClick={(e) => { if (window.opener && !window.opener.closed) { e.preventDefault(); window.opener.focus(); } }}>Steps</a>
      </header>
      <div className="dw-main">
        <div className="dw-stage">
          <DiagramStage key={diagram.file} diagram={diagram} src={srcs[view]} current={current}
            onEnter={setActive} onLeave={() => setActive(null)} onPick={pick}
            style={{ width: `min(100%, calc((100vh - 96px) * ${(w / h).toFixed(4)}))` }} />
        </div>
        <ul className="key dw-key" aria-label="Key">
          {diagram.parts.map((p) => {
            const n = String(p.n);
            return (
              <li key={n}>
                <button type="button" className={current === n ? "on" : ""} aria-pressed={pinned === n}
                  onMouseEnter={() => setActive(n)} onMouseLeave={() => setActive(null)} onClick={() => pick(n)}>
                  <span className="num">{n}</span><span>{p.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mono dw-credit">Diagram: {diagram.credit}. This window follows the procedure page: pick a part there or here.</p>
    </div>
  );
}
