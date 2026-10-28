# FMImporter

Status: maintenance
Health: green
Summary: Client-side web app to import Football Manager squad exports, track player development across seasons and plan squads; all data stays in the browser (IndexedDB).
Run: `npm run dev`
Repo: https://github.com/tormigit/FMImporter
Prod: https://seljenes.no/fmimporter

## Now
- [ ] Deploy day (Tormod's OK, all sites together, see `01-active/projectDashboard/ROADMAP.md`): push the
      Cloudflare Web Analytics commit, then check on the live site that the counter loads without console errors

## Next

## Later

## Done
- [x] Cloudflare Web Analytics (2026-10-28, committed, not pushed yet): `app/public/cf-analytics.js` (loaded from
      `app/index.html`) starts the cookieless counter after page load, on fmimporter.netlify.app and seljenes.no only;
      CSP allows it. GoatCounter removed (script tag and its CSP entries), so there is one counter like on the other sites
- [x] FM HTML import, multi-season tracking with attribute-change highlighting
- [x] Analytics (development potential, superstar probability, keep/sell) + DEVELOP/KEEP/MONITOR/SELL recommendations
- [x] Drag-and-drop squad builder, player detail screen, JSON export/import
- [x] Dependabot alerts fixed (npm audit fix: vite, postcss, nanoid, js-yaml and others)
