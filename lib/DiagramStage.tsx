"use client";

import type { CSSProperties } from "react";
import type { Procedure } from "./procedures";

/** The traced diagram with clickable callout rings on top. Shared by the page and the full-screen viewer. */
export function DiagramStage({ proc, src, current, onEnter, onLeave, onPick, style, alt = proc.diagram.alt }: {
  proc: Procedure; src: string; current: number | null;
  onEnter: (n: number) => void; onLeave: () => void; onPick: (n: number) => void;
  style?: CSSProperties; alt?: string;
}) {
  const [w, h] = proc.diagram.viewBox;
  return (
    <div className="stage" style={{ aspectRatio: `${w} / ${h}`, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="art" src={src} alt={alt} width={w} height={h} draggable={false} />
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <g className="callouts">
          {proc.diagram.callouts.map((c, i) => (
            <g key={i} className={`co${current === c.n ? " on" : ""}`} onMouseEnter={() => onEnter(c.n)} onMouseLeave={onLeave} onClick={() => onPick(c.n)}>
              <circle cx={c.x} cy={c.y} r={24} className="hit" />
              <circle cx={c.x} cy={c.y} r={21} className="ring" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
