import { manuals, manualPath, sectionPath, sectionLabel, pageRange, pdfUrl, credit, show } from "@/lib/manuals";
import type { Manual, Section } from "@/lib/manuals";
import { proceduresFor, procedurePath } from "@/lib/procedures";
import { abs } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * llms-full.txt: the technical manuals as plain text for answer engines, one section per
 * block with its URL, so answers can cite the page. Text is kept as printed.
 */
export function GET() {
  const out: string[] = [
    "# hmmwv.ai technical manuals (full text)",
    "",
    "> Army technical manuals for the Humvee (HMMWV), transcribed section by section. Text, torque values and part numbers are kept exactly as printed, typos included. Each section links to its page on hmmwv.ai and the original PDF.",
    "",
  ];
  for (const m of manuals) out.push(...manualText(m));
  return new Response(out.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function manualText(m: Manual): string[] {
  const out = [
    `## ${m.number}: ${m.title}, ${m.subject}`,
    "",
    `${m.summary}`,
    `Also numbered ${m.otherNumbers.join("; ")}. Issued by ${m.issuedBy}, ${m.date}. ${m.distribution}`,
    `Contents: ${abs(manualPath(m))}`,
    `Original PDF (${m.data.pdf.pages} pages): ${abs(pdfUrl(m))}`,
    "",
  ];
  // The steps themselves are in the section text below; list where each has its interactive diagram.
  const procs = proceduresFor(m.id).filter((p) => !p.draft);
  if (procs.length) {
    out.push("### Interactive procedures", "");
    for (const p of procs) out.push(`- ${p.title}, ${p.section} (para. ${p.para}, page ${p.page}): ${abs(procedurePath(p))}`);
    out.push("");
  }
  for (const s of m.data.sections) out.push(...sectionText(m, s));
  return out;
}

function sectionText(m: Manual, s: Section): string[] {
  const out = [
    `### ${s.kind === "para" ? `${s.id}. ` : s.kind === "wp" ? `WP ${s.id}. ` : ""}${s.title} (${m.number}, ${sectionLabel(s)}, ${pageRange(s)})`,
    "",
    `URL: ${abs(sectionPath(m, s))}`,
    ...(s.section ? [`Section: ${s.section}`] : []),
    "",
  ];
  for (const b of s.blocks) {
    switch (b.t) {
      case "page": out.push(`[Page ${b.printed ?? "unnumbered"}, PDF page ${b.pdf}]`); break;
      case "h": out.push("", show(b.text)); break;
      case "p": out.push(show(b.text)); break;
      case "step": out.push(`${b.n}. ${show(b.text)}`); break;
      case "note": out.push(`${b.kind}: ${show(b.text)}`); break;
      case "rows": b.rows.forEach((r) => out.push(r.map(show).join(" | "))); break;
      case "fig": {
        const f = m.data.figures[b.id];
        if (!f) break;
        const key = f.callouts.map((c) => `(${c.n}) ${c.label ?? "unnamed"}`).join("; ");
        out.push(`[Figure ${f.id}${f.kind ? `, ${f.kind}` : ""}: ${f.alt ?? ""}${key ? ` Callouts: ${key}.` : ""} Image: ${abs(`/${f.image}`)} (${credit(m, f.printed_page)})]`);
        break;
      }
      case "tbl": {
        const t = b.key ? m.data.tables[b.key] : undefined;
        if (!t || t.source_ids[0] !== b.id) break;
        out.push("", `Table: ${show(t.title ?? b.id)}`);
        if (t.columns.some(Boolean)) out.push(t.columns.map(show).join(" | "));
        for (const r of t.rows) out.push(r.group ? `-- ${show(r.group)} --` : (r.cells ?? []).map(show).join(" | "));
        out.push("");
        break;
      }
    }
  }
  out.push("");
  return out;
}
