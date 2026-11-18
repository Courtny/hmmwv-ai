# hmmwv.ai

Phase 0 reference site: variants, photos, spec tables. Built from the extracted book data in /data.

```
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in /out
```

Deploy: import the repo in Vercel, point hmmwv.ai at it. No env vars needed in Phase 0.

Next steps: see .cursor/rules/project.mdc and the TODO list below.

## TODO
- Real variant pages with spec tables per series (join Table 3, 8, 9 by series)
- Stitch the 10 spread photos
- Chapter structure and timeline from the contents page
- Review the 6 low-confidence caption pairings (needs_review in content.json)
- Replace the placeholder brand name
