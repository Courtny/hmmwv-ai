import { photos } from "@/lib/data";
import { PhotoFigure } from "@/lib/ui";
export const metadata = { title: "Photos" };
export default function Photos() {
  return <div className="wrap"><section className="sec"><div className="kicker">{photos.length} images</div><h1>Photos</h1>
    <div className="grid">{photos.map((p) => <PhotoFigure key={p.id} p={p} thumb />)}</div></section></div>;
}
