// Runs after `next build` (npm postbuild). Next exports generated images (share cards, icons) as
// extensionless files: out/x/opengraph-image. On Vercel the trailing-slash rule redirects
// /x/opengraph-image to /x/opengraph-image/, which is served as application/octet-stream, so link
// previews break. Paths with an extension are never redirected and are typed from it, so this
// copies each image to <name>.png and points the HTML at the .png copy.
import { readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = "out";
const NAMES = ["opengraph-image", "twitter-image", "apple-icon", "icon"];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(OUT);

let images = 0, pages = 0;
for (const f of files) {
  const base = f.split("/").pop();
  if (NAMES.includes(base)) { copyFileSync(f, `${f}.png`); images++; }
}
// content="https://hmmwv.ai/x/opengraph-image?hash" and href="/icon?hash" -> name.png?hash
const ref = new RegExp(`((?:content|href)="[^"?]*/(?:${NAMES.join("|")}))\\?`, "g");
for (const f of files) {
  if (!f.endsWith(".html")) continue;
  const html = readFileSync(f, "utf8"), fixed = html.replace(ref, "$1.png?");
  if (fixed !== html) { writeFileSync(f, fixed); pages++; }
}
console.log(`png-names: ${images} images copied to .png, ${pages} pages updated.`);
