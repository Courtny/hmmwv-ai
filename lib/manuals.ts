import tm9281523734 from "@/data/manuals/tm-9-2815-237-34.json";
import tm9281523734p from "@/data/manuals/tm-9-2815-237-34p.json";

/**
 * Technical manuals. Content (sections, figures, tables) is generated into
 * data/manuals/<id>.json by scripts/import_manual.py; the details below are read
 * off each manual's cover and title page.
 */
export type Block =
  | { t: "page"; pdf: number; printed: string | null }
  | { t: "h"; level: 2 | 3; text: string }
  | { t: "p"; text: string }
  | { t: "step"; n: string; text: string }
  | { t: "note"; kind: string; text: string }
  | { t: "rows"; rows: string[][] }
  | { t: "fig"; id: string }
  | { t: "tbl"; id: string; key: string | null };

export type Section = {
  slug: string;
  /** para: numbered paragraph (maintenance manuals); wp: work package (parts lists). */
  kind: "front" | "para" | "appendix" | "wp" | "back";
  id: string | null;
  /** Parts lists: the functional group code printed in the contents ("0100"). */
  code?: string | null;
  chapter: string | null;
  section: string | null;
  title: string;
  pages: number[];
  printed: [string, string] | null;
  blocks: Block[];
};

export type Figure = {
  id: string; kind: string | null; page: number; printed_page: string | null; caption: string | null; alt: string | null;
  callouts: { n: string; label: string | null }[]; width: number; height: number; image: string; thumb: string; needs_review: boolean;
};

export type ManualTable = {
  key: string; title: string | null; columns: string[]; rows: { cells?: string[]; group?: string; page?: number }[];
  pages: number[]; source_ids: string[]; crops: string[]; notes?: string[];
};

type Data = {
  id: string;
  /** "parts": a repair parts list, sectioned by work package. */
  layout?: "paragraphs" | "parts";
  pdf: { file: string; bytes: number; pages: number };
  cover: { image: string; width: number; height: number };
  toc: Record<string, string>;
  sections: Section[];
  figures: Record<string, Figure>;
  tables: Record<string, ManualTable>;
};

export type Manual = {
  id: string;
  number: string;
  otherNumbers: string[];
  title: string;
  subject: string;
  /** What kind of book this is, for summaries: "maintenance manual" or "repair parts list". */
  noun: string;
  equipment: string;
  date: string;
  issuedBy: string;
  supersedes?: string;
  distribution: string;
  summary: string;
  data: Data;
};

export const manuals: Manual[] = [
  {
    id: "tm-9-2815-237-34",
    number: "TM 9-2815-237-34",
    otherNumbers: ["Air Force TO 38V1-6-2", "Marine Corps TM 2815-34/3 A"],
    title: "Direct Support and General Support Maintenance",
    subject: "6.2L and 6.5L V8 diesel engine",
    noun: "maintenance manual",
    equipment:
      "Engine, diesel: 8 cylinder, naturally aspirated, fuel-injected, water cooled, DDA model 6.2 liter (pre-1990 and post-1990) and 6.5 liter (1995 to 1998, including detuned); engine, diesel: 8 cylinder, turbocharged (1996 to 1998).",
    date: "January 1996",
    issuedBy: "Headquarters, Departments of the Army, the Air Force, and Marine Corps",
    supersedes: "TM 9-2815-237-34, 25 June 1985",
    distribution: "Approved for public release; distribution is unlimited.",
    summary:
      "Direct and general support maintenance for the Humvee's 6.2L and 6.5L V8 diesel engine: teardown into subassemblies, repair of each subassembly, fuel injection pump calibration, reassembly, run-in and repair standards.",
    data: tm9281523734 as unknown as Data,
  },
  {
    id: "tm-9-2815-237-34p",
    number: "TM 9-2815-237-34P",
    otherNumbers: ["Air Force TO 38V1-6-4", "Marine Corps TM 2815-34P/4D"],
    title: "Direct Support and General Support Maintenance Repair Parts and Special Tools List",
    subject: "6.2L and 6.5L V8 diesel engine",
    noun: "repair parts list",
    equipment:
      "Engine, diesel: 8 cylinder, naturally aspirated, fuel-injected, water cooled, DDA model 6.2 liter (1990) and 6.5 liter (1995 to 2001); the same engine naturally aspirated and detuned, 6.5 liter (1996 to 2001); and turbocharged, 6.5 liter (1996 to 2001).",
    date: "15 July 2004",
    issuedBy: "Headquarters, Departments of the Army, the Air Force, and Marine Corps",
    supersedes: "TM 9-2815-237-34P, 30 March 2001",
    distribution: "Approved for public release; distribution is unlimited.",
    summary:
      "Repair parts and special tools for the Humvee's 6.2L and 6.5L V8 diesel engine at direct and general support: an illustration plate for each assembly with its parts list (stock number, CAGE code, part number, quantity and the vehicles each part fits), the special tools, and cross-reference indexes by stock number and part number.",
    data: tm9281523734p as unknown as Data,
  },
];

