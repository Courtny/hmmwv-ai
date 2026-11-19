import Link from "next/link";
import { procedures, anyPublished, diagramUrl } from "@/lib/procedures";
import { pageMeta, JsonLd, breadcrumbLd, abs } from "@/lib/seo";

export const metadata = {
  ...pageMeta({
    title: "Humvee maintenance procedures with parts diagrams",
    description: "Humvee (HMMWV) maintenance procedures from the Army technical manuals, with the steps as printed and interactive exploded-view parts diagrams.",
    path: "/procedures/",
  }),
  ...(!anyPublished() && { robots: { index: false, follow: true } }),
};

/** Procedures grouped by technical manual, in paragraph order. */
const byManual = () => {
  const m = new Map<string, typeof procedures>();
  for (const p of [...procedures].sort((a, b) => a.para.localeCompare(b.para, undefined, { numeric: true })))
    m.set(p.manual, [...(m.get(p.manual) ?? []), p]);
  return [...m];
};

export default function Procedures() {
  const list = {
    "@type": "ItemList",
    itemListElement: procedures.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/procedures/${p.slug}/`), name: p.title })),
  };
  return (
    <div className="wrap">
      <JsonLd data={[list, breadcrumbLd([["Home", "/"], ["Procedures", "/procedures/"]])]} />
      <section className="sec">
        <div className="kicker">{procedures.length} procedure{procedures.length === 1 ? "" : "s"}</div>
        <h1>Procedures</h1>
        <p className="lede">Maintenance procedures from the Army technical manuals. Steps are transcribed as printed, and every part number links to its callout on the exploded-view diagram.</p>
        {byManual().map(([manual, ps]) => (
          <div key={manual} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: 30 }}>{manual}</h2>
            <div className="grid proc-grid">
              {ps.map((p) => (
                <Link key={p.slug} href={`/procedures/${p.slug}/`} className="card proc-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={diagramUrl(p)} alt="" width={p.diagram.viewBox[0]} height={p.diagram.viewBox[1]} loading="lazy" />
                  <span className="mono">para. {p.para} · page {p.page}</span>
                  <strong style={{ fontSize: 22 }}>{p.title}</strong>
                  <span>{p.section}</span>
                  <span className="mono">{p.steps.length} steps · {p.parts.length} parts{p.draft ? " · draft" : ""}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
