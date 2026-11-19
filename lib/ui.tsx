import Link from "next/link";
import { captionOf } from "./data";
import type { Photo, Table } from "./data";

export function PhotoFigure({ p, thumb = false }: { p: Photo; thumb?: boolean }) {
  const c = captionOf(p);
  return (
    <figure>
      <Link href={`/photos/${p.id}/`}><img src={`/${thumb ? p.thumb : p.image}`} alt={c.alt} loading="lazy" width={p.width} height={p.height} /></Link>
      <figcaption>{c.caption ?? <em>No caption in the book.</em>}{c.from && <em> (Caption printed with the other half of this spread.)</em>}</figcaption>
      <div className="mono">{c.credit ? `Photo: ${c.credit} · ` : ""}page {p.page} · {p.id}</div>
    </figure>
  );
}

export function DataTable({ t }: { t: Table }) {
  return (
    <div className="tw"><table>
      <thead><tr>{t.columns.map((c, i) => <th key={c || i} scope="col">{c}</th>)}</tr></thead>
      <tbody>{t.rows.map((r, i) => r.group !== undefined
        ? <tr key={i} className="grp"><td colSpan={t.columns.length}>{r.group}</td></tr>
        : <tr key={i}>{r.cells!.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
