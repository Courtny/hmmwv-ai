import Link from "next/link";
import { notFound } from "next/navigation";
import { variants, photosFor, dimensionsFor, seriesFor, engineFor, performanceFor, repairBrackets, tables } from "@/lib/data";
import type { SpecBlock } from "@/lib/data";
import { PhotoFigure } from "@/lib/ui";

export const dynamicParams = false;
export function generateStaticParams() { return variants.map((v) => ({ slug: v.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const v = variants.find((x) => x.slug === slug); return { title: v?.designation };
}

export default async function VariantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = variants.find((x) => x.slug === slug); if (!v) notFound();
  const pics = photosFor(v.designation); const dims = dimensionsFor(v.designation);
  const series = seriesFor(v); const engine = engineFor(v); const perf = performanceFor(v);
  const t8 = tables.find((t) => t.key === "table-08")!;
  const dimMark = dims?.cells[0].match(/\*+$/)?.[0];
  const dimNotes = dimMark ? (t8.footnotes ?? []).filter((f) => f.startsWith(dimMark + " ")) : [];
  const siblings = variants.filter((x) => x.group === v.group && x.slug !== v.slug);
  return (
    <div className="wrap">
      <div className="crumb mono"><Link href="/variants/">Variants</Link> › {v.group} › {v.designation}</div>
      <section className="sec">
        <div className="kicker">{v.group} · {v.year}</div>
        <h1>{v.designation}</h1>
        <p style={{ fontSize: 21, maxWidth: "40ch" }}>{v.description}</p>
        <div className="grid">
          <div className="card"><span className="mono">Engine</span><strong>{v.engine}</strong></div>
          <div className="card"><span className="mono">Transmission</span><strong>{v.transmission}</strong></div>
          <div className="card"><span className="mono">Source</span><strong>Table 1, page {v.page}</strong></div>
        </div>
      </section>
      {dims && <section className="sec"><h2>Dimensions and weight</h2>
        <div className="tw"><table><tbody>{dims.columns.slice(1).map((c, i) => <tr key={c}><td>{c}</td><td>{repairBrackets(dims.cells[i + 1])}</td></tr>)}</tbody></table></div>
        {dimNotes.map((f) => <p key={f} className="mono">{f}</p>)}
        <div className="mono">Table 8, page {dims.page}.</div></section>}
      {engine && <SpecSection title="Engine and transmission" table="Table 3" block={engine}
        note={[series?.t3Note, "Swept volume is left out because Table 1 and Table 3 give different figures."].filter(Boolean).join(" ")} />}
      {perf && <SpecSection title="Automotive performance" table="Table 9" block={perf} />}
      {!series && <section className="sec"><p className="mono">The book gives no series column for {v.group} vehicles in Tables 3 or 9.</p></section>}
      {pics.length > 0 && <section className="sec"><h2>Photos ({pics.length})</h2><div className="grid">{pics.map((p) => <PhotoFigure key={p.id} p={p} thumb />)}</div></section>}
      {siblings.length > 0 && <section className="sec"><div className="kicker">Also in this series</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{siblings.map((s) => <Link key={s.slug} href={`/variants/${s.slug}/`} className="card" style={{ padding: "8px 14px" }}>{s.designation}</Link>)}</div></section>}
    </div>
  );
}

function SpecSection({ title, table, block, note }: { title: string; table: string; block: SpecBlock; note?: string }) {
  return (
    <section className="sec"><h2>{title}</h2>
      <div className="tw"><table><tbody>{block.sections.map((sec) => [
        sec.group ? <tr key={`g-${sec.group}`} className="grp"><td colSpan={2}>{sec.group}</td></tr> : null,
        ...sec.rows.map((r) => <tr key={`${sec.group}-${r.label}`}><td>{r.label}</td><td>{repairBrackets(r.value)}</td></tr>),
      ])}</tbody></table></div>
      {block.footnotes.map((f) => <p key={f} className="mono">{f}</p>)}
      {note && <p className="mono">{note}</p>}
      <div className="mono">{table}, column &ldquo;{block.column}&rdquo;, page {block.pages.join(" and ")}.</div>
    </section>
  );
}
