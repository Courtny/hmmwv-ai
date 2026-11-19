import { photos } from "@/lib/data";
import { PhotoFigure } from "@/lib/ui";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ title: "Humvee (HMMWV) photos with captions and credits", description: `${photos.length} Humvee photos and diagrams from the book, each with its printed caption and photo credit.`, path: "/photos/" });
export default function Photos() {
  return <div className="wrap"><section className="sec"><div className="kicker">{photos.length} images</div><h1>Photos</h1>
    <div className="grid">{photos.map((p) => <PhotoFigure key={p.id} p={p} thumb />)}</div></section></div>;
}
