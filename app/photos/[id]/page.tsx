import Link from "next/link";
import { notFound } from "next/navigation";
import { photos, photoById } from "@/lib/data";
export const dynamicParams = false;
export function generateStaticParams() { return photos.map((p) => ({ id: p.id })); }
export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = photoById(id); if (!p) notFound();
  const rel = p.related.map(photoById).filter(Boolean);
  return (
    <div className="wrap"><div className="crumb mono"><Link href="/photos/">Photos</Link> › {p.id}</div>
      <section className="sec">
        <img src={`/${p.image}`} alt={p.alt} style={{ width: "100%", height: "auto", maxWidth: 1100 }} />
        <p style={{ fontSize: 18, maxWidth: "70ch" }}>{p.caption ?? <em>No caption in the book.</em>}</p>
        <div className="mono">{p.credit ? `Photo: ${p.credit} · ` : ""}page {p.page}{p.printed_page ? ` (printed ${p.printed_page})` : ""} · {p.id}</div>
        {rel.length > 0 && <div><div className="kicker">Related (spread halves)</div>{rel.map((r) => <Link key={r!.id} href={`/photos/${r!.id}/`} className="card" style={{ marginTop: 8 }}>{r!.id}</Link>)}</div>}
      </section></div>
  );
}
