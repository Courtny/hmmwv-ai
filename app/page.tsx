import Link from "next/link";
import { variants, photos, tables, groups } from "@/lib/data";
import { PhotoFigure } from "@/lib/ui";

export default function Home() {
  const featured = photos.filter((p) => p.caption && p.confidence >= 0.9 && p.kind === "photo").slice(0, 6);
  return (
    <div className="wrap">
      <section className="sec">
        <div className="kicker">Reference archive</div>
        <h1>Humvee<br />Reference</h1>
        <p style={{ fontSize: 21, maxWidth: "40ch" }}>{variants.length} variants, {photos.length} photos with credits and {tables.length} spec tables.</p>
      </section>
      <section className="sec"><div className="kicker">Browse by series</div>
        <div className="grid">{groups.map((g) => <Link key={g} className="card" href={`/variants/#${encodeURIComponent(g)}`}><strong>{g}</strong><span className="mono">{variants.filter((v) => v.group === g).length} variants</span></Link>)}</div>
      </section>
      <section className="sec"><h2>Featured photos</h2><div className="grid">{featured.map((p) => <PhotoFigure key={p.id} p={p} thumb />)}</div></section>
    </div>
  );
}
