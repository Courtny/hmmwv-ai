import { readFileSync } from "node:fs";
import { join } from "node:path";

/** A maintenance procedure transcribed from a technical manual page. Text is kept as printed. */
export type Part = { n: number; name: string; qty?: number };
export type Callout = { n: number; x: number; y: number };
export type Procedure = {
  slug: string;
  manual: string;
  para: string;
  title: string;
  section: string;
  page: string;
  /** Draft procedures are noindex and left out of the sitemap (rights or review pending). */
  draft?: boolean;
  caution?: string;
  note?: string;
  steps: string[];
  parts: Part[];
  diagram: { file: string; viewBox: [number, number]; callouts: Callout[]; alt: string; credit: string };
};

export const procedures: Procedure[] = [
  {
    slug: "water-crossover-repair",
    manual: "TM 9-2815-237-34",
    para: "2-39",
    title: "Water crossover repair",
    section: "d. Assembly",
    page: "2-147",
    draft: true, // Confirm the TM distribution statement before indexing.
    caution: "Thermostat must be installed correctly or engine damage may result.",
    note: "For general assembly instructions, refer to para. 2-12.",
    steps: [
      "Install thermostat (9), gasket (8), and water outlet (7) on water crossover (11) with two washers (4), capscrew (6), and stud (5). Tighten capscrew (6) and stud (5) to 25 lb-ft (34 N•m).",
      "Coat threads on heater hose nipple (12), bypass hose nipple (10), and de-airation nipple (2) with pipe sealing compound and install in water crossover (11).",
      "Coat threads on glow plug controller (1) and temperature switch (3) with pipe sealing compound and install in water crossover (11).",
    ],
    // Names as the steps print them. Callout numbers are the diagram's.
    parts: [
      { n: 1, name: "Glow plug controller" },
      { n: 2, name: "De-airation nipple" },
      { n: 3, name: "Temperature switch" },
      { n: 4, name: "Washer", qty: 2 },
      { n: 5, name: "Stud" },
      { n: 6, name: "Capscrew" },
      { n: 7, name: "Water outlet" },
      { n: 8, name: "Gasket" },
      { n: 9, name: "Thermostat" },
      { n: 10, name: "Bypass hose nipple" },
      { n: 11, name: "Water crossover" },
      { n: 12, name: "Heater hose nipple" },
    ],
    diagram: {
      file: "tm-9-2815-237-34-p2-147-water-crossover.svg",
      viewBox: [1125, 730],
      // Callout circle centres in viewBox units, read off a gridded render of the SVG.
      callouts: [
        { n: 1, x: 245, y: 111 }, { n: 2, x: 432, y: 147 }, { n: 3, x: 617, y: 163 },
        { n: 4, x: 968, y: 386 }, { n: 4, x: 874, y: 634 }, { n: 5, x: 1038, y: 413 },
        { n: 6, x: 964, y: 667 }, { n: 7, x: 786, y: 603 }, { n: 8, x: 696, y: 568 },
        { n: 9, x: 594, y: 531 }, { n: 10, x: 424, y: 494 }, { n: 11, x: 315, y: 416 },
        { n: 12, x: 70, y: 376 },
      ],
      alt: "Exploded view of the water crossover assembly with callouts 1 to 12: glow plug controller, de-airation nipple and temperature switch on top; heater hose nipple and bypass hose nipple on the crossover; thermostat, gasket and water outlet fastened with washers, stud and capscrew.",
      credit: "US Army technical manual TM 9-2815-237-34, page 2-147",
    },
  },
];

/** The index is indexable once at least one procedure is published. */
export const anyPublished = () => procedures.some((p) => !p.draft);

export const procedureBySlug = (slug: string) => procedures.find((p) => p.slug === slug);

/** Public URL of the recoloured diagram (served by app/diagrams/[file]/route.ts). */
export const diagramUrl = (p: Procedure) => `/diagrams/${p.diagram.file}`;

/**
 * A traced two-tone diagram recoloured to the site palette: dark fills become ink, white fills
 * become the card colour. Coordinates are rounded to 0.1 to trim size. The source in
 * assets/diagrams stays untouched.
 */
export function diagramSvg(file: string, colors = { ink: "#1C201B", bg: "#FBF9F4" }) {
  const svg = readFileSync(join(process.cwd(), "assets/diagrams", file), "utf8");
  const inner = svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>"));
  const vb = svg.match(/viewBox="([^"]+)"/)![1];
  const body = inner
    .replace(/<g id="[^"]*">|<\/g>/g, "")
    .replace(/ opacity="1\.00"/g, "")
    .replace(/fill="#(?!ffffff)[0-9a-f]{6}"/gi, `fill="${colors.ink}"`)
    .replace(/fill="#ffffff"/gi, `fill="${colors.bg}"`)
    .replace(/(\d+\.\d)\d+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
}
