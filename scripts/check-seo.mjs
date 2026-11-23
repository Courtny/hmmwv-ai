// Audits the static build in /out: metadata, share images, structured data, sitemap, llms.txt.
// Run after `npm run build`:  npm run check
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = "out";
const SITE = "https://hmmwv.ai";
const errors = [], warns = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warns.push(`${page}: ${msg}`);

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk(OUT).filter((f) => f.endsWith("index.html") && !f.includes("_next"));

const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const meta = (html, attr, key) => { const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)); return m && unescape(m[1]); };
/** Local file for a site URL, ignoring the ?hash Next appends. */
const fileFor = (url) => {
  if (!url.startsWith(SITE)) return null;
  const p = decodeURIComponent(new URL(url).pathname);
  return p.endsWith("/") ? join(OUT, p, "index.html") : join(OUT, p);
};
const pngSize = (f) => { const b = readFileSync(f); return b.toString("ascii", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };

const titles = new Map(), descs = new Map();

for (const f of pages) {
  const html = readFileSync(f, "utf8");
  const path = "/" + relative(OUT, f).replace(/index\.html$/, "");
  const page = path;

  const title = unescape(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  if (!title) err(page, "no <title>"); else {
    if (title.length > 70) warn(page, `title ${title.length} chars (Google trims near 60 to 70)`);
    titles.set(title, [...(titles.get(title) ?? []), page]);
  }
  const desc = meta(html, "name", "description");
  if (!desc) err(page, "no meta description"); else {
    if (desc.length < 50 || desc.length > 160) warn(page, `description ${desc.length} chars`);
    descs.set(desc, [...(descs.get(desc) ?? []), page]);
  }

  if (path === "/404/") { if (!/<meta name="robots" content="noindex/.test(html)) err(page, "404 is indexable"); continue; }
  // Other noindex pages (draft procedures, diagram windows) are not for search: only the sitemap rule below applies.
  if (/<meta name="robots" content="noindex/.test(html)) continue;
  const canon = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canon !== SITE + path) err(page, `canonical is ${canon}`);

  for (const k of ["og:title", "og:description", "og:url", "og:image"]) if (!meta(html, "property", k)) err(page, `no ${k}`);
  if (meta(html, "property", "og:url") && meta(html, "property", "og:url") !== SITE + path) err(page, `og:url is ${meta(html, "property", "og:url")}`);
  if (meta(html, "name", "twitter:card") !== "summary_large_image") err(page, "twitter:card is not summary_large_image");
  const og = meta(html, "property", "og:image");
  if (og) {
    const file = fileFor(og);
    if (!file || !existsSync(file)) err(page, `og:image missing on disk: ${og}`);
    else {
      const w = +meta(html, "property", "og:image:width"), h = +meta(html, "property", "og:image:height");
      const real = pngSize(file);
      if (real && (real[0] !== w || real[1] !== h)) err(page, `og:image is ${real.join("x")}, tag says ${w}x${h}`);
      if (w < 200 || h < 200) err(page, `og:image ${w}x${h} is under the 200px minimum`);
      else if (w < 600) warn(page, `og:image only ${w}px wide (shows as a small preview)`);
    }
  }
  if (!html.includes('rel="icon"')) err(page, "no favicon link");

  const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) err(page, `${h1s} <h1> elements`);
  for (const img of html.match(/<img [^>]*>/g) ?? []) if (!/ alt="/.test(img)) err(page, `img without alt: ${img.slice(0, 80)}`);
  if (/[—]/.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) err(page, "em dash in copy");

  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!lds.length) err(page, "no JSON-LD");
  for (const [, raw] of lds) {
    let g; try { g = JSON.parse(raw)["@graph"]; } catch (e) { err(page, `JSON-LD does not parse: ${e.message}`); continue; }
    for (const n of g) {
      const need = { ItemList: ["itemListElement"], HowTo: ["name", "step"], WebSite: ["name", "url"], Vehicle: ["name", "url"], ImageObject: ["contentUrl"], Dataset: ["name", "description"], BreadcrumbList: ["itemListElement"], Book: ["name", "url"], TechArticle: ["headline", "url"] }[n["@type"]];
      if (!need) { warn(page, `unchecked JSON-LD type ${n["@type"]}`); continue; }
      for (const k of need) if (!n[k]) err(page, `${n["@type"]} missing ${k}`);
      if (n["@type"] === "Dataset" && (n.description.length < 50 || n.description.length > 5000)) err(page, `Dataset description ${n.description.length} chars (Google wants 50 to 5000)`);
      const urls = [n.url, n.contentUrl, n.thumbnailUrl, ...(n.itemListElement ?? []).map((i) => i.item ?? i.url), ...[n.image ?? []].flat().map((i) => i.contentUrl ?? i)].filter((u) => typeof u === "string");
      for (const u of urls) { const file = fileFor(u); if (!file || !existsSync(file)) err(page, `${n["@type"]} links to missing ${u}`); }
      if (n["@type"] === "ImageObject" && !n.creditText) warn(page, `ImageObject ${n.contentUrl} has no credit`);
    }
  }
}

for (const [t, ps] of titles) if (ps.length > 1) err(ps.join(", "), `duplicate title "${t}"`);
for (const [d, ps] of descs) if (ps.length > 1) warn(ps.join(", "), `duplicate description "${d.slice(0, 60)}..."`);

// sitemap: every URL exists, every page is listed
const sm = readFileSync(join(OUT, "sitemap.xml"), "utf8");
const smUrls = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
for (const u of smUrls) if (!existsSync(fileFor(u))) err("sitemap.xml", `lists missing ${u}`);
const smSet = new Set(smUrls);
for (const f of pages) {
  const u = SITE + "/" + relative(OUT, f).replace(/index\.html$/, "");
  const noindex = /<meta name="robots" content="noindex/.test(readFileSync(f, "utf8"));
  if (noindex && smSet.has(u)) err("sitemap.xml", `lists noindex page ${u}`);
  if (!noindex && !smSet.has(u)) err("sitemap.xml", `missing ${u}`);
}
for (const m of sm.matchAll(/<image:loc>([^<]*)<\/image:loc>/g)) if (!existsSync(fileFor(m[1]))) err("sitemap.xml", `image missing ${m[1]}`);

// robots and llms.txt
const robots = readFileSync(join(OUT, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) err("robots.txt", "no sitemap line");
const llms = readFileSync(join(OUT, "llms.txt"), "utf8");
if (!llms.startsWith("# ")) err("llms.txt", "must start with an H1");
for (const m of llms.matchAll(/\]\((https:[^)]*)\)/g)) if (!existsSync(fileFor(m[1]))) err("llms.txt", `dead link ${m[1]}`);
for (const f of ["favicon.ico", "icon", "apple-icon", "opengraph-image"]) if (!existsSync(join(OUT, f))) err("out", `missing /${f}`);

console.log(`Checked ${pages.length} pages, ${smUrls.length} sitemap URLs.`);
const group = (list) => { const c = new Map(); for (const l of list) { const k = l.replace(/^[^:]*: /, "").replace(/\d+/g, "N").replace(/"[^"]*"/g, '"..."').replace(/https?:\S+/g, "URL"); c.set(k, [...(c.get(k) ?? []), l]); } return c; };
for (const [label, list] of [["ERROR", errors], ["WARN", warns]]) for (const [k, ls] of group(list)) console.log(`${label} x${ls.length}  ${k}\n    e.g. ${ls.slice(0, 3).join("\n         ")}`);
console.log(errors.length ? `\n${errors.length} errors, ${warns.length} warnings` : `\nOK: 0 errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
