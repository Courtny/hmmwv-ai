import content from "@/data/content.json";
import variantsRaw from "@/data/variants.json";
import tablesData from "@/data/tables_data.json";
import tablesIndex from "@/data/tables-index.json";

export type Photo = {
  id: string; kind: string; page: number; printed_page: number | null; caption: string | null; credit: string | null;
  alt: string; confidence: number; needs_review: boolean; related: string[]; image: string; thumb: string; width: number; height: number;
};
export type Variant = {
  designation: string; year: string; engine: string; transmission: string; description: string; group: string; page: number; slug: string;
};
export type TableRow = { group?: string; cells?: string[]; page: number; source_id: string };
export type Table = { key: string; number: number; title: string; intro?: string; footnotes?: string[]; columns: string[]; pages: number[]; source_ids: string[]; rows: TableRow[] };
export type TableImage = { id: string; page: number; table_key: string; image: string; title: string };

export const photos = content as unknown as Photo[];
export const tables = tablesData as unknown as Table[];
export const tableImages = tablesIndex as unknown as TableImage[];

const seen = new Map<string, number>();
export const variants: Variant[] = (variantsRaw as any[]).map((v) => {
  const base = v.designation.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
  return { ...v, slug: n > 1 ? `${base}-${n}` : base };
});

export const photoById = (id: string) => photos.find((p) => p.id === id);
export const photosFor = (designation: string) => {
  const re = new RegExp(`(^|[^A-Za-z0-9])${designation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![0-9]|[AR][0-9])`);
  return photos.filter((p) => p.caption && re.test(p.caption));
};
export const groups = Array.from(new Set(variants.map((v) => v.group)));
/** Row from Table 8 (dimensions and weight) for a designation, if the book lists it. */
export const dimensionsFor = (designation: string) => {
  const t = tables.find((x) => x.key === "table-08")!;
  const row = t.rows.find((r) => r.cells && r.cells[0].replace(/\*+$/, "").trim() === designation);
  return row ? { columns: t.columns, cells: row.cells!, page: row.page } : null;
};

/* ---------- Series join: Table 1 group -> columns in Tables 3 and 9 ---------- */

type SeriesMap = { series: string; t3: string | null; t9: string | null; t3Note?: string };

/** Keyed by the start of the Table 1 group heading. Column names are exactly as in tables_data.json. */
const SERIES_BY_GROUP: [prefix: string, map: SeriesMap][] = [
  ["Original M998", { series: "M998", t3: "M998 and M998A1 series", t9: "M998 series" }],
  ["M1097 heavy", { series: "M998 (M1097 HHV)", t3: "M998 and M998A1 series", t9: "M1097 HHV" }],
  ["M998A1", { series: "M998A1", t3: "M998 and M998A1 series", t9: "M998A1 series" }],
  ["M998A2", { series: "M998A2", t3: "M998A2 series", t9: "M998A2 series" }],
  ["Expanded capability", { series: "ECV", t3: "ECV series", t9: "ECV (M1097A2)" }],
  ["M1100", {
    series: "M1100", t3: "ECV series", t9: "M1100 series",
    t3Note: "Table 3 has no M1100 column. Shown: the ECV series column, which has the same 190bhp turbo-diesel engine listed in Table 1.",
  }],
  // RECAP (R1) vehicles have no column in Table 3 or Table 9.
];

/** Rows left out of the join. Swept volume: Table 1 and Table 3 disagree. */
const SKIP_ROWS = new Set(["Swept volume"]);

export const seriesFor = (v: Variant): SeriesMap | null =>
  SERIES_BY_GROUP.find(([prefix]) => v.group.startsWith(prefix))?.[1] ?? null;

export type SpecSection = { group: string; rows: { label: string; value: string }[] };
export type SpecBlock = { column: string; pages: number[]; footnotes: string[]; sections: SpecSection[] };

/** Pull one column from a series table, keeping group headings. */
function columnOf(key: string, column: string | null): SpecBlock | null {
  if (!column) return null;
  const t = tables.find((x) => x.key === key)!;
  const ci = t.columns.indexOf(column);
  if (ci < 0) throw new Error(`${key}: no column "${column}"`);
  const sections: SpecSection[] = [];
  for (const r of t.rows) {
    if (r.group !== undefined) { sections.push({ group: r.group.replace(/:$/, ""), rows: [] }); continue; }
    const label = r.cells![0];
    if (SKIP_ROWS.has(label)) continue;
    if (!sections.length) sections.push({ group: "", rows: [] });
    sections[sections.length - 1].rows.push({ label, value: r.cells![ci] });
  }
  return { column, pages: t.pages, footnotes: t.footnotes ?? [], sections: sections.filter((s) => s.rows.length) };
}

export const engineFor = (v: Variant) => columnOf("table-03", seriesFor(v)?.t3 ?? null);
export const performanceFor = (v: Variant) => columnOf("table-09", seriesFor(v)?.t9 ?? null);

/** Display-only repair of an unbalanced bracket, e.g. "24in 610mm)" -> "24in (610mm)". Data stays as printed. */
export const repairBrackets = (s: string) => {
  const open = (s.match(/\(/g) ?? []).length, close = (s.match(/\)/g) ?? []).length;
  if (open > close) return s + ")";
  if (close > open) return s.replace(/(\s)([^\s()]*\))/, "$1($2");
  return s;
};

/**
 * Caption and credit for a photo. A spread half with no caption of its own takes them from its
 * other half (DATA-README: "The caption sits on one half"). `from` names the half they came from.
 */
export const captionOf = (p: Photo): { caption: string | null; credit: string | null; alt: string; from?: string } => {
  if (p.caption || p.related.length !== 1) return { caption: p.caption, credit: p.credit, alt: p.alt };
  const o = photoById(p.related[0]);
  if (!o?.caption) return { caption: p.caption, credit: p.credit, alt: p.alt };
  return { caption: o.caption, credit: p.credit ?? o.credit, alt: `Other half of a two-page spread: ${o.alt}`, from: o.id };
};
