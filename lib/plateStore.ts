"use client";

import { useSyncExternalStore } from "react";

/**
 * What the plates and the parts list on one work package page share: the item hovered, the
 * item pinned, and the plate open full screen. One store per page (module level), so two
 * sheets of a figure and the parts list rows all follow the same item.
 */
export type PlateState = { active: string | null; pinned: string | null; full: string | null };

let state: PlateState = { active: null, pinned: null, full: null };
const listeners = new Set<() => void>();

export function setPlate(patch: Partial<PlateState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  paintRows();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const usePlate = () => useSyncExternalStore(subscribe, () => state, () => state);

/** Item number a parts list row belongs to (rows carry it as data-item). */
const itemOf = (el: Element | null) => (el?.closest("tr[data-item]") as HTMLElement | null)?.dataset.item ?? null;

function paintRows() {
  const current = state.active ?? state.pinned;
  document.querySelectorAll<HTMLElement>("tr[data-item]").forEach((tr) => {
    tr.classList.toggle("on", tr.dataset.item === current);
    tr.setAttribute("aria-pressed", String(tr.dataset.item === state.pinned));
  });
}

/** First parts list row of an item, scrolled into view if it is off screen. */
export function showRow(n: string) {
  const tr = document.querySelector<HTMLElement>(`tr[data-item="${CSS.escape(n)}"]`);
  tr?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/** Plates on the page and the items each marks, in page order. */
const plates = new Map<string, Set<string>>();
/** Below this width the plate is not beside the list, so picking a row opens it full screen. */
export const WIDE = "(min-width: 1100px)";

/** A plate joins the page; the first one also binds the parts list rows. Returns the cleanup. */
export function registerPlate(figure: string, items: string[]) {
  if (plates.size === 0) state = { active: null, pinned: null, full: null };
  plates.set(figure, new Set(items));
  const unbind = plates.size === 1 ? bindRows() : () => {};
  return () => { plates.delete(figure); unbind(); };
}

const onPin = (n: string) => {
  if (window.matchMedia(WIDE).matches) return;
  const fig = [...plates].find(([, items]) => items.has(n))?.[0];
  if (fig) setPlate({ full: fig });
};

/** Parts list rows answer to the plates: hover previews an item, a click or Enter pins it. */
function bindRows() {
  const rows = document.querySelectorAll<HTMLElement>("tr[data-item]");
  rows.forEach((tr) => { tr.tabIndex = 0; tr.setAttribute("role", "button"); });
  const over = (e: Event) => { const n = itemOf(e.target as Element); if (n) setPlate({ active: n }); };
  const out = (e: Event) => {
    const to = (e as MouseEvent).relatedTarget as Element | null;
    if (itemOf(e.target as Element) && !itemOf(to)) setPlate({ active: null });
  };
  const pick = (n: string) => {
    const pinned = state.pinned === n ? null : n;
    setPlate({ pinned });
    if (pinned) onPin(pinned);
  };
  const click = (e: Event) => {
    if ((e.target as Element).closest("a")) return;
    const n = itemOf(e.target as Element); if (n) pick(n);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const n = itemOf(e.target as Element);
    if (n && (e.target as Element).matches("tr[data-item]")) { e.preventDefault(); pick(n); }
  };
  document.addEventListener("mouseover", over);
  document.addEventListener("mouseout", out);
  document.addEventListener("focusin", over);
  document.addEventListener("focusout", out);
  document.addEventListener("click", click);
  document.addEventListener("keydown", key);
  paintRows();
  return () => {
    document.removeEventListener("mouseover", over);
    document.removeEventListener("mouseout", out);
    document.removeEventListener("focusin", over);
    document.removeEventListener("focusout", out);
    document.removeEventListener("click", click);
    document.removeEventListener("keydown", key);
  };
}