export const manualById = (id: string) => manuals.find((m) => m.id === id);
export const sectionBySlug = (m: Manual, slug: string) => m.data.sections.find((s) => s.slug === slug);

export const manualPath = (m: Manual | string) => `/manuals/${typeof m === "string" ? m : m.id}/`;
export const sectionPath = (m: Manual, s: Section) => `${manualPath(m)}${s.slug}/`;
export const pdfUrl = (m: Manual, pdfPage?: number) => `/${m.data.pdf.file}${pdfPage ? `#page=${pdfPage}` : ""}`;
export const pdfName = (m: Manual) => m.data.pdf.file.split("/").pop()!;

/** "Para. 2-40", "WP 0002", "Appendix B", "Front matter" */
export const sectionLabel = (s: Section) =>
  s.kind === "para" ? `para. ${s.id}` : s.kind === "wp" ? `WP ${s.id}` : s.kind === "appendix" ? `Appendix ${s.id}` : s.kind === "back" ? "Back matter" : "Front matter";

/** Where a section sits: "Chapter 2. Maintenance instructions" or, in a parts list, "Group 01. Engine". */
export const sectionPlace = (m: Manual, s: Section) => (s.kind === "wp" ? s.chapter : s.chapter ? chapterTitle(m, s.chapter) : null);

export const pageRange = (s: Section) => (!s.printed ? "" : s.printed[0] === s.printed[1] ? `page ${s.printed[0]}` : `pages ${s.printed[0]} to ${s.printed[1]}`);

/** Credit printed beside every figure, table and cover image. */
export const credit = (m: Manual, printedPage: string | null) => `US Army technical manual ${m.number}${printedPage ? `, page ${printedPage}` : ""}`;

/** Display repairs only (the data keeps the text as captured): no em dashes in site copy. */
export const show = (s: string) => s.replace(/\s*—\s*/g, " - ");

export const chapterTitle = (m: Manual, chapter: string) => {
  const t = m.data.toc[`CHAPTER ${chapter}`];
  return t ? `Chapter ${chapter}. ${t.charAt(0) + t.slice(1).toLowerCase()}` : `Chapter ${chapter}`;
};

/** Table of contents: front matter, chapters with their sections, then appendices. */
export function contents(m: Manual) {
  const out: { heading: string; groups: { heading: string | null; sections: Section[] }[] }[] = [];
  for (const s of m.data.sections) {
    const heading =
      s.kind === "front" ? "Front matter" : s.kind === "appendix" ? "Appendices" : s.kind === "back" ? (m.data.layout === "parts" ? "Forms and back matter" : "Index and back matter")
        : s.kind === "wp" ? (s.chapter ?? "Work packages") : chapterTitle(m, s.chapter ?? "?");
    let ch = out[out.length - 1];
    if (!ch || ch.heading !== heading) out.push((ch = { heading, groups: [] }));
    let g = ch.groups[ch.groups.length - 1];
    if (!g || g.heading !== s.section) ch.groups.push((g = { heading: s.section, sections: [] }));
    g.sections.push(s);
  }
  return out;
}

