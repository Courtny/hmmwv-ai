import Link from "next/link";
import { notFound } from "next/navigation";
import { manuals, manualById, manualPath, sectionPath, sectionLabel, pageRange, contents, credit, pdfUrl, pdfName, fileSize } from "@/lib/manuals";
import { proceduresFor, procedurePath } from "@/lib/procedures";
import { pageMeta, clip, JsonLd, breadcrumbLd, abs } from "@/lib/seo";

export const dynamicParams = false;

const groupBy = <T,>(xs: T[], key: (x: T) => string) =>
  xs.reduce<[string, T[]][]>((out, x) => {
    const k = key(x), last = out[out.length - 1];
    if (last && last[0] === k) last[1].push(x); else out.push([k, [x]]);
    return out;
  }, []);
export function generateStaticParams() { return manuals.map((m) => ({ manual: m.id })); }

export async function generateMetadata({ params }: { params: Promise<{ manual: string }> }) {
  const m = manualById((await params).manual); if (!m) return {};
  return pageMeta({
    title: `${m.number}: ${m.subject} ${m.noun}`,
    description: clip(`${m.number} (${m.date}): ${m.summary}`),
    path: manualPath(m),
  });
}

export default async function ManualPage({ params }: { params: Promise<{ manual: string }> }) {
  const m = manualById((await params).manual); if (!m) notFound();
  const procs = proceduresFor(m.id);
  const book = {
    "@type": "Book",
    "@id": abs(`${manualPath(m)}#book`),
    name: `${m.number}: ${m.title}, ${m.subject}`,
    url: abs(manualPath(m)),
    bookFormat: "https://schema.org/EBook",
    numberOfPages: m.data.pdf.pages,
    datePublished: m.date,
    author: { "@type": "Organization", name: m.issuedBy },
    isAccessibleForFree: true,
    image: abs(`/${m.data.cover.image}`),
    encoding: { "@type": "MediaObject", contentUrl: abs(pdfUrl(m)), encodingFormat: "application/pdf", contentSize: fileSize(m.data.pdf.bytes) },
  };
  return (
    <article className="wrap">
      <JsonLd data={[book, breadcrumbLd([["Home", "/"], ["Technical manuals", "/manuals/"], [m.number, manualPath(m)]])]} />
      <nav aria-label="Breadcrumb" className="crumb mono"><Link href="/manuals/">Technical manuals</Link> › {m.number}</nav>
      <section className="sec">
        <div className="kicker">Technical manual · {m.date}</div>
        <h1>{m.number}</h1>
        <p className="lede">{m.title}: {m.subject}. {m.summary.replace(/^[^:]*: /, "").replace(/^./, (c) => c.toUpperCase())}</p>
        <div className="tm-head">
          <figure className="tm-cover-fig">
            <a href={pdfUrl(m)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/${m.data.cover.image}`} alt={`Cover of ${m.number}, ${m.title}`} width={m.data.cover.width} height={m.data.cover.height} />
            </a>
            <figcaption className="mono">Cover. {credit(m, null)}.</figcaption>
          </figure>
          <div className="tm-facts">
            <a className="tm-download" href={pdfUrl(m)} download={pdfName(m)}>
              <strong>Download the original PDF</strong>
              <span className="mono">{pdfName(m)} · {m.data.pdf.pages} pages · {fileSize(m.data.pdf.bytes)}</span>
            </a>
            <dl>
              <dt>Covers</dt><dd>{m.equipment}</dd>
              <dt>Also numbered</dt><dd>{m.otherNumbers.join("; ")}</dd>
              <dt>Issued by</dt><dd>{m.issuedBy}, {m.date}</dd>
              {m.supersedes && <><dt>Supersedes</dt><dd>{m.supersedes}</dd></>}
              <dt>Distribution</dt><dd>{m.distribution}</dd>
              <dt>On this site</dt>
              <dd>
                {m.data.sections.length} sections, {Object.keys(m.data.figures).length} figures and {Object.keys(m.data.tables).length} transcribed tables.
                Text is kept as printed, typos included.
              </dd>
            </dl>
          </div>
        </div>
      </section>

      {procs.length > 0 && (
        <section className="sec" id="procedures">
          <h2>Interactive procedures</h2>
          <p style={{ maxWidth: "70ch", margin: 0 }}>
            {procs.length} procedures, one per lettered subsection: the steps as printed beside the traced figures.
            Pick a part number in a step to find its callout on the diagram.
          </p>
          <div className="tm-proc-list">
            {groupBy(procs, (p) => p.para).map(([para, ps]) => (
              <div key={para}>
                <h3><span className="mono">{para}</span> {ps[0].title}</h3>
                <ul>
                  {ps.map((p) => (
                    <li key={p.slug}>
                      <Link href={procedurePath(p)}>{p.section}</Link>
                      <span className="mono">{p.steps.length} steps · {p.diagrams.length === 1 ? "1 diagram" : `${p.diagrams.length} diagrams`}{p.draft ? " · draft" : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="sec" id="contents">
        <h2>Contents</h2>
        <div className="tm-toc">
          {contents(m).map((ch) => (
            <div key={ch.heading} className="tm-toc-ch">
              <h3>{ch.heading}</h3>
              {ch.groups.map((g, gi) => (
                <div key={gi}>
                  {g.heading && <div className="tm-toc-sec mono">{g.heading}</div>}
                  <ol>
                    {g.sections.map((s) => (
                      <li key={s.slug}>
                        <Link href={sectionPath(m, s)}>
                          <span className="mono">{s.kind === "para" ? s.id : sectionLabel(s)}</span>
                          <span>{s.kind === "appendix" ? s.title.replace(/^Appendix \w\. /, "") : s.title}</span>
                          <span className="mono pg">{pageRange(s).replace(/^pages? /, "")}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
