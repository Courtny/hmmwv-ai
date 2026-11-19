import { card, OG_SIZE } from "@/lib/og";
import { procedures } from "@/lib/procedures";

export const dynamic = "force-static";
export const alt = "hmmwv.ai: Humvee maintenance procedures";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return card({
    kicker: "hmmwv.ai",
    title: "Humvee procedures",
    subtitle: "Steps as printed in the Army technical manuals, with interactive parts diagrams.",
    footer: `${procedures.length} procedure${procedures.length === 1 ? "" : "s"} · hmmwv.ai/procedures/`,
  });
}