export const neighbours = (m: Manual, s: Section) => {
  const i = m.data.sections.indexOf(s);
  return { prev: m.data.sections[i - 1] ?? null, next: m.data.sections[i + 1] ?? null };
};

/**
 * Parts lists: the section holding each figure's parts list, keyed as the cross-reference
 * indexes print it ("1", "36", "BULK", "KITS").
 */
export function partsListSections(m: Manual) {
  const out = new Map<string, Section>();
  for (const s of m.data.sections)
    for (const b of s.blocks) {
      if (b.t !== "tbl" || !b.key) continue;
      const k = b.key.match(/^fig-(\d+)-parts$/)?.[1] ?? { "bulk-parts": "BULK", "kits-parts": "KITS" }[b.key];
      if (k && !out.has(k)) out.set(k, s);
    }
  return out;
}

export const figuresIn = (m: Manual, s: Section) =>
  s.blocks.flatMap((b) => (b.t === "fig" && m.data.figures[b.id] ? [m.data.figures[b.id]] : []));

export const firstText = (s: Section) => s.blocks.find((b): b is { t: "p"; text: string } | { t: "step"; n: string; text: string } => b.t === "p" || b.t === "step")?.text ?? "";

export const fileSize = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

/** Lettered subsections ("a. Disassembly") in order, without repeats. */
export const subsections = (s: Section) => {
  const seen = new Set<string>();
  return s.blocks.flatMap((b) => {
    if (b.t !== "h" || b.level !== 3) return [];
    const t = b.text.replace(/\s*\(Cont.?d\)$/i, "").trim();
    const key = t.toLowerCase();
    return seen.has(key) ? [] : (seen.add(key), [t]);
  });
};

const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** First sentence of real prose: skips task headers and setup tables. */
const firstProse = (s: Section) =>
  s.blocks.find(
    (b): b is { t: "p"; text: string } =>
      b.t === "p" && b.text.length > 60 && /[a-z]\.$/.test(b.text) && !/^(This task covers|INITIAL SETUP)/i.test(b.text) && !/Item \d|Appendix [A-F],/.test(b.text),
  )?.text ?? "";

/**
 * Answer-first summary of a section: what it is, what it covers, where it is printed.
 * Used for the meta description, the lede and the article description.
 */
export function sectionSummary(m: Manual, s: Section, procedures = 0) {
  const figs = figuresIn(m, s).length;
  const name = s.kind === "appendix" ? s.title.replace(/^Appendix \w\. /, "") : s.title;
  const where =
    s.kind === "para" ? `paragraph ${s.id} of ${m.number}` : s.kind === "wp" ? `work package ${s.id} of ${m.number}` : s.kind === "appendix" ? `appendix ${s.id} of ${m.number}` : `the ${sectionLabel(s).toLowerCase()} of ${m.number}`;
  const subs = subsections(s).filter((x) => x.length < 40).slice(0, 6).map((x) => x.replace(/^\w\.\s+/, "").replace(/\.$/, "").toLowerCase());
  const extras = [figs && `${figs} figure${figs === 1 ? "" : "s"}`, procedures && `${procedures} interactive procedure${procedures === 1 ? "" : "s"}`].filter(Boolean) as string[];
  const lead =
    `${name} is ${where}, the ${m.subject} ${m.noun}. ` +
    `It ${subs.length ? `covers ${listOf(subs)} on` : "is printed on"} ${pageRange(s)}${extras.length ? `, with ${listOf(extras)}` : ""}.`;
  const prose = firstProse(s);
  return { lead, prose: prose ? show(prose) : "" };
}
