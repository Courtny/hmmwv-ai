"use client";

import { useEffect, useRef } from "react";

/** What a procedure page and its diagram window share: the figure showing, the pinned part and the part hovered. */
export type DiagramState = { view: number; pinned: string | null; active: string | null };

/**
 * Keeps a procedure page and its diagram window (same browser, any number of windows) in step
 * through a BroadcastChannel. A window that opens asks for the current state; after that each
 * side posts its own changes. Browsers without BroadcastChannel simply do not sync.
 */
export function useDiagramSync(slug: string, state: DiagramState, apply: (s: DiagramState) => void) {
  const channel = useRef<BroadcastChannel | null>(null);
  const current = useRef(state);
  current.current = state;
  const lastSeen = useRef("");
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(`hmmwv-diagram:${slug}`);
    channel.current = c;
    c.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m?.type === "hello") c.postMessage({ type: "state", ...current.current });
      else if (m?.type === "state" && typeof m.view === "number") {
        const s = { view: m.view, pinned: m.pinned ?? null, active: m.active ?? null };
        lastSeen.current = JSON.stringify(s);
        applyRef.current(s);
      }
    };
    c.postMessage({ type: "hello" });
    return () => { c.close(); channel.current = null; };
  }, [slug]);

  useEffect(() => {
    const s = { view: state.view, pinned: state.pinned, active: state.active };
    const key = JSON.stringify(s);
    if (key === lastSeen.current) return;
    lastSeen.current = key;
    channel.current?.postMessage({ type: "state", ...s });
  }, [state.view, state.pinned, state.active]);
}

/** URL of the diagram-only window for a procedure page. */
export const diagramWindowPath = (procedurePath: string) => `${procedurePath}diagram/`;

/** Open (or bring forward) the procedure's diagram window. */
export function openDiagramWindow(procedurePath: string, slug: string) {
  const w = window.open(diagramWindowPath(procedurePath), `hmmwv-diagram-${slug}`, "popup,width=1100,height=860");
  w?.focus();
  return w;
}
