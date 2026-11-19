import type { MetadataRoute } from "next";
import { variants, photos, tables } from "@/lib/data";
import { procedures, anyPublished } from "@/lib/procedures";
import { abs } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: abs("/"), priority: 1 },
    { url: abs("/variants/"), priority: 0.9 },
    { url: abs("/tables/"), priority: 0.8 },
    { url: abs("/photos/"), priority: 0.7 },
    ...variants.map((v) => ({ url: abs(`/variants/${v.slug}/`), priority: 0.8 })),
    ...tables.map((t) => ({ url: abs(`/tables/${t.key}/`), priority: 0.7 })),
    ...(anyPublished() ? [{ url: abs("/procedures/"), priority: 0.8 }] : []),
    ...procedures.filter((p) => !p.draft).map((p) => ({ url: abs(`/procedures/${p.slug}/`), priority: 0.8 })),
    ...photos.map((p) => ({ url: abs(`/photos/${p.id}/`), priority: 0.4, images: [abs(`/${p.image}`)] })),
  ];
}
