import Link from "next/link";
import { notFound } from "next/navigation";
import { variants, photosFor, dimensionsFor } from "@/lib/data";
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
        <div className="tw"><table><tbody>{dims.columns.slice(1).map((c, i) => <tr key={c}><td>{c}</td><td>{dims.cells[i + 1]}</td></tr>)}</tbody></table></div>
        <div className="mono">Table 8, page {dims.page}. Values shown as printed in the book.</div></section>}
      {pics.length > 0 && <section className="sec"><h2>Photos ({pics.length})</h2><div className="grid">{pics.map((p) => <PhotoFigure key={p.id} p={p} thumb />)}</div></section>}
      {siblings.length > 0 && <section className="sec"><div className="kicker">Also in this series</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{siblings.map((s) => <Link key={s.slug} href={`/variants/${s.slug}/`} className="card" style={{ padding: "8px 14px" }}>{s.designation}</Link>)}</div></section>}
    </div>
  );
}
