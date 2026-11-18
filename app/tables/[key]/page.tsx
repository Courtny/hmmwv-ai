import Link from "next/link";
import { notFound } from "next/navigation";
import { tables, tableImages } from "@/lib/data";
import { DataTable } from "@/lib/ui";
export const dynamicParams = false;
export function generateStaticParams() { return tables.map((t) => ({ key: t.key })); }
export default async function TablePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params; const t = tables.find((x) => x.key === key); if (!t) notFound();
  const scans = tableImages.filter((x) => x.table_key === key);
  return (
    <div className="wrap"><div className="crumb mono"><Link href="/tables/">Tables</Link> › {t.title}</div>
      <section className="sec"><h1 style={{ fontSize: 56 }}>{t.title}</h1>
        {t.intro && <p style={{ maxWidth: "70ch" }}>{t.intro}</p>}
        <DataTable t={t} />
        {t.footnotes && t.footnotes.length > 0 && <ul className="mono">{t.footnotes.map((f, i) => <li key={i}>{f}</li>)}</ul>}
        <div className="mono">Transcribed from pages {t.pages.join(", ")}. Typos printed in the book are kept as printed.</div>
        <h2 style={{ fontSize: 28 }}>Original scan</h2>
        {scans.map((s) => <img key={s.id} src={`/${s.image}`} alt={`Scan of ${t.title}, page ${s.page}`} style={{ width: "100%", maxWidth: 1100, height: "auto" }} />)}
      </section></div>
  );
}
