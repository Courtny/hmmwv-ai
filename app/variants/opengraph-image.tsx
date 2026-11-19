import { card, OG_SIZE } from "@/lib/og";

export const alt = "hmmwv.ai: Humvee Variants";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return card({ kicker: "hmmwv.ai", title: "Humvee Variants", subtitle: "All factory Humvee variants, grouped by series.", footer: "hmmwv.ai/variants/" });
}
export const dynamic = "force-static";
