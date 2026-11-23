import { card, OG_SIZE } from "@/lib/og";
import { manuals } from "@/lib/manuals";

export const dynamic = "force-static";
export const alt = "hmmwv.ai: Humvee technical manuals";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return card({
    kicker: "hmmwv.ai",
    title: "Technical manuals",
    subtitle: "Army TMs for the Humvee, section by section, with traced parts diagrams and the original PDFs.",
    footer: `${manuals.length} manual${manuals.length === 1 ? "" : "s"} · hmmwv.ai/manuals/`,
  });
}
