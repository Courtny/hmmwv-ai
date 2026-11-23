import Link from "next/link";
import { manuals, manualPath, pdfUrl, pdfName, fileSize } from "@/lib/manuals";
import { proceduresFor } from "@/lib/procedures";
import { pageMeta, JsonLd, breadcrumbLd, abs } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Humvee technical manuals: Army TMs with diagrams and PDFs",
  description: "Army technical manuals for the Humvee (HMMWV), page by page with every figure and table, interactive parts diagrams, and the original PDF.",
  path: "/manuals/",
});

export default function Manuals() {
  const list = {
    "@type": "ItemList",
    itemListElement: manuals.map((m, i) => ({ "@type": "ListItem", position: i + 1, url: abs(manualPath(m)), name: `${m.number}: ${m.title}` })),
  };
  return (
    <div className="wrap">
      <JsonLd data={[list, breadcrumbLd([["Home", "/"], ["Technical manuals", "/manuals/"]])]} />
      <section className="sec">
        <div className="kicker">{manuals.length} technical manual{manuals.length === 1 ? "" : "s"}</div>
        <h1>Technical manuals</h1>
        <p className="lede">
          Army technical manuals for the Humvee, set out section by section with every figure and table as printed.
          Procedures with traced parts diagrams link each part to its callout, and the original PDF sits beside each manual.
        </p>
        <div className="grid tm-grid">
          {manuals.map((m) => {
            const procs = proceduresFor(m.id);
            const paras = m.data.sections.filter((s) => s.kind === "para").length;
            return (
              <article key={m.id} className="card tm-card">
                <Link href={manualPath(m)} className="tm-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/${m.data.cover.image}`} alt={`Cover of ${m.number}`} width={m.data.cover.width} height={m.data.cover.height} />
                </Link>
                <span className="mono">{m.number} · {m.date}</span>
                <Link href={manualPath(m)} className="tm-card-title"><strong>{m.subject}</strong></Link>
                <span>{m.title}</span>
                <span className="mono">
                  {paras} paragraphs · {Object.keys(m.data.figures).length} figures · {m.data.pdf.pages} pages
                  {procs.length > 0 && ` · ${procs.length} interactive procedure${procs.length === 1 ? "" : "s"}`}
                </span>
                <a className="mono" href={pdfUrl(m)} download={pdfName(m)}>Download PDF ({fileSize(m.data.pdf.bytes)})</a>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
