import { readFileSync } from "node:fs";
import { join } from "node:path";
import tm9281523734 from "@/data/manuals/tm-9-2815-237-34-procedures.json";

/**
 * Maintenance procedures from the technical manuals: numbered steps beside traced parts
 * diagrams. Text is kept as printed. Most are generated per subsection by
 * scripts/build_procedures.py into data/manuals/<tm>-procedures.json; a few are written by
 * hand below.
 */
export type N = number | string;
export type Part = { n: N; name: string; qty?: number };
export type Callout = { n: N; x: number; y: number };
export type Note = { kind: string; text: string };
export type Diagram = {
  /** Figure id in the manual capture that the diagram was traced from. */
  figure: string;
  file: string;
  viewBox: [number, number];
  /** Callout ring radius in viewBox units (default 21). */
  ring?: number;
  callouts: Callout[];
  /** The figure's callout key. */
  parts: Part[];
  alt: string;
  credit: string;
  page?: string | null;
};
/** A step as printed, the diagram (index into diagrams) its part numbers refer to, and notes printed before it. */
export type Step = { n: string; text: string; d: number; notes?: Note[] };
export type Procedure = {
  slug: string;
  manual: string;
  /** Manual id in lib/manuals.ts; the procedure lives under /manuals/<manualId>/procedures/. */
  manualId: string;
  /** Tools and materials the steps call for (HowTo structured data). */
  tools?: string[];
  para: string;
  title: string;
  section: string;
  page: string;
  /** Draft procedures are noindex and left out of the sitemap (review pending). */
  draft?: boolean;
  caution?: string;
  note?: string;
  steps: Step[];
  diagrams: Diagram[];
  /** Every part named in the keys, once (HowTo supplies, llms.txt). */
  parts: Part[];
};

/** Hand-written procedures: one page, one diagram. */
type HandProcedure = Omit<Procedure, "steps" | "diagrams" | "parts"> & {
  figure: string;
  steps: string[];
  parts: Part[];
  diagram: Omit<Diagram, "figure" | "parts">;
};

