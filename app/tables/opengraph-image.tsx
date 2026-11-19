import { card, OG_SIZE } from "@/lib/og";

export const alt = "hmmwv.ai: Humvee Tables";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return card({ kicker: "hmmwv.ai", title: "Humvee Tables", subtitle: "Spec tables transcribed from the book.", footer: "hmmwv.ai/tables/" });
}
export const dynamic = "force-static";
