import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Brand tokens, mirrored from app/globals.css. */
export const C = { ink: "#1C201B", muted: "#4F5648", paper: "#F3F0E8", card: "#FBF9F4", line: "#D6D1C2", olive: "#4A5A2A", rust: "#A8441A" };

export const OG_SIZE = { width: 1200, height: 630 };

const font = (f: string) => readFileSync(join(process.cwd(), "assets/fonts", f));
type Font = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" };
let fonts: Font[] | undefined;
export const ogFonts = (): Font[] => (fonts ??= [
  { name: "Barlow", data: font("barlow-condensed-latin-700-normal.woff"), weight: 700, style: "normal" },
  { name: "Plex", data: font("ibm-plex-sans-latin-400-normal.woff"), weight: 400, style: "normal" },
  { name: "Plex", data: font("ibm-plex-sans-latin-600-normal.woff"), weight: 600, style: "normal" },
  { name: "Mono", data: font("ibm-plex-mono-latin-500-normal.woff"), weight: 500, style: "normal" },
]);

/** The hmmwv.ai mark: an olive plate with a condensed H and a rust rule. */
export function Mark({ size, round = true }: { size: number; round?: boolean }) {
  return (
    <div style={{ width: size, height: size, background: C.olive, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: round ? size * 0.12 : 0 }}>
      <div style={{ fontFamily: "Barlow", fontWeight: 700, fontSize: size * 0.78, color: C.paper, lineHeight: 1, marginTop: -size * 0.04 }}>H</div>
      <div style={{ width: size * 0.56, height: Math.max(2, size * 0.08), background: C.rust, marginTop: -size * 0.04 }} />
    </div>
  );
}

export type Stat = { label: string; value: string };

/** Fit a headline to the card: shorter strings get bigger type. */
const headSize = (s: string) => (s.length <= 8 ? 210 : s.length <= 14 ? 150 : s.length <= 28 ? 96 : 72);

export function card({ kicker, title, subtitle, stats = [], footer = "", titleSize }: { kicker: string; title: string; subtitle?: string; stats?: Stat[]; footer?: string; titleSize?: number }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.paper, fontFamily: "Plex", color: C.ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, background: C.ink, padding: "22px 56px" }}>
          <Mark size={44} />
          <div style={{ fontFamily: "Barlow", fontWeight: 700, fontSize: 34, letterSpacing: 2, color: C.paper, textTransform: "uppercase" }}>hmmwv.ai</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: "Mono", fontSize: 20, color: "#D9D5C8", letterSpacing: 3, textTransform: "uppercase" }}>Humvee reference</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "40px 56px 0", gap: 12 }}>
          <div style={{ fontFamily: "Mono", fontSize: 22, color: C.rust, letterSpacing: 3, textTransform: "uppercase" }}>{kicker}</div>
          <div style={{ fontFamily: "Barlow", fontWeight: 700, fontSize: titleSize ?? headSize(title), lineHeight: 0.92, textTransform: "uppercase" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 30, color: C.muted, lineHeight: 1.3, maxWidth: 1040, display: "flex" }}>{subtitle}</div>}
        </div>
        {stats.length > 0 ? (
          <div style={{ display: "flex", gap: 16, padding: "0 56px 28px" }}>
            {stats.map((s) => (
              <div key={s.label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, background: C.card, border: `2px solid ${C.line}`, padding: "14px 20px" }}>
                <div style={{ fontFamily: "Mono", fontSize: 16, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 600 }}>{s.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", padding: "0 56px 28px", fontFamily: "Mono", fontSize: 20, color: C.muted }}>{footer}</div>
        )}
        <div style={{ display: "flex", height: 14, background: C.olive }}>
          <div style={{ width: 220, background: C.rust }} />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}

export const icon = (size: number, round = true) => new ImageResponse(<Mark size={size} round={round} />, { width: size, height: size, fonts: ogFonts() });
