import { ImageResponse } from "next/og";
import { C, OG_SIZE, ogFonts, Mark } from "@/lib/og";
import { procedures, procedureBySlug, diagramSvg } from "@/lib/procedures";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Maintenance procedure with parts diagram";
export function generateStaticParams() { return procedures.map((p) => ({ manual: p.manualId, slug: p.slug })); }

export default async function Image({ params }: { params: Promise<{ manual: string; slug: string }> }) {
  const { slug } = await params;
  const p = procedureBySlug(slug)!;
  const svg = `data:image/svg+xml;base64,${Buffer.from(diagramSvg(p.diagrams[0].file, { ink: C.ink, bg: C.card })).toString("base64")}`;
  const [w, h] = p.diagrams[0].viewBox;
  // Fit inside the 1088 x 500 area under the title.
  const imgH = Math.min(500, Math.round((1088 * h) / w)), imgW = Math.round((imgH * w) / h);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.paper, fontFamily: "Plex", color: C.ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, background: C.ink, padding: "18px 56px" }}>
          <Mark size={40} />
          <div style={{ fontFamily: "Barlow", fontWeight: 700, fontSize: 30, letterSpacing: 2, color: C.paper, textTransform: "uppercase" }}>hmmwv.ai</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: "Mono", fontSize: 18, color: "#D9D5C8", letterSpacing: 3, textTransform: "uppercase" }}>{`${p.manual} · para. ${p.para}`}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, padding: "20px 56px 0" }}>
          <div style={{ fontFamily: "Barlow", fontWeight: 700, fontSize: 64, textTransform: "uppercase", lineHeight: 1 }}>{p.title}</div>
          <div style={{ fontFamily: "Mono", fontSize: 22, color: C.rust, letterSpacing: 2, textTransform: "uppercase" }}>{p.section}</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svg} width={imgW} height={imgH} alt="" />
        </div>
        <div style={{ display: "flex", height: 14, background: C.olive }}><div style={{ width: 220, background: C.rust }} /></div>
      </div>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}
