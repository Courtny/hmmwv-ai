import Link from "next/link";
import { notFound } from "next/navigation";
import { procedures, procedureBySlug, diagramUrl } from "@/lib/procedures";
import { ProcedureView } from "@/lib/ProcedureView";
import { pageMeta, JsonLd, breadcrumbLd, abs } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return procedures.map((p) => ({ slug: p.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const p = procedureBySlug(slug); if (!p) return {};
  return {
    ...pageMeta({
      title: `${p.title}: ${p.section.replace(/^\w\. /, "").toLowerCase()} (${p.manual} para. ${p.para})`,
      description: `${p.title}, ${p.section.replace(/^\w\. /, "").toLowerCase()}: ${p.steps.length} steps with an interactive parts diagram, from ${p.manual}, page ${p.page}.`,
      path: `/procedures/${p.slug}/`,
    }),
    // Test page: keep it out of search until it is approved.
    robots: { index: false, follow: true },
  };
}

export default async function ProcedurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const p = procedureBySlug(slug); if (!p) notFound();
  const howTo = {
    "@type": "HowTo",
    name: `${p.title}: ${p.section}`,
    tool: [{ "@type": "HowToTool", name: "Pipe sealing compound" }],
    supply: p.parts.map((x) => ({ "@type": "HowToSupply", name: x.name, ...(x.qty && { requiredQuantity: x.qty }) })),
    step: p.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
    image: abs(diagramUrl(p)),
  };
  return (
    <article className="wrap wide">
      <JsonLd data={[howTo, breadcrumbLd([["Home", "/"], ["Procedures", `/procedures/${p.slug}/`], [p.title, `/procedures/${p.slug}/`]])]} />
      <nav aria-label="Breadcrumb" className="crumb mono"><Link href="/">Home</Link> › {p.manual} › para. {p.para}</nav>
      <section className="sec">
        <div className="kicker">{p.manual} · para. {p.para} · page {p.page}</div>
        <h1>{p.title}</h1>
        <p className="lede">{p.section}</p>
        <ProcedureView proc={p} src={diagramUrl(p)} />
        <p className="mono">Text transcribed as printed in {p.manual}, page {p.page}. Torque values and part numbers are the manual&rsquo;s.</p>
      </section>
    </article>
  );
}
