import { variants, tables, groups, photos, seriesFor } from "@/lib/data";
import { abs, tableTitle } from "@/lib/seo";
import { manuals, manualPath, sectionPath, pdfUrl } from "@/lib/manuals";
import { proceduresFor, procedurePath } from "@/lib/procedures";

export const dynamic = "force-static";

/** llms.txt (llmstxt.org): a plain map of the site for answer engines and AI crawlers. */
export function GET() {
  const lines = [
    "# hmmwv.ai",
    "",
    "> Reference for the Humvee (HMMWV, High Mobility Multipurpose Wheeled Vehicle): every factory variant with engine, transmission, dimensions and performance, plus credited photos and spec tables transcribed from a published book. Table values are kept exactly as printed.",
    "",
    `The site covers ${variants.length} variants, ${photos.length} photos and ${tables.length} tables. Each variant page joins Table 1 (variants), Table 3 (engine), Table 8 (dimensions) and Table 9 (performance) by series. Photo credits belong to the rights holders named on each photo page.`,
    "",
    "## Variants",
    "",
    ...groups.flatMap((g) => [
      `### ${g}`,
      "",
      ...variants.filter((v) => v.group === g).map((v) => `- [${v.designation}](${abs(`/variants/${v.slug}/`)}): ${v.description}. ${v.year}, ${v.engine}, ${v.transmission}.${seriesFor(v) ? "" : " No series data in Tables 3 or 9."}`),
      "",
    ]),
    "## Tables",
    "",
    ...tables.map((t) => `- [${tableTitle(t)}](${abs(`/tables/${t.key}/`)})${t.intro ? `: ${t.intro}` : ""}`),
    "",
    "## Technical manuals",
    "",
    ...manuals.flatMap((m) => [
      `### ${m.number}: ${m.title}, ${m.subject} (${m.date})`,
      "",
      `${m.summary} Text is transcribed as printed. [Original PDF](${abs(pdfUrl(m))}).`,
      "",
      `- [${m.number} contents](${abs(manualPath(m))})`,
      ...proceduresFor(m.id).map((p) => `- [Procedure: ${p.title}, ${p.section} (para. ${p.para})](${abs(procedurePath(p))}): ${p.steps.length} steps with an interactive parts diagram; parts ${p.parts.map((x) => `(${x.n}) ${x.name}`).join(", ")}`),
      ...m.data.sections.map((s) => `- [${s.kind === "para" ? `${s.id} ${s.title}` : s.title}](${abs(sectionPath(m, s))})`),
      "",
    ]),
    "## Optional",
    "",
    `- [Full text of the technical manuals](${abs("/llms-full.txt")}): every section as plain text, with figure callout keys and tables`,
    `- [All photos](${abs("/photos/")}): ${photos.length} images with printed captions and credits`,
    `- [Sitemap](${abs("/sitemap.xml")})`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
