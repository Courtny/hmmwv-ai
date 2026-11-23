"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Procedure } from "./procedures";
import { DiagramStage } from "./DiagramStage";
import { DiagramViewer } from "./DiagramViewer";
import { useDiagramSync, openDiagramWindow, diagramWindowPath } from "./useDiagramSync";

const REF = /\((\d{1,2}(?:\.\d)?|[A-Z])\)/g;

/** Split step text so each "(n)" that names a part becomes a linked chip. "(34 N•m)" is left alone. */
function stepText(text: string, known: Set<string>, ref: (n: string, key: string) => ReactNode) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    if (!known.has(m[1])) continue;
    out.push(text.slice(last, m.index));
    out.push(ref(m[1], `${m.index}`));
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

const names = (text: string) => new Set([...text.matchAll(REF)].map((m) => m[1]));

export function ProcedureView({ proc, srcs, path }: { proc: Procedure; srcs: string[]; path: string }) {
  const [view, setView] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const current = active ?? pinned;
  const [full, setFull] = useState(false);
  const diagram = proc.diagrams[view];
  const multi = proc.diagrams.length > 1;
  const keys = proc.diagrams.map((d) => new Set(d.parts.map((p) => String(p.n))));
  const name = (n: string) => diagram.parts.find((p) => String(p.n) === n)?.name ?? `Part ${n}`;
  const stepsFor = (n: string) => proc.steps.flatMap((s) => (s.d === view && names(s.text).has(n) ? [s.n] : []));

  // A diagram window opened from this page follows the figure and the part picked here, and back.
  useDiagramSync(proc.slug, { view, pinned, active }, (s) => { setView(s.view); setPinned(s.pinned); setActive(s.active); });

  const show = (d: number) => { if (d !== view) { setView(d); setPinned(null); setActive(null); } };

  // Long procedures: the figure follows the steps being read, unless a part is pinned.
  const list = useRef<HTMLOListElement>(null);
  const hold = useRef(false);
  hold.current = pinned != null || full;
  useEffect(() => {
    const el = list.current;
    if (!el || proc.diagrams.length < 2) return;
    const io = new IntersectionObserver((entries) => {
      if (hold.current) return;
      const hit = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.d));
      if (hit.length) setView(hit[hit.length - 1]);
    }, { rootMargin: "-35% 0px -55% 0px" });
    el.querySelectorAll("li[data-d]").forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, [proc.diagrams.length]);
  const pick = (n: string) => setPinned((p) => (p === n ? null : n));
  /** A part chip in a step or the key: hover previews it on the diagram showing; a click shows its figure and pins it. */
  const chip = (d: number, n: string) => ({
    onMouseEnter: () => d === view && setActive(n),
    onMouseLeave: () => setActive(null),
    onFocus: () => d === view && setActive(n),
    onBlur: () => setActive(null),
    onClick: () => { if (d !== view) { setView(d); setActive(null); setPinned(n); } else pick(n); },
    "aria-pressed": d === view && pinned === n,
  });
  const figLabel = (i: number) => `Figure ${i + 1}${proc.diagrams[i].page ? `, page ${proc.diagrams[i].page}` : ""}`;
  const tabs = multi && (
    <div className="fig-tabs" role="group" aria-label="Figures">
      {proc.diagrams.map((d, i) => (
        <button key={d.file} type="button" className={i === view ? "on" : ""} aria-pressed={i === view} onClick={() => show(i)}>
          {i + 1}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`proc${current ? " has-active" : ""}`}>
      {/* Diagram and key share the left column on desktop; on phones the key follows the steps. */}
      <div className="proc-side">
        <figure className="diagram">
          <div className={`fig-head${multi ? "" : " solo"}`}>
            {multi && <span className="mono fig-label">{figLabel(view)} of {proc.diagrams.length}</span>}
            {tabs}
            <button type="button" className="expand" onClick={() => { setActive(null); setFull(true); }} aria-haspopup="dialog">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
              Full screen
            </button>
            <a className="expand new-window" href={diagramWindowPath(path)} target="_blank" rel="noopener"
              onClick={(e) => { e.preventDefault(); openDiagramWindow(path, proc.slug); }}
              title="Open the diagram in its own window, for example on a second screen. It follows this page.">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9 1h6v6M15 1 8 8M6 3H1v12h12v-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
              New window
            </a>
          </div>
          <DiagramStage key={diagram.file} diagram={diagram} src={srcs[view]} current={current} onEnter={setActive} onLeave={() => setActive(null)} onPick={pick} />
          <figcaption>
            <div className="mono">Diagram: {diagram.credit}.</div>
            <div className="mono legend" aria-live="polite">
              {current ? <>Showing <strong>({current}) {name(current)}</strong>{stepsFor(current).length > 0 && <>, used in step {stepsFor(current).join(" and ")}</>}.</> : "Tap a part in the key or the steps to find it in the diagram."}
            </div>
          </figcaption>
        </figure>

        <section className="proc-key" aria-labelledby="proc-key-h">
          <h2 id="proc-key-h">Key{multi && <span className="mono key-fig"> · figure {view + 1}</span>}</h2>
          <ul className="key">
            {diagram.parts.map((p) => {
              const n = String(p.n);
              return (
                <li key={n}>
                  <button type="button" className={current === n ? "on" : ""} {...chip(view, n)}>
                    <span className="num">{n}</span>
                    <span>{p.name}{p.qty ? ` (${p.qty})` : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <DiagramViewer open={full} onClose={() => { setFull(false); setActive(null); }} title={proc.title}
        subtitle={`${proc.manual} · ${multi ? figLabel(view) : `page ${diagram.page ?? proc.page}`}`} diagram={diagram} src={srcs[view]} nav={tabs || undefined}
        current={current} pinned={pinned} onEnter={setActive} onLeave={() => setActive(null)} onPick={pick} />

      <div className="proc-body">
        {proc.caution && <aside className="callout caution" role="note"><strong>Caution</strong><p>{proc.caution}</p></aside>}
        {proc.note && <aside className="callout note" role="note"><strong>Note</strong><p>{proc.note}</p></aside>}

        <h2>Steps</h2>
        <ol className="steps" ref={list}>
          {proc.steps.map((s, i) => {
            const n = Number(s.n);
            return (
              <li key={i} data-d={s.d} value={Number.isInteger(n) ? n : undefined} className={s.d === view && current && names(s.text).has(current) ? "on" : ""}>
                {s.notes?.map((note, k) => (
                  <aside key={k} className={`callout ${/CAUTION|WARNING/.test(note.kind) ? "caution" : "note"}`} role="note">
                    <strong>{note.kind.charAt(0) + note.kind.slice(1).toLowerCase()}</strong><p>{note.text}</p>
                  </aside>
                ))}
                {multi && s.d !== view && (i === 0 || proc.steps[i - 1].d !== s.d) && (
                  <button type="button" className="fig-link mono" onClick={() => show(s.d)}>Show {figLabel(s.d).toLowerCase()}</button>
                )}
                {stepText(s.text, keys[s.d], (n, key) => (
                  <button key={key} type="button" className={`ref${s.d === view && current === n ? " on" : ""}`} {...chip(s.d, n)}
                    aria-label={`${proc.diagrams[s.d].parts.find((p) => String(p.n) === n)?.name ?? "Part"}, part ${n}`}>{n}</button>
                ))}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
