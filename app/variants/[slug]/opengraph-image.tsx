import { card, OG_SIZE } from "@/lib/og";
import { variants, dimensionsFor } from "@/lib/data";
import { shortGroup } from "@/lib/seo";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Humvee variant spec card";
export function generateStaticParams() { return variants.map((v) => ({ slug: v.slug })); }

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = variants.find((x) => x.slug === slug)!;
  const kerb = dimensionsFor(v.designation)?.cells[6];
  return card({
    kicker: `${shortGroup(v.group)} · ${v.year}`,
    title: v.designation,
    subtitle: v.description,
    stats: [
      { label: "Engine", value: v.engine },
      { label: "Transmission", value: v.transmission },
      ...(kerb && kerb !== "n/a" ? [{ label: "Kerb weight", value: kerb }] : []),
    ],
  });
}
export const dynamic = "force-static";
