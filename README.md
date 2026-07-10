# Heatmap — Muscle Training Tracker

A mobile-first PWA that shows which muscle groups you've trained recently as a
thermal heatmap, so intuitive lifters can spot gaps in their training without
following a fixed program.

## Status

The core loop works end to end: browse/search the exercise library, add
exercises to a workout session, log sets (reps/weight/RPE), finish the
session (persists to `localStorage`), and watch the front/back heatmap and
callout cards repaint from real heat data. History (list + calendar) reads
from the same log data. The heatmap body figures are rendered by the
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

Not yet built: nav icons, light mode, PWA manifest, the Training balance
card, finer heatmap sub-muscle splits (bicep/tricep heads, lats vs.
rhomboids — not a data gap, a rendering ceiling). See `docs/roadmap.md`
for what's left.

## Structure

```
index.html          Single-page shell — 4 screens + bottom nav + detail sheet
css/
  tokens.css         Colour palette, typography, spacing (design tokens)
  styles.css         Layout, components, nav
js/                  ES modules, loaded via <script type="module">
  app.js             Orchestrator — nav/tab switching, bootstraps + wires the other modules
  data.js            fetch() for exercises.json, localStorage read/write for logs
  utils.js           Small shared helpers (capitalize, local-date formatting)
  muscle-taxonomy.js The 6 exercise-library groups + the real-muscle → body-highlighter
                     region mapping (js/heat.js's rollup table)
  exercises.js       Exercise library: render, search, filter, detail sheet
  log.js             Active session state: add exercise/sets, finish → localStorage
  heat.js            Pure heat-calc functions (no DOM): set heat, recency, normalize, tier
  heatmap.js         Renders body figures via the body-highlighter CDN import, paints
                     regions + callout cards from heat.js output
  history.js         History screen: reverse-chronological list + month calendar
data/
  exercises.json     Exercise database matching docs/data-model.md's schema
assets/
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
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1 -Port 5173
```

then open `http://localhost:5173`. If Node ever gets installed properly,
`npx serve .` works just as well and `.claude/launch.json` can point back to
it.

## Next steps

See `docs/roadmap.md`.
