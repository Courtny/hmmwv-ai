import { card, OG_SIZE } from "@/lib/og";

export const alt = "hmmwv.ai: Humvee Photos";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return card({ kicker: "hmmwv.ai", title: "Humvee Photos", subtitle: "Humvee photos with printed captions and credits.", footer: "hmmwv.ai/photos/" });
}
export const dynamic = "force-static";
