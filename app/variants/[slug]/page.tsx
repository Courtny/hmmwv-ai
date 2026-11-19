import Link from "next/link";
import { notFound } from "next/navigation";
import { variants, photosFor, dimensionsFor, seriesFor, engineFor, performanceFor, repairBrackets, tables } from "@/lib/data";
import type { SpecBlock, Variant } from "@/lib/data";
import { PhotoFigure } from "@/lib/ui";
import { pageMeta, clip, variantSummary, JsonLd, imageLd, breadcrumbLd, abs } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return variants.map((v) => ({ slug: v.slug })); }

const find = (slug: string) => variants.find((x) => x.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const v = find(slug); if (!v) return {};
  return pageMeta({
    title: `${v.designation}${variants.filter((x) => x.designation === v.designation).length > 1 ? ` (${v.year})` : ""} Humvee: specs, dimensions and photos`,
    description: clip(`${v.designation} HMMWV: ${v.description}. ${v.year}, ${v.engine}, ${v.transmission}. Engine, performance and dimension data with photos.`),
    path: `/variants/${v.slug}/`,
    type: "article",
  });
}

function vehicleLd(v: Variant, dims: ReturnType<typeof dimensionsFor>, pics: ReturnType<typeof photosFor>) {
  return {
    "@type": "Vehicle",
    "@id": abs(`/variants/${v.slug}/#vehicle`),
    name: `${v.designation} HMMWV`,
    model: v.designation,
    description: v.description,
    vehicleModelDate: v.year,
    category: v.group,
    vehicleEngine: { "@type": "EngineSpecification", name: v.engine },
    vehicleTransmission: v.transmission,
    url: abs(`/variants/${v.slug}/`),
    ...(dims && { additionalProperty: dims.columns.slice(1).map((c, i) => ({ "@type": "PropertyValue", name: c, value: repairBrackets(dims.cells[i + 1]) })) }),
    ...(pics.length && { image: pics.slice(0, 5).map(imageLd) }),
  };
}

export default async function VariantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = find(slug); if (!v) notFound();
  const pics = photosFor(v.designation); const dims = dimensionsFor(v.designation);
  const series = seriesFor(v); const engine = engineFor(v); const perf = performanceFor(v);
  const t8 = tables.find((t) => t.key === "table-08")!;
  const dimMark = dims?.cells[0].match(/\*+$/)?.[0];
  const dimNotes = dimMark ? (t8.footnotes ?? []).filter((f) => f.startsWith(dimMark + " ")) : [];
  const siblings = variants.filter((x) => x.group === v.group && x.slug !== v.slug);
  return (
    <article className="wrap">
      <JsonLd data={[vehicleLd(v, dims, pics), breadcrumbLd([["Home", "/"], ["Variants", "/variants/"], [v.designation, `/variants/${v.slug}/`]])]} />
      <nav aria-label="Breadcrumb" className="crumb mono"><Link href="/variants/">Variants</Link> › {v.group} › {v.designation}</nav>
      <section className="sec">
        <div className="kicker">{v.group} · {v.year}</div>
        <h1>{v.designation}</h1>
        <p style={{ fontSize: 21, maxWidth: "40ch" }}>{v.description}</p>
        <p className="lede">{variantSummary(v)}</p>
        <div className="grid">
          <div className="card"><span className="mono">Engine</span><strong>{v.engine}</strong></div>
          <div className="card"><span className="mono">Transmission</span><strong>{v.transmission}</strong></div>
          <div className="card"><span className="mono">Source</span><strong>Table 1, page {v.page}</strong></div>
        </div>
      </section>
      {dims && <section className="sec"><h2>{v.designation} dimensions and weight</h2>
        <div className="tw"><table><caption className="sr">{v.designation} dimensions and weight, Table 8</caption><tbody>{dims.columns.slice(1).map((c, i) => <tr key={c}><th scope="row">{c}</th><td>{repairBrackets(dims.cells[i + 1])}</td></tr>)}</tbody></table></div>
        {dimNotes.map((f) => <p key={f} className="mono">{f}</p>)}
        <div className="mono">Table 8, page {dims.page}.</div></section>}
      {engine && <SpecSection title={`${v.designation} engine and transmission`} table="Table 3" block={engine}
        note={[series?.t3Note, "Swept volume is left out because Table 1 and Table 3 give different figures."].filter(Boolean).join(" ")} />}
      {perf && <SpecSection title={`${v.designation} automotive performance`} table="Table 9" block={perf} />}
      {!series && <section className="sec"><p className="mono">The book gives no series column for {v.group} vehicles in Tables 3 or 9.</p></section>}
      {pics.length > 0 && <section className="sec"><h2>{v.designation} photos ({pics.length})</h2><div className="grid">{pics.map((p) => <PhotoFigure key={p.id} p={p} thumb />)}</div></section>}
      {siblings.length > 0 && <section className="sec"><h2 className="kicker">Also in this series</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{siblings.map((s) => <Link key={s.slug} href={`/variants/${s.slug}/`} className="card" style={{ padding: "8px 14px" }}>{s.designation}</Link>)}</div></section>}
    </article>
  );
}

function SpecSection({ title, table, block, note }: { title: string; table: string; block: SpecBlock; note?: string }) {
  return (
    <section className="sec"><h2>{title}</h2>
      <div className="tw"><table><caption className="sr">{title}, {table}</caption><tbody>{block.sections.map((sec) => [
        sec.group ? <tr key={`g-${sec.group}`} className="grp"><td colSpan={2}>{sec.group}</td></tr> : null,
        ...sec.rows.map((r) => <tr key={`${sec.group}-${r.label}`}><th scope="row">{r.label}</th><td>{repairBrackets(r.value)}</td></tr>),
      ])}</tbody></table></div>
      {block.footnotes.map((f) => <p key={f} className="mono">{f}</p>)}
      {note && <p className="mono">{note}</p>}
      <div className="mono">{table}, column &ldquo;{block.column}&rdquo;, page {block.pages.join(" and ")}.</div>
    </section>
  );
}
