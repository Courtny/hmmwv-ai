import { notFound } from "next/navigation";
import { procedures, procedureBySlug, procedurePath, diagramUrl } from "@/lib/procedures";
import { DiagramWindow } from "@/lib/DiagramWindow";

/** The diagram-only window a procedure page opens (New window). Not indexed: it repeats the procedure page. */
export const dynamicParams = false;
export function generateStaticParams() { return procedures.map((p) => ({ manual: p.manualId, slug: p.slug })); }

const lookup = async (params: Promise<{ manual: string; slug: string }>) => {
  const { manual, slug } = await params;
  const p = procedureBySlug(slug);
  return p && p.manualId === manual ? p : undefined;
};

export async function generateMetadata({ params }: { params: Promise<{ manual: string; slug: string }> }) {
  const p = await lookup(params); if (!p) return {};
  return {
    title: `Diagram: ${p.title}, ${p.section.replace(/^\w\. /, "").toLowerCase()}`,
    description: `The ${p.diagrams.length === 1 ? "diagram" : `${p.diagrams.length} diagrams`} for ${p.title}, ${p.section}, in a window of their own, kept in step with the procedure page.`,
    alternates: { canonical: procedurePath(p) },
    robots: { index: false, follow: true },
  };
}

export default async function DiagramWindowPage({ params }: { params: Promise<{ manual: string; slug: string }> }) {
  const p = await lookup(params); if (!p) notFound();
  return <DiagramWindow proc={p} srcs={p.diagrams.map(diagramUrl)} path={procedurePath(p)} />;
}
