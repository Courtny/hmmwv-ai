import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found", description: "This page is not in the hmmwv.ai Humvee reference. Browse variants, photos and spec tables instead.", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div className="wrap"><section className="sec">
      <div className="kicker">404</div>
      <h1>Page not found</h1>
      <p className="lede">That page is not in the reference. Try the <Link href="/variants/">variants</Link>, <Link href="/photos/">photos</Link> or <Link href="/tables/">tables</Link>.</p>
    </section></div>
  );
}
