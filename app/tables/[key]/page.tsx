import Link from "next/link";
import { notFound } from "next/navigation";
import { tables, tableImages } from "@/lib/data";
import { DataTable } from "@/lib/ui";
import { pageMeta, clip, tableTitle, JsonLd, breadcrumbLd, abs, SITE_NAME } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return tables.map((t) => ({ key: t.key })); }

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params; const t = tables.find((x) => x.key === key); if (!t) return {};
  const name = tableTitle(t);
  return pageMeta({
    title: /humvee/i.test(name) ? name : `Humvee ${name}`,
    description: clip(`${name} for the HMMWV, transcribed from the book with values as printed.${t.intro ? " " + t.intro : ""}`),
    path: `/tables/${t.key}/`,
  });
}

export default async function TablePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params; const t = tables.find((x) => x.key === key); if (!t) notFound();
  const scans = tableImages.filter((x) => x.table_key === key);
  const name = tableTitle(t);
  const dataset = {
    "@type": "Dataset",
    "@id": abs(`/tables/${t.key}/#dataset`),
    name: `Humvee (HMMWV) ${name}`,
    description: `${name}, transcribed cell by cell from pages ${t.pages.join(" and ")} of the book. Values are kept as printed.${t.intro ? " " + t.intro : ""}`,
    url: abs(`/tables/${t.key}/`),
    isAccessibleForFree: true,
    variableMeasured: t.columns.filter(Boolean),
    includedInDataCatalog: { "@type": "DataCatalog", name: SITE_NAME, url: abs("/tables/") },
    ...(scans.length && { image: scans.map((s) => abs(`/${s.image}`)) }),
  };
  return (
    <article className="wrap">
      <JsonLd data={[dataset, breadcrumbLd([["Home", "/"], ["Tables", "/tables/"], [name, `/tables/${t.key}/`]])]} />
      <nav aria-label="Breadcrumb" className="crumb mono"><Link href="/tables/">Tables</Link> › {t.title}</nav>
      <section className="sec"><h1 style={{ fontSize: 56 }}>{t.title}</h1>
        {t.intro && <p style={{ maxWidth: "70ch" }}>{t.intro}</p>}
        <DataTable t={t} />
        {t.footnotes && t.footnotes.length > 0 && <ul className="mono">{t.footnotes.map((f, i) => <li key={i}>{f}</li>)}</ul>}
        <div className="mono">Transcribed from pages {t.pages.join(", ")}. Typos printed in the book are kept as printed.</div>
        <h2 style={{ fontSize: 28 }}>Original scan</h2>
        {scans.map((s) => <img key={s.id} src={`/${s.image}`} alt={`Scan of ${t.title}, page ${s.page}`} loading="lazy" style={{ width: "100%", maxWidth: 1100, height: "auto" }} />)}
      </section>
    </article>
  );
}
