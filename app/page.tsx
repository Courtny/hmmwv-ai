import Link from "next/link";
import { variants, photos, tables, groups } from "@/lib/data";
import { PhotoFigure } from "@/lib/ui";
import { pageMeta } from "@/lib/seo";
import { manuals, manualPath } from "@/lib/manuals";
import { proceduresFor } from "@/lib/procedures";

export const metadata = pageMeta({ title: "Humvee (HMMWV) Variants, Specs and Photos | hmmwv.ai", absoluteTitle: true, description: "Humvee (HMMWV) reference: every factory variant with engine, dimensions and performance data, credited photos, spec tables and Army technical manuals.", path: "/" });

export default function Home() {
  const featured = photos.filter((p) => p.caption && p.confidence >= 0.9 && p.kind === "photo").slice(0, 6);
  return (
    <div className="wrap">
      <section className="sec">
        <div className="kicker">Reference archive</div>
        <h1>Humvee<br />Reference</h1>
        <p style={{ fontSize: 21, maxWidth: "40ch" }}>{variants.length} variants, {photos.length} photos with credits, {tables.length} spec tables and {manuals.length} technical manual{manuals.length === 1 ? "" : "s"}.</p>
      </section>
      <section className="sec"><div className="kicker">Browse by series</div>
        <div className="grid">{groups.map((g) => <Link key={g} className="card" href={`/variants/#${encodeURIComponent(g)}`}><strong>{g}</strong><span className="mono">{variants.filter((v) => v.group === g).length} variants</span></Link>)}</div>
      </section>
      <section className="sec"><div className="kicker">Technical manuals</div>
        <div className="grid">{manuals.map((m) => (
          <Link key={m.id} className="card" href={manualPath(m)}>
            <strong>{m.number}: {m.subject} {m.noun}</strong>
            <span>{m.title}, {m.date}</span>
            <span className="mono">{m.data.sections.length} sections · {Object.keys(m.data.figures).length} figures{proceduresFor(m.id).length > 0 && ` · ${proceduresFor(m.id).length} interactive procedures`} · PDF</span>
          </Link>
        ))}</div>
      </section>
      <section className="sec"><h2>Featured photos</h2><div className="grid">{featured.map((p) => <PhotoFigure key={p.id} p={p} thumb />)}</div></section>
    </div>
  );
}
