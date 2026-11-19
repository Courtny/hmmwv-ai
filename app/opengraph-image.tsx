import { card, OG_SIZE } from "@/lib/og";
import { variants, photos, tables } from "@/lib/data";

export const alt = "hmmwv.ai: Humvee (HMMWV) variants, specs and photos";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return card({
    kicker: "Reference archive",
    title: "Humvee variants, specs and photos",
    titleSize: 116,
    subtitle: "Every factory HMMWV variant with engine, dimensions and performance data, transcribed from the book.",
    stats: [
      { label: "Variants", value: String(variants.length) },
      { label: "Photos", value: `${photos.length}, credited` },
      { label: "Spec tables", value: String(tables.length) },
    ],
  });
}
export const dynamic = "force-static";
