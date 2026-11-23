import Link from "next/link";
import { notFound } from "next/navigation";
import { procedures, procedureBySlug, procedurePath, diagramUrl } from "@/lib/procedures";
import { manualById, manualPath, sectionPath } from "@/lib/manuals";
import { ProcedureView } from "@/lib/ProcedureView";
import { pageMeta, JsonLd, breadcrumbLd, abs } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return procedures.map((p) => ({ manual: p.manualId, slug: p.slug })); }

const lookup = async (params: Promise<{ manual: string; slug: string }>) => {
  const { manual, slug } = await params;
  const p = procedureBySlug(slug);
  return p && p.manualId === manual ? p : undefined;
};
const what = (section: string) => section.replace(/^\w\. /, "").toLowerCase();

export async function generateMetadata({ params }: { params: Promise<{ manual: string; slug: string }> }) {
  const p = await lookup(params); if (!p) return {};
  return {
    ...pageMeta({
      title: `${p.title}: ${what(p.section)} (${p.manual} para. ${p.para})`,
      description: `${p.title}, ${what(p.section)}: ${p.steps.length} steps with an interactive parts diagram, from ${p.manual}, page ${p.page}.`,
      path: procedurePath(p),
    }),
    ...(p.draft && { robots: { index: false, follow: true } }),
  };
}

export default async function ProcedurePage({ params }: { params: Promise<{ manual: string; slug: string }> }) {
  const p = await lookup(params); if (!p) notFound();
  const m = manualById(p.manualId)!;
  const para = m.data.sections.find((s) => s.kind === "para" && s.id === p.para);
  const howTo = {
    "@type": "HowTo",
    name: `${p.title}: ${p.section}`,
    ...(p.tools?.length && { tool: p.tools.map((name) => ({ "@type": "HowToTool", name })) }),
    supply: p.parts.map((x) => ({ "@type": "HowToSupply", name: x.name, ...(x.qty && { requiredQuantity: x.qty }) })),
    step: p.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
    image: abs(diagramUrl(p)),
  };
  return (
    <article className="wrap wide">
      <JsonLd data={[howTo, breadcrumbLd([["Home", "/"], ["Technical manuals", "/manuals/"], [m.number, manualPath(m)], [p.title, procedurePath(p)]])]} />
      <nav aria-label="Breadcrumb" className="crumb mono">
        <Link href="/manuals/">Technical manuals</Link> › <Link href={manualPath(m)}>{m.number}</Link> ›{" "}
        {para ? <Link href={sectionPath(m, para)}>para. {p.para}</Link> : <>para. {p.para}</>}
      </nav>
      <section className="sec">
        <div className="kicker">{p.manual} · para. {p.para} · page {p.page}</div>
        <h1>{p.title}</h1>
        <p className="lede">{p.section}</p>
        <ProcedureView proc={p} src={diagramUrl(p)} />
        <p className="mono">
          Text transcribed as printed in {p.manual}, page {p.page}. Torque values and part numbers are the manual&rsquo;s.
          {para && <> The full paragraph, with every figure, is in <Link href={sectionPath(m, para)}>para. {p.para} of the manual</Link>.</>}
        </p>
      </section>
    </article>
  );
}
