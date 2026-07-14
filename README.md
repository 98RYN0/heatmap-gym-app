# Atlas — Muscle Training Tracker

**Live:** https://98ryn0.github.io/heatmap-gym-app/ (GitHub Pages — install
it to your phone's homescreen to test the PWA experience, see
`docs/decisions.md` "Deployment — GitHub Pages")

A mobile-first PWA that shows which muscle groups you've trained recently as a
thermal heatmap, so intuitive lifters can spot gaps in their training without
following a fixed program.

## Status

The core loop works end to end: browse/search the exercise library, add
exercises to a workout session, log sets (reps/weight/RPE), finish the
session (persists to `localStorage`), and watch the front/back heatmap and
callout cards repaint from real heat data. History (list + calendar) reads
from the same log data — tapping a list entry shows the full logged detail
(exercises, sets, reps, weight, RPE) and can delete it, which repaints the
heatmap to match (see `docs/decisions.md` "View + delete a logged
workout"). The heatmap body figures are rendered by the
[`body-highlighter`](https://github.com/lahaxearnaud/body-highlighter)
library (CDN import, zero dependencies) — real anatomical regions, no
Simple/Advanced toggle (removed once it became clear the two were always
the same diagram — see `docs/decisions.md` "Heatmap toggle removed").

The exercise database covers 124 exercises across 6 groups (Chest, Back,
Shoulders, Arms, Core, Legs), each tagged with real anatomical muscle
names and per-muscle emphasis weights (see `docs/data-model.md`) — the
heatmap rolls those up into whatever body-highlighter can actually paint.

Tapping a heatmap region opens a quick-log sheet: it works out which
specific muscle in that region is least trained and suggests the
exercises that target it best — tap one and it's added straight to
today's session (see `docs/decisions.md` "Tap a region → quick-log
sheet").

The app is installable as a PWA (`manifest.json` + `sw.js`) and requests
persistent storage on load — both aimed at making `localStorage` survive
long-term on mobile browsers, which evict storage for sites that aren't
installed. See `docs/decisions.md` "Harden on-device persistence" for the
full reasoning.

There's no separate "Log" screen or nav tab — starting a session (from the
Heatmap CTA, or "Add to session" in the exercise library) reveals a
session section right on the Exercises screen, and a small bar above the
bottom nav lets you jump back to it from anywhere else while it's active.
See `docs/decisions.md` "Merge Log into Exercises."

Not yet built: light mode, the Training balance card, finer heatmap
sub-muscle splits (bicep/tricep heads, lats vs. rhomboids — not a data
gap, a rendering ceiling). See `docs/roadmap.md` for what's left.

## Structure

```
index.html          Single-page shell — 3 screens + bottom nav/session bar + detail sheets
manifest.json        PWA manifest — installability, theme colour, icon
sw.js                 Minimal service worker (no offline caching — see docs/decisions.md)
css/
  tokens.css         Colour palette, typography, spacing (design tokens)
  styles.css         Layout, components, nav
js/                  ES modules, loaded via <script type="module">
  app.js             Orchestrator — nav/tab switching, bootstraps + wires the other modules,
                     registers sw.js, requests persistent storage, syncs the bottom
                     chrome's height for .screens' padding
  data.js            fetch() for exercises.json, localStorage read/write for logs,
                     storage-persistence request
  utils.js           Small shared helpers (capitalize, local-date formatting)
  muscle-taxonomy.js The 6 exercise-library groups + the real-muscle → body-highlighter
                     region mapping (js/heat.js's rollup table)
  exercises.js       Exercise library: render, search, filter, detail sheet
  log.js             In-progress session state: add/edit/remove exercises + sets, finish
                     → localStorage. No screen of its own — renders into the Exercises
                     screen's session section and the persistent session bar
  heat.js            Pure heat-calc functions (no DOM): set heat, recency, normalize
  heatmap.js         Renders body figures via the body-highlighter CDN import, paints
                     regions + callout cards from heat.js output, quick-log sheet
  history.js         History screen: list + calendar, log detail sheet
data/
  exercises.json     Exercise database matching docs/data-model.md's schema
assets/
  app_icon.png       Full-resolution source icon (1254x1254), Ryan-provided
  icon-192.png       App/PWA icon — manifest.json + favicon
  icon-512.png       App/PWA icon — manifest.json (larger/maskable use)
  icon-180.png       App/PWA icon — apple-touch-icon (iOS homescreen)
  legacy/            Superseded hand-drawn body SVGs, unused — see assets/README.md
docs/
  decisions.md       Product + design decisions log, with reasoning
  data-model.md       Exercise/workout JSON shapes, heat formula, taxonomy
  ui-notes.md         Screen-by-screen layout and design language notes
  roadmap.md          What's left to build
.claude/
  launch.json         Preview-tool server config
  serve.ps1            Minimal static file server (PowerShell) — see "Running it" below
```

## Running it

No build step — vanilla HTML/CSS/JS, loaded as ES modules. Because `app.js`
fetches `data/exercises.json`, it needs to be served over `http://`, not
opened directly as a `file://` URL (browsers block module `fetch()` from
`file://`). `heatmap.js` also imports the `body-highlighter` library
straight from a CDN (`unpkg.com`), so the first load needs network access —
the browser caches it after that.

Neither Node nor Python is installed on this machine as of the last session,
so there's a zero-dependency static server in `.claude/serve.ps1` (pure
PowerShell, no install required):

```
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1 -Port 5174
```

then open `http://localhost:5174`. If Node ever gets installed properly,
`npx serve .` works just as well and `.claude/launch.json` can point back to
it.

## Next steps

See `docs/roadmap.md`.
