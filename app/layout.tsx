import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SITE_URL, SITE_NAME, JsonLd, abs } from "@/lib/seo";

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--f-head", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-body", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

const DESCRIPTION = "Humvee (HMMWV) reference: every factory variant with engine, dimensions and performance data, plus credited photos and spec tables from the book.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Humvee (HMMWV) Variants, Specs and Photos", template: "%s | hmmwv.ai" },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};
export const viewport: Viewport = { themeColor: "#1C201B" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <JsonLd data={{ "@type": "WebSite", "@id": abs("/#website"), url: abs("/"), name: SITE_NAME, description: DESCRIPTION, inLanguage: "en" }} />
        <a href="#main" className="skip">Skip to content</a>
        <header className="top"><div className="wrap bar">
          <Link href="/" className="brand">Humvee Reference</Link>
          <nav aria-label="Main"><Link href="/variants/">Variants</Link><Link href="/photos/">Photos</Link><Link href="/tables/">Tables</Link><Link href="/manuals/">Technical Manuals</Link></nav>
        </div></header>
        <main id="main">{children}</main>
        <footer className="foot"><div className="wrap">Content from the book, with credits printed under every image. hmmwv.ai</div></footer>
      </body>
    </html>
  );
}
