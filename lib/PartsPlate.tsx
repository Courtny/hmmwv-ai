"use client";

import { useEffect } from "react";
import type { Plate } from "./plates";
import { DiagramStage } from "./DiagramStage";
import { DiagramViewer } from "./DiagramViewer";
import { registerPlate, setPlate, showRow, usePlate, WIDE } from "./plateStore";

/**
 * A parts manual plate, traced, with its callouts tied to the parts list below or beside it:
 * a callout finds the item's rows, a row finds the callout. Full screen on request, and on
 * narrow screens when a row is picked.
 */
export function PartsPlate({ plate, src, title, subtitle, children }: {
  plate: Plate; src: string; title: string; subtitle: string; children?: React.ReactNode;
}) {
  const { active, pinned, full } = usePlate();
  const current = active ?? pinned;
  const marked = new Set(plate.callouts.map((c) => String(c.n)));
  useEffect(() => registerPlate(plate.figure, [...marked]), [plate.figure]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = (n: string) => plate.parts.find((p) => String(p.n) === n)?.name ?? "";
  const enter = (n: string) => setPlate({ active: n });
  const leave = () => setPlate({ active: null });
  const pick = (n: string) => {
    const next = pinned === n ? null : n;
    setPlate({ pinned: next });
    if (next && window.matchMedia(WIDE).matches) showRow(next);
  };
  const open = full === plate.figure;

  return (
    <>
    <figure className={`tm-fig plate${current && marked.has(current) ? " has-active" : ""}`} id={plate.figure}>
      <div className="fig-head solo">
        <button type="button" className="expand" onClick={() => setPlate({ active: null, full: plate.figure })} aria-haspopup="dialog">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          Full screen
        </button>
      </div>
      <DiagramStage diagram={plate} src={src} current={current} onEnter={enter} onLeave={leave} onPick={pick}
        style={{ maxWidth: `calc((100vh - 170px) * ${plate.viewBox[0]} / ${plate.viewBox[1]})`, margin: "0 auto" }} />
      <figcaption>
        <div className="mono legend" aria-live="polite">
          {!current ? "Tap a number on the plate or a row of the parts list to find the item."
            : marked.has(current) ? <>Item <strong>{current}</strong>, {name(current)}.</>
            : plate.parts.some((p) => String(p.n) === current) ? <>Item <strong>{current}</strong>, {name(current)}: not marked on this plate.</>
            : <>Item <strong>{current}</strong> is not on this plate.</>}
        </div>
        {children}
      </figcaption>
    </figure>
    <DiagramViewer open={open} onClose={() => setPlate({ full: null, active: null })} title={title} subtitle={subtitle}
        diagram={{ ...plate, parts: plate.parts.filter((p) => marked.has(String(p.n))) }} src={src}
        current={current} pinned={pinned} onEnter={enter} onLeave={leave} onPick={(n) => setPlate({ pinned: pinned === n ? null : n })} />
    </>
  );
}
