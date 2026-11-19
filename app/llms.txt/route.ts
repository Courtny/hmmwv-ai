import { variants, tables, groups, photos, seriesFor } from "@/lib/data";
import { abs, tableTitle } from "@/lib/seo";

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
    "## Optional",
    "",
    `- [All photos](${abs("/photos/")}): ${photos.length} images with printed captions and credits`,
    `- [Sitemap](${abs("/sitemap.xml")})`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
