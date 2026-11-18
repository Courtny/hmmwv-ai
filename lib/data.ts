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
  const re = new RegExp(`(^|[^A-Za-z0-9])${designation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^0-9]|$)`);
  return photos.filter((p) => p.caption && re.test(p.caption));
};
export const groups = Array.from(new Set(variants.map((v) => v.group)));
/** Row from Table 8 (dimensions and weight) for a designation, if the book lists it. */
export const dimensionsFor = (designation: string) => {
  const t = tables.find((x) => x.key === "table-08")!;
  const row = t.rows.find((r) => r.cells && r.cells[0].trim() === designation);
  return row ? { columns: t.columns, cells: row.cells!, page: row.page } : null;
};
