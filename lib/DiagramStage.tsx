"use client";

import type { CSSProperties } from "react";
import type { Diagram } from "./procedures";

/** A traced diagram with clickable callout rings on top. Shared by the page and the full-screen viewer. */
export function DiagramStage({ diagram, src, current, onEnter, onLeave, onPick, style, alt = diagram.alt }: {
  diagram: Diagram; src: string; current: string | null;
  onEnter: (n: string) => void; onLeave: () => void; onPick: (n: string) => void;
  style?: CSSProperties; alt?: string;
}) {
  const [w, h] = diagram.viewBox;
  const ring = diagram.ring ?? 21;
  return (
    <div className="stage" style={{ aspectRatio: `${w} / ${h}`, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="art" src={src} alt={alt} width={w} height={h} draggable={false} />
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <g className="callouts">
          {diagram.callouts.map((c, i) => {
            const n = String(c.n);
            return (
              <g key={i} className={`co${current === n ? " on" : ""}`} onMouseEnter={() => onEnter(n)} onMouseLeave={onLeave} onClick={() => onPick(n)}>
                <circle cx={c.x} cy={c.y} r={ring + 3} className="hit" />
                <circle cx={c.x} cy={c.y} r={ring} className="ring" />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
