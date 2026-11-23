import { card, OG_SIZE } from "@/lib/og";
import { manuals, manualById, sectionBySlug, sectionLabel, pageRange } from "@/lib/manuals";

export const dynamic = "force-static";
export const alt = "Technical manual section";
export const size = OG_SIZE;
export const contentType = "image/png";
export function generateStaticParams() {
  return manuals.flatMap((m) => m.data.sections.map((s) => ({ manual: m.id, section: s.slug })));
}

export default async function Image({ params }: { params: Promise<{ manual: string; section: string }> }) {
  const { manual, section } = await params;
  const m = manualById(manual)!;
  const s = sectionBySlug(m, section)!;
  const title = s.kind === "appendix" ? s.title.replace(/^Appendix \w\. /, "") : s.title;
  return card({
    kicker: `${m.number} · ${sectionLabel(s)}`,
    title: title.length > 70 ? title.slice(0, title.lastIndexOf(" ", 68)) + "..." : title,
    subtitle: `${m.subject}, ${pageRange(s)}.`,
  });
}
