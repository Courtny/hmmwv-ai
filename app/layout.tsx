import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: { default: "HMMWV Reference", template: "%s | hmmwv.ai" }, description: "Every Humvee variant, photo and spec table, with credits." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="top"><div className="wrap bar">
          <Link href="/" className="brand">Humvee Reference</Link>
          <nav><Link href="/variants/">Variants</Link><Link href="/photos/">Photos</Link><Link href="/tables/">Tables</Link></nav>
        </div></header>
        <main>{children}</main>
        <footer className="foot"><div className="wrap">Content from the book, with credits printed under every image. hmmwv.ai</div></footer>
      </body>
    </html>
  );
}
