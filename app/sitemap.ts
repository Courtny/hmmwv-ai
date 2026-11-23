import type { MetadataRoute } from "next";
import { variants, photos, tables } from "@/lib/data";
import { procedures, procedurePath } from "@/lib/procedures";
import { manuals, manualPath, sectionPath } from "@/lib/manuals";
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
    { url: abs("/manuals/"), priority: 0.8 },
    ...manuals.map((m) => ({ url: abs(manualPath(m)), priority: 0.8, images: [abs(`/${m.data.cover.image}`)] })),
    ...manuals.flatMap((m) => m.data.sections.map((s) => ({ url: abs(sectionPath(m, s)), priority: 0.6 }))),
    ...procedures.filter((p) => !p.draft).map((p) => ({ url: abs(procedurePath(p)), priority: 0.8 })),
    ...photos.map((p) => ({ url: abs(`/photos/${p.id}/`), priority: 0.4, images: [abs(`/${p.image}`)] })),
  ];
}
