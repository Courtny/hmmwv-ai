import Link from "next/link";
import type { Photo, Table } from "./data";

export function PhotoFigure({ p, thumb = false }: { p: Photo; thumb?: boolean }) {
  return (
    <figure>
      <Link href={`/photos/${p.id}/`}><img src={`/${thumb ? p.thumb : p.image}`} alt={p.alt} loading="lazy" width={p.width} height={p.height} /></Link>
      <figcaption>{p.caption ?? <em>No caption in the book.</em>}</figcaption>
      <div className="mono">{p.credit ? `Photo: ${p.credit} · ` : ""}page {p.page} · {p.id}</div>
    </figure>
  );
}

export function DataTable({ t }: { t: Table }) {
  return (
    <div className="tw"><table>
      <thead><tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{t.rows.map((r, i) => r.group !== undefined
        ? <tr key={i} className="grp"><td colSpan={t.columns.length}>{r.group}</td></tr>
        : <tr key={i}>{r.cells!.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
