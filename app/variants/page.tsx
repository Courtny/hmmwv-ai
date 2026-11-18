import Link from "next/link";
import { variants, groups } from "@/lib/data";
export const metadata = { title: "Variants" };
export default function Variants() {
  return (
    <div className="wrap"><section className="sec"><div className="kicker">Table 1</div><h1>Variants</h1>
      {groups.map((g) => (
        <div key={g} id={encodeURIComponent(g)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontSize: 30 }}>{g}</h2>
          <div className="grid">{variants.filter((v) => v.group === g).map((v) => (
            <Link key={v.slug} href={`/variants/${v.slug}/`} className="card"><strong style={{ fontSize: 20 }}>{v.designation}</strong><span className="mono">{v.year}</span><span>{v.description}</span></Link>))}</div>
        </div>))}
    </section></div>
  );
}
