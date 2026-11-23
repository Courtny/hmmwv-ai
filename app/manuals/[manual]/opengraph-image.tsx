import { card, OG_SIZE } from "@/lib/og";
import { manuals, manualById } from "@/lib/manuals";

export const dynamic = "force-static";
export const alt = "Technical manual";
export const size = OG_SIZE;
export const contentType = "image/png";
export function generateStaticParams() { return manuals.map((m) => ({ manual: m.id })); }

export default async function Image({ params }: { params: Promise<{ manual: string }> }) {
  const m = manualById((await params).manual)!;
  return card({
    kicker: `Technical manual · ${m.date}`,
    title: m.number,
    subtitle: `${m.title}: ${m.subject}`,
    stats: [
      { label: "Pages", value: String(m.data.pdf.pages) },
      { label: "Figures", value: String(Object.keys(m.data.figures).length) },
      { label: "Sections", value: String(m.data.sections.length) },
    ],
  });
}