const handWritten: HandProcedure[] = [
  {
    slug: "water-crossover-repair",
    manual: "TM 9-2815-237-34",
    manualId: "tm-9-2815-237-34",
    figure: "p193-img01",
    tools: ["Pipe sealing compound"],
    para: "2-39",
    title: "Water crossover repair",
    section: "d. Assembly",
    page: "2-147",
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
  {
    slug: "fan-drive-repair-disassembly",
    manual: "TM 9-2815-237-34",
    manualId: "tm-9-2815-237-34",
    figure: "p195-img01",
    para: "2-40",
    title: "Fan drive repair",
    section: "a. Disassembly",
    page: "2-148",
    steps: [
      "Remove six screws (8) and three retaining plates (9) from housing (5).",
      "Remove friction lining (10) from housing (5). Discard friction lining (10).",
      "Remove locknut (1) and tabwasher (2) securing shaft assembly (11) and cylinder assembly (3) to housing (5). Discard locknut (1).",
      "Remove cylinder assembly (3) from front of housing (5).",
      "Remove O-ring (4) from inside cylinder assembly (3). Discard O-ring (4).",
      "Remove shaft assembly (11) and spring (6) from housing (5). Discard spring (6).",
      "Remove two O-rings (7) from shaft assembly (11). Discard O-rings (7).",
    ],
    // Names from the capture's callout key. Callout numbers are the diagram's.
    parts: [
      { n: 1, name: "Locknut" },
      { n: 2, name: "Tabwasher" },
      { n: 3, name: "Cylinder assembly" },
      { n: 4, name: "O-ring" },
      { n: 5, name: "Housing" },
      { n: 6, name: "Spring" },
      { n: 7, name: "O-rings" },
      { n: 8, name: "Screws" },
      { n: 9, name: "Retaining plates" },
      { n: 10, name: "Friction lining" },
      { n: 11, name: "Shaft assembly" },
    ],
    diagram: {
      file: "tm-9-2815-237-34-p195-img01-fan-drive-repair.svg",
      viewBox: [768, 706],
      ring: 18,
      // Callout ring centres in viewBox units, found by scripts/tm_diagrams.py.
      callouts: [
        { n: 1, x: 31, y: 66 }, { n: 2, x: 92, y: 52 }, { n: 3, x: 162, y: 62 },
        { n: 4, x: 232, y: 47 }, { n: 5, x: 438, y: 34 }, { n: 6, x: 548, y: 60 },
        { n: 7, x: 633, y: 52 }, { n: 8, x: 657, y: 494 }, { n: 9, x: 522, y: 654 },
        { n: 10, x: 358, y: 649 }, { n: 11, x: 229, y: 648 },
      ],
      alt: "Exploded view of the fan drive showing locknut, cylinder assembly, housing, spring, shaft assembly, friction lining and retaining plates.",
      credit: "US Army technical manual TM 9-2815-237-34, page 2-149",
    },
  },
  {
    slug: "fan-drive-repair-assembly",
    manual: "TM 9-2815-237-34",
    manualId: "tm-9-2815-237-34",
    figure: "p198-img01",
    tools: ["Lithium grease"],
    para: "2-40",
    title: "Fan drive repair",
    section: "d. Assembly",
    page: "2-152",
    note: "For general assembly instructions, refer to para. 2-12.",
    steps: [
      "Install O-ring (4) in groove inside cylinder assembly (3).",
      "Install cylinder assembly (3) on housing (5).",
      "Install large O-ring (9) and small O-ring (8) on shaft assembly (13).",
      "Lubricate roller bearing (6) with lithium grease.",
      "Install shaft assembly (13) and spring (7) in housing (5).",
      "Install shaft assembly (13) on cylinder assembly (3) with tabwasher (2) and locknut (1). Tighten locknut (1) to 96 lb-in. (11 N•m).",
      "Install friction lining (12) in housing (5).",
      "Install three retaining plates (11) on housing (5) with six screws (10). Tighten screws (10) to 22 lb-in. (3 N•m).",
    ],
    // Names from the capture's callout key. Callout numbers are the diagram's.
    parts: [
      { n: 1, name: "Locknut" },
      { n: 2, name: "Tabwasher" },
      { n: 3, name: "Cylinder assembly" },
      { n: 4, name: "O-ring" },
      { n: 5, name: "Housing" },
      { n: 6, name: "Roller bearing" },
      { n: 7, name: "Spring" },
      { n: 8, name: "Small O-ring" },
      { n: 9, name: "Large O-ring" },
      { n: 10, name: "Screws" },
      { n: 11, name: "Retaining plates" },
      { n: 12, name: "Friction lining" },
      { n: 13, name: "Shaft assembly" },
    ],
    diagram: {
      file: "tm-9-2815-237-34-p198-img01-fan-drive-repair.svg",
      viewBox: [844, 718],
      ring: 18,
      // Callout ring centres in viewBox units, found by scripts/tm_diagrams.py.
      callouts: [
        { n: 1, x: 56, y: 237 }, { n: 2, x: 109, y: 236 }, { n: 3, x: 177, y: 232 },
        { n: 4, x: 236, y: 230 }, { n: 5, x: 310, y: 228 }, { n: 6, x: 618, y: 66 },
        { n: 7, x: 478, y: 246 }, { n: 8, x: 532, y: 244 }, { n: 9, x: 640, y: 314 },
        { n: 10, x: 585, y: 616 }, { n: 11, x: 414, y: 525 }, { n: 12, x: 356, y: 528 },
        { n: 13, x: 186, y: 515 },
      ],
      alt: "Exploded view of the fan drive assembly with a circled inset of the roller bearing in the housing.",
      credit: "US Army technical manual TM 9-2815-237-34, page 2-152",
    },
  },
];

const fromHand = (p: HandProcedure): Procedure => {
  const { figure, diagram, steps, ...rest } = p;
  return {
    ...rest,
    steps: steps.map((text, i) => ({ n: String(i + 1), text, d: 0 })),
    diagrams: [{ ...diagram, figure, parts: p.parts }],
  };
};

type Generated = { manual: string; procedures: (Omit<Procedure, "manual" | "manualId" | "parts"> & { coverage: number })[] };
const fromGenerated = (g: Generated, manual: string): Procedure[] =>
  g.procedures.map(({ coverage: _coverage, ...p }) => {
    const seen = new Set<string>();
    const parts = p.diagrams.flatMap((d) => d.parts).filter((x) => !seen.has(x.name.toLowerCase()) && seen.add(x.name.toLowerCase()));
    return { ...p, manual, manualId: g.manual, parts, draft: p.draft || undefined };
  });

export const procedures: Procedure[] = [
  ...handWritten.map(fromHand),
  ...fromGenerated(tm9281523734 as unknown as Generated, "TM 9-2815-237-34"),
];

export const procedureBySlug = (slug: string) => procedures.find((p) => p.slug === slug);

export const procedurePath = (p: Procedure) => `/manuals/${p.manualId}/procedures/${p.slug}/`;
const byPara = (a: Procedure, b: Procedure) =>
  a.para.localeCompare(b.para, undefined, { numeric: true }) || a.section.localeCompare(b.section);
export const proceduresFor = (manualId: string) => procedures.filter((p) => p.manualId === manualId).sort(byPara);
/** Procedures with a diagram traced from this figure. */
export const proceduresForFigure = (figure: string) => procedures.filter((p) => p.diagrams.some((d) => d.figure === figure));

/** Public URL of a recoloured diagram (served by app/diagrams/[file]/route.ts). */
export const diagramUrl = (d: Diagram) => `/diagrams/${d.file}`;
/** Every diagram file the procedures use, once. */
export const diagramFiles = () => [...new Set(procedures.flatMap((p) => p.diagrams.map((d) => d.file)))];

/** Part numbers a step names, as written: "(7)", "(5.1)", "(A)". */
export const STEP_REF = /\((\d{1,2}(?:\.\d)?|[A-Z])\)/g;
/** Steps as plain text, numbered as printed (HowTo, llms-full.txt). */
export const stepLines = (p: Procedure) => p.steps.map((s) => `${s.n}. ${s.text}`);

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
