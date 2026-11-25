# hmmwv.ai

Phase 0 reference site: variants, photos, spec tables and Army technical manuals. Built from the extracted book and TM data in /data.

```
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in /out
```

Deploy: import the repo in Vercel, point hmmwv.ai at it. No env vars needed in Phase 0.

Project rules are in CLAUDE.md. Next steps: the TODO list below.

## TODO

### Follow-ups
- Check the four draft procedures (noindex) and decide whether to publish them: fuel injection pump repair cleaning (2-32 b), fan drive repair cleaning (2-40 b), 2-20 b and 2-31 b inspection. Their steps name parts the matched figures only partly show.
- Para. 2-15 f (water crossover removal) has no procedure: the capture placed the wrong figure under it. 19 other subsections with steps have no traced figure near them, so they have no procedure (their steps stay on the manual pages).
- Most procedure titles are long printed paragraph names; consider shorter display names.
- Keep the TM capture somewhere permanent (the importer and the diagram tool read it; the unzipped copy used so far was temporary).
- After the next deploy, check the `/procedures/` redirects in vercel.json (they cannot be tested on the static preview).
- After the next deploy, submit the sitemap in Google Search Console and Bing Webmaster Tools, and request indexing for /manuals/.
- Shorten the 17 manual page titles over 70 characters (long printed paragraph names) if Search Console shows them truncated.
- 98 photo share images are under 600 px wide (scan resolution); consider a framed share card for those photos.
- Stitch the 10 spread photos.
- Chapter structure and timeline from the book's contents page.
- Replace the placeholder brand name.

### Reviews
- Check the three hand-written procedures against the PDF: water crossover (para. 2-39, page 2-147) and fan drive disassembly and assembly (para. 2-40, pages 2-148 and 2-152). Steps were transcribed by the capture and three punctuation slips fixed by hand.
- Spot-check the 88 generated procedures, especially which figure each step is tied to in the long ones (2-32 fuel injection pump repair: 69, 61 and 95 steps). Step text is as captured, so notes printed mid-step ("NOT E If unable...") and merged sub-steps show up as printed.
- TM capture callout keys fixed in the reviewed callouts (`diagrams/tm-9-2815-237-34/`), not in the capture: swapped keys on p080 and p197, neighbouring figures' numbers on p044, p064 and p123, the p082 key that stops at 17. The capture itself still has them wrong.
- "INITIAL SETUP" boxes and other pipe rows on the manual pages come from the PDF text layer and were not checked; some cells run together. The 36 transcribed tables were checked during capture.
- Section II of chapter 2 ("Service upon receipt") has no heading in the capture, so para. 2-5 is listed under Section I.
- Para. 2-13.1 shows printed page "2" for its first page (the capture's page number reading).
- The 6 low-confidence photo caption pairings (`needs_review` in content.json).
- 2 photo ImageObjects without a credit (p160-img02, p160-img03).
