import { icon } from "@/lib/og";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
/** Square corners: iOS applies its own mask. */
export default function AppleIcon() { return icon(180, false); }
export const dynamic = "force-static";
