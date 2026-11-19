import { card, OG_SIZE } from "@/lib/og";
import { tables } from "@/lib/data";
import { tableTitle } from "@/lib/seo";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Humvee spec table";
export function generateStaticParams() { return tables.map((t) => ({ key: t.key })); }

export default async function Image({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const t = tables.find((x) => x.key === key)!;
  const [num, name] = tableTitle(t).split(": ");
  const rows = t.rows.filter((r) => r.cells).length;
  return card({
    kicker: `${num} · page${t.pages.length > 1 ? "s" : ""} ${t.pages.join(" and ")}`,
    title: name,
    subtitle: "Transcribed cell by cell from the book. Values kept as printed.",
    footer: `${rows} rows · ${t.columns.filter(Boolean).length} columns · hmmwv.ai/tables/${t.key}/`,
  });
}
export const dynamic = "force-static";
