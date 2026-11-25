import Link from "next/link";
import type { Block, Manual, Section } from "./manuals";
import { credit, pdfUrl, show, partsListSections, sectionPath } from "./manuals";
import { proceduresForFigure, procedurePath } from "./procedures";
import { plateFor } from "./plates";
import { PartsPlate } from "./PartsPlate";

/** One manual section, block by block, as captured from the page text. */
export function ManualBlocks({ m, s }: { m: Manual; s: Section }) {
  // Group consecutive steps into one ordered list.
  const out: (Block | { t: "steps"; items: { n: string; text: string }[] })[] = [];
  for (const b of s.blocks) {
    const last = out[out.length - 1];
    if (b.t === "step" && last?.t === "steps") last.items.push(b);
    else if (b.t === "step") out.push({ t: "steps", items: [b] });
    else out.push(b);
  }
  let printed: string | null = null;
  // Parts manuals: traced plates get a column of their own, beside the parts list on wide screens.
  const plated = m.data.layout === "parts" && out.some((b) => b.t === "fig" && plateFor(b.id));
  const body = (
    <div className="tm-body">
      {out.map((b, i) => {
        switch (b.t) {
          case "page":
            printed = b.printed;
            return (
              <div key={i} className="tm-page mono" id={`p${b.pdf}`}>
                <span>Page {b.printed ?? "unnumbered"}</span>
                <a href={pdfUrl(m, b.pdf)}>PDF page {b.pdf}</a>
              </div>
            );
          case "h":
            return b.level === 2 ? <h2 key={i}>{show(b.text)}</h2> : <h3 key={i}>{show(b.text)}</h3>;
          case "p":
            return <p key={i}>{show(b.text)}</p>;
          case "steps":
            return (
              <ol key={i} className="tm-steps">
                {b.items.map((x, j) => (
                  <li key={j}><span className="n mono">{x.n}.</span> {show(x.text)}</li>
                ))}
              </ol>
            );
          case "note":
            return (
              <aside key={i} className={`callout ${/WARN|CAUTION/.test(b.kind) ? "caution" : ""}`}>
                <strong>{b.kind}</strong>
                <p>{show(b.text)}</p>
              </aside>
            );
          case "rows":
            return (
              <div key={i} className="tw tm-rows">
                <table>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>{r.map((c, k) => <td key={k}>{show(c)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "fig":
            return plated && plateFor(b.id) ? null : <FigureBlock key={i} m={m} id={b.id} />;
          case "tbl":
            return <TableBlock key={i} m={m} k={b.key} id={b.id} printed={printed} />;
        }
      })}
    </div>
  );
  if (!plated) return body;
  return (
    <div className="tm-plated">
      <div className="tm-plates">
        {out.map((b, i) => (b.t === "fig" && plateFor(b.id) ? <PlateBlock key={i} m={m} id={b.id} /> : null))}
      </div>
      {body}
    </div>
  );
}

function PlateBlock({ m, id }: { m: Manual; id: string }) {
  const f = m.data.figures[id], plate = plateFor(id)!;
  return (
    <PartsPlate plate={plate} src={`/diagrams/${plate.file}`} title={f?.caption ?? id}
      subtitle={`${m.number} · page ${f?.printed_page ?? plate.page}`}>
      <span className="mono">{id} · traced from {credit(m, f?.printed_page ?? null)} · <a href={`/${f?.image}`}>Original scan</a></span>
      {f?.alt && <span>{show(f.alt)}</span>}
    </PartsPlate>
  );
}

function FigureBlock({ m, id }: { m: Manual; id: string }) {
  const f = m.data.figures[id];
  if (!f) return null;
  const procs = proceduresForFigure(id);
  return (
    <figure className="tm-fig" id={id}>
      <a href={`/${f.image}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/${f.image}`} alt={f.alt ?? `Figure ${id}`} width={f.width} height={f.height} loading="lazy" />
      </a>
      <figcaption>
        <span className="mono">{id}{f.kind ? ` · ${f.kind}` : ""} · {credit(m, f.printed_page)}</span>
        {f.alt && <span>{show(f.alt)}</span>}
        {procs.map((p) => (
          <Link key={p.slug} href={procedurePath(p)} className="tm-open">Open the interactive diagram: {p.title.toLowerCase()}, {p.section.replace(/^\w\. /, "").toLowerCase()}</Link>
        ))}
        {f.callouts.length > 0 && (
          <ul className="tm-key">
            {f.callouts.map((c, j) => (
              <li key={j}><span className="num">{c.n}</span>{c.label ? show(c.label) : "Not named in the text"}</li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}

function TableBlock({ m, k, id, printed }: { m: Manual; k: string | null; id: string; printed: string | null }) {
  const t = k ? m.data.tables[k] : undefined;
  if (!t) return null;
  // A table continued over several pages is listed once, at its first page.
  if (t.source_ids[0] !== id) return null;
  const width = Math.max(t.columns.length, ...t.rows.map((r) => r.cells?.length ?? 0));
  // Cross-reference indexes: the figure number links to that figure's parts list.
  const figCol = m.data.layout === "parts" ? t.columns.findIndex((c) => /^figure no$/i.test(c)) : -1;
  const lists = figCol >= 0 ? partsListSections(m) : null;
  // Parts lists: each row carries its item number, so the plate can find it.
  const items = m.data.layout === "parts" && /^item no$/i.test(t.columns[0] ?? "");
  const cell = (c: string, l: number) => {
    const s = l === figCol ? lists?.get(c) : undefined;
    return s ? <Link href={sectionPath(m, s)}>{show(c)}</Link> : show(c);
  };
  return (
    <figure className="tm-tbl" id={id}>
      {t.title && <strong className="tm-tbl-title">{show(t.title)}</strong>}
      <div className="tw">
        <table>
          {t.columns.some(Boolean) && (
            <thead><tr>{t.columns.map((c, j) => <th key={j} scope="col">{show(c)}</th>)}</tr></thead>
          )}
          <tbody>
            {t.rows.map((r, j) =>
              r.group ? (
                <tr key={j} className="grp"><td colSpan={width}>{show(r.group)}</td></tr>
              ) : (
                <tr key={j} data-item={items && r.cells?.[0] ? r.cells[0] : undefined}>{(r.cells ?? []).map((c, l) => <td key={l}>{cell(c, l)}</td>)}</tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <figcaption className="mono">
        Transcribed from {credit(m, printed)}. Values as printed.
        {t.crops.map((c, j) => <span key={c}> <a href={`/${c}`}>Scan{t.crops.length > 1 ? ` ${j + 1}` : ""}</a></span>)}
      </figcaption>
    </figure>
  );
}
