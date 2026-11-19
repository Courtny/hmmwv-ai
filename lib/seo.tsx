import type { Metadata } from "next";
import { captionOf } from "./data";
import type { Photo, Table, Variant } from "./data";

export const SITE_URL = "https://hmmwv.ai";
export const SITE_NAME = "hmmwv.ai";
export const abs = (path: string) => new URL(path, SITE_URL).toString();

/** Trim to a meta-description length on a word boundary. */
export const clip = (s: string, n = 155) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,;:.\s]+$/, "") + "...");

/** "TABLE 3: ENGINE AND PERFORMANCE DATA" -> "Table 3: Engine and performance data" */
export const tableTitle = (t: Table) => t.title.replace(/^TABLE/, "Table").replace(/: (.*)$/, (_, r: string) => ": " + r.charAt(0) + r.slice(1).toLowerCase());

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** One answer-first sentence pair built only from Table 1 fields. */
export const variantSummary = (v: Variant) =>
  `The ${v.designation} is a Humvee (HMMWV) variant: ${lowerFirst(v.description)}. ` +
  `Table 1 lists it under "${shortGroup(v.group)}", dated ${v.year}, with a ${v.engine} engine and ${v.transmission} transmission.`;

/** "Original M998 HMMWV series – sometimes referred to as M998A0" -> "Original M998 HMMWV series" */
export const shortGroup = (g: string) => g.split(/ – |, based on | - /)[0];

export const pageMeta = (o: { title: string; description: string; path: string; image?: Photo; type?: "website" | "article"; absoluteTitle?: boolean }): Metadata => ({
  title: o.absoluteTitle ? { absolute: o.title } : o.title,
  description: o.description,
  alternates: { canonical: o.path },
  openGraph: {
    title: o.title, description: o.description, url: o.path, siteName: SITE_NAME, type: o.type ?? "website",
    ...(o.image && { images: [{ url: `/${o.image.image}`, width: o.image.width, height: o.image.height, alt: captionOf(o.image).alt }] }),
  },
  twitter: { card: "summary_large_image", title: o.title, description: o.description },
});

export const imageLd = (p: Photo) => { const c = captionOf(p); return {
  "@type": "ImageObject",
  "@id": abs(`/photos/${p.id}/#image`),
  contentUrl: abs(`/${p.image}`),
  thumbnailUrl: abs(`/${p.thumb}`),
  url: abs(`/photos/${p.id}/`),
  width: p.width, height: p.height,
  ...(c.caption && { caption: c.caption }),
  ...(c.credit && { creditText: c.credit, copyrightNotice: c.credit }),
}; };

export const breadcrumbLd = (items: [name: string, path: string][]) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
});

export function JsonLd({ data }: { data: object | object[] }) {
  const graph = { "@context": "https://schema.org", "@graph": Array.isArray(data) ? data : [data] };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />;
}
