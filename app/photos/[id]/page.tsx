import Link from "next/link";
import { notFound } from "next/navigation";
import { photos, photoById, variants, captionOf } from "@/lib/data";
import { pageMeta, clip, JsonLd, imageLd, breadcrumbLd } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return photos.map((p) => ({ id: p.id })); }

const heading = (alt: string, n = 70) => clip(alt.replace(/\.$/, ""), n);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = photoById(id); if (!p) return {};
  const c = captionOf(p);
  return pageMeta({
    title: c.from ? `${heading(photoById(c.from)!.alt, 36)} (spread, ${p.id})` : `${heading(c.alt, 44)} (${p.id})`,
    description: `${clip(`${c.caption ?? `${c.alt}. Uncaptioned ${p.kind} from the book`}${c.credit ? ` Photo: ${c.credit}.` : ""}`, 140)} (${p.id})`,
    path: `/photos/${p.id}/`,
    image: p,
  });
}

/** Variants whose designation appears in the caption, longest first so M1025A2 wins over M1025. */
const variantsIn = (caption: string | null) => {
  if (!caption) return [];
  const hits = variants.filter((v, i, a) => a.findIndex((x) => x.designation === v.designation) === i
    && new RegExp(`(^|[^A-Za-z0-9])${v.designation}([^A-Za-z0-9]|$)`).test(caption));
  return hits.sort((a, b) => b.designation.length - a.designation.length);
};

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = photoById(id); if (!p) notFound();
  const rel = p.related.map(photoById).filter(Boolean);
  const c = captionOf(p);
  const vs = variantsIn(c.caption);
  return (
    <article className="wrap">
      <JsonLd data={[imageLd(p), breadcrumbLd([["Home", "/"], ["Photos", "/photos/"], [p.id, `/photos/${p.id}/`]])]} />
      <nav aria-label="Breadcrumb" className="crumb mono"><Link href="/photos/">Photos</Link> › {p.id}</nav>
      <section className="sec">
        <h1 style={{ fontSize: 40 }}>{heading(c.alt)}</h1>
        <figure>
          <img src={`/${p.image}`} alt={c.alt} width={p.width} height={p.height} style={{ width: "100%", height: "auto", maxWidth: Math.min(1100, p.width) }} />
          <figcaption style={{ fontSize: 18, maxWidth: "70ch", color: "inherit" }}>{c.caption ?? <em>No caption in the book.</em>}{c.from && <> <em>(Caption and credit printed with <Link href={`/photos/${c.from}/`}>{c.from}</Link>, the other half of this spread.)</em></>}</figcaption>
        </figure>
        <div className="mono">{c.credit ? `Photo: ${c.credit} · ` : ""}page {p.page}{p.printed_page ? ` (printed ${p.printed_page})` : ""} · {p.id}</div>
        {vs.length > 0 && <div><h2 className="kicker">Variants in this photo</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>{vs.map((v) => <Link key={v.slug} href={`/variants/${v.slug}/`} className="card" style={{ padding: "8px 14px" }}>{v.designation}</Link>)}</div></div>}
        {rel.length > 0 && <div><h2 className="kicker">Related (spread halves)</h2>{rel.map((r) => <Link key={r!.id} href={`/photos/${r!.id}/`} className="card" style={{ marginTop: 8 }}>{r!.id}</Link>)}</div>}
      </section>
    </article>
  );
}
