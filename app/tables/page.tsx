import Link from "next/link";
import { tables } from "@/lib/data";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ title: "Humvee (HMMWV) spec tables", description: "Humvee spec tables transcribed from the book: variants, engine and performance, capacities, oil grades, dimensions and weight, automotive performance.", path: "/tables/" });
export default function Tables() {
  return <div className="wrap"><section className="sec"><h1>Tables</h1>
    <div className="grid">{tables.map((t) => <Link key={t.key} className="card" href={`/tables/${t.key}/`}><strong>{t.title}</strong><span className="mono">pages {t.pages.join(", ")}</span></Link>)}</div></section></div>;
}
