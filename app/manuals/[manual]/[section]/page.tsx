import Link from "next/link";
import { notFound } from "next/navigation";
import {
  manuals, manualById, sectionBySlug, manualPath, sectionPath, sectionLabel, pageRange, neighbours, figuresIn, firstText,
  credit, chapterTitle, pdfUrl, sectionSummary,
} from "@/lib/manuals";
import { proceduresFor, procedurePath } from "@/lib/procedures";
import { ManualBlocks } from "@/lib/ManualBlocks";
import { pageMeta, clip, JsonLd, breadcrumbLd, abs } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return manuals.flatMap((m) => m.data.sections.map((s) => ({ manual: m.id, section: s.slug })));
}

const lookup = async (params: Promise<{ manual: string; section: string }>) => {
  const { manual, section } = await params;
  const m = manualById(manual);
  const s = m && sectionBySlug(m, section);
  return m && s ? { m, s } : null;
};

export async function generateMetadata({ params }: { params: Promise<{ manual: string; section: string }> }) {
  const r = await lookup(params); if (!r) return {};
  const { m, s } = r;
  const where = s.kind === "para" ? `${m.number} para. ${s.id}` : m.number;
  const procs = s.kind === "para" ? proceduresFor(m.id).filter((p) => p.para === s.id).length : 0;
  const { lead, prose } = sectionSummary(m, s, procs);
  return pageMeta({
    title: `${s.kind === "appendix" ? s.title.replace(/^Appendix \w\. /, "") : s.title}, ${where}`,
    absoluteTitle: true,
    description: clip(`${lead} ${prose}`),
    path: sectionPath(m, s),
    type: "article",
  });
}

export default async function SectionPage({ params }: { params: Promise<{ manual: string; section: string }> }) {
  const r = await lookup(params); if (!r) notFound();
  const { m, s } = r;
  const { prev, next } = neighbours(m, s);
  const procs = s.kind === "para" ? proceduresFor(m.id).filter((p) => p.para === s.id) : [];
  const figs = figuresIn(m, s);
  const images = figs.map((f) => ({
    "@type": "ImageObject",
    contentUrl: abs(`/${f.image}`),
    thumbnailUrl: abs(`/${f.thumb}`),
    width: f.width, height: f.height,
    ...(f.alt && { caption: f.alt }),
    creditText: credit(m, f.printed_page),
  }));
  const where = [s.chapter && chapterTitle(m, s.chapter), s.section].filter(Boolean).join(" · ");
  const { lead, prose } = sectionSummary(m, s, procs.length);
  const name = s.kind === "appendix" ? s.title.replace(/^Appendix \w\. /, "") : s.title;
  const article = {
    "@type": "TechArticle",
    "@id": abs(`${sectionPath(m, s)}#article`),
    headline: `${name} (${m.number}${s.kind === "para" ? ` para. ${s.id}` : ""})`,
    name,
    description: lead,
    url: abs(sectionPath(m, s)),
    isPartOf: { "@id": abs(`${manualPath(m)}#book`), "@type": "Book", name: `${m.number}: ${m.title}, ${m.subject}`, url: abs(manualPath(m)) },
    about: m.subject,
    ...(where && { articleSection: where }),
    ...(s.printed && { pagination: s.printed[0] === s.printed[1] ? s.printed[0] : `${s.printed[0]}-${s.printed[1]}` }),
    datePublished: m.date,
    author: { "@type": "Organization", name: m.issuedBy },
    inLanguage: "en",
    isAccessibleForFree: true,
    ...(figs[0] && { image: abs(`/${figs[0].image}`) }),
    ...(procs.length && { hasPart: procs.map((p) => ({ "@type": "HowTo", name: `${p.title}: ${p.section}`, url: abs(procedurePath(p)) })) }),
  };
  return (
    <article className="wrap">
      <JsonLd data={[article, ...images, breadcrumbLd([["Home", "/"], ["Technical manuals", "/manuals/"], [m.number, manualPath(m)], [s.title, sectionPath(m, s)]])]} />
      <nav aria-label="Breadcrumb" className="crumb mono">
        <Link href="/manuals/">Technical manuals</Link> › <Link href={manualPath(m)}>{m.number}</Link> › {sectionLabel(s)}
      </nav>
      <section className="sec tm-sec">
        <div className="kicker">{m.number} · {sectionLabel(s)} · {pageRange(s)}</div>
        <h1 className="tm-h1">{s.kind === "appendix" ? s.title.replace(/^Appendix \w\. /, "") : s.title}</h1>
        {where && <p className="mono" style={{ margin: 0 }}>{where}</p>}
        <p className="lede">{lead}</p>
        {prose && <p style={{ margin: 0, maxWidth: "70ch" }}>{prose}</p>}
        <p className="mono" style={{ margin: 0 }}>
          Text as printed, typos included. <a href={pdfUrl(m, s.pages[0])}>Open the original PDF at page {s.printed?.[0] ?? s.pages[0]}</a>.
        </p>
        {procs.length > 0 && (
          <div className="tm-procs">
            {procs.map((p) => (
              <Link key={p.slug} href={procedurePath(p)} className="card">
                <span className="mono">Interactive procedure · page {p.page}</span>
                <strong>{p.title}: {p.section.replace(/^\w\. /, "").toLowerCase()}</strong>
                <span>{p.steps.length} steps with the traced parts diagram</span>
              </Link>
            ))}
          </div>
        )}
        <ManualBlocks m={m} s={s} />
        <nav className="tm-pager" aria-label="Sections">
          {prev ? <Link href={sectionPath(m, prev)} rel="prev"><span className="mono">Previous · {sectionLabel(prev)}</span><span>{prev.title}</span></Link> : <span />}
          {next ? <Link href={sectionPath(m, next)} rel="next"><span className="mono">Next · {sectionLabel(next)}</span><span>{next.title}</span></Link> : <span />}
        </nav>
      </section>
    </article>
  );
}
