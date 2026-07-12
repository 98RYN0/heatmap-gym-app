# Build roadmap / status log

This used to be a step-by-step tutorial checklist for Ryan to build the app
himself. Collaboration mode changed 2026-07-09 — see `docs/decisions.md` —
to Claude writing the implementation directly, so this is now a plain
build/status log instead: what's done, what's next, and why anything
non-obvious was built the way it was. Update it as work happens.

---

## Done (2026-07-09)

**Foundation**
- `index.html` fixed (closed `<main>`/`<html>`, `tokens.css` + `styles.css`
  linked, `js/app.js` loaded as an ES module) and all 4 screens built out
  per `docs/ui-notes.md`'s layouts
- `css/tokens.css` — real palette/type/spacing tokens from `docs/ui-notes.md`
- Bottom nav + tab switching (`app.js`)

**Exercise library + logging**
- `data.js` — `fetch()`s `data/exercises.json`, `localStorage` read/write
  for logs (key `heatmap_logs`)
- `exercises.js` — render/search/filter (filter-pill → muscle-group mapping
  per `docs/decisions.md`), detail bottom sheet
- `log.js` — session state, add exercise (via Exercises tab), add sets,
  Finish → persists to `localStorage`, returns to Heatmap

**Heatmap + History**
- `heat.js` — `setHeat`, `daysAgo`, `recencyWeight` (10-day window),
  `computeRawHeat`, `normalize`, `tier`, per the formulas in
  `docs/data-model.md`
- Body SVGs (`assets/body-front.svg` / `body-back.svg`) embedded and painted
  by `heatmap.js`; callout cards ("Needs work" / "Most trained") computed
  from real heat data, including days-since-trained and session counts
- Simple/Advanced granularity toggle wired (later removed, see below)
- `history.js` — list view (reverse-chronological) and month calendar view,
  both reading from the same logs

**Bug found + fixed during Checkpoint 3 verification:** `daysAgo()` mixed a
UTC-parsed log date with a local-time "today," which read a same-day workout
as "-1 days ago" in timezones ahead of UTC (e.g. AEST). Fixed by comparing
both sides as UTC-midnight-of-the-calendar-date. The same bug pattern
existed in how `log.js` stamped a session's date (`toISOString()` shifts to
UTC first) and how `history.js` found "today" on the calendar — both fixed
via a shared `todayDateString()` helper in `utils.js` that uses local date
components instead.

## Done (2026-07-09, later same day) — heatmap renderer swap

- Replaced the hand-drawn block-shape SVGs with the
  [`body-highlighter`](https://github.com/lahaxearnaud/body-highlighter)
  library (CDN import, zero dependencies) — real anatomical SVG, no build
  step added. See `docs/decisions.md` "Heatmap renderer — body-highlighter
  library" for the full reasoning and the tier→frequency colour adapter.
- Advanced mode now actually paints its own distinct regions instead of
  mostly greying out — `data/exercises.json`'s `muscles.advanced` ids and
  `docs/data-model.md`'s taxonomy were rewritten to match the library's
  own regions (see `docs/decisions.md` for the old-id → new-id mapping and
  what granularity was traded away: no lats/rhomboids split, no
  bicep/tricep-head split, no quad-head split).
- Old SVGs kept at `assets/legacy/` (unused, not deleted — see
  `assets/README.md`).

## Done (2026-07-09, later still) — Simple/Advanced toggle removed

- Once the heatmap moved onto a single real anatomical SVG (above), Simple
  mode stopped being a genuinely different diagram — it was always the
  same regions, just with some forced to share one colour. Removed the
  toggle entirely; the heatmap always paints from `muscles.advanced` now.
  See `docs/decisions.md` "Heatmap toggle removed" for the reasoning and
  the one real tradeoff (more technical muscle names shown by default).
- `js/heat.js` simplified to a single `MUSCLE_GROUPS` list and a
  `computeRawHeat(logs, exercises)` with no granularity parameter.
  `js/heatmap.js` lost the toggle wiring and the simple→library mapping
  table. `muscles.simple` is untouched in the data model — it's the
  Exercise library's own display taxonomy, unrelated to this change.

## Done (2026-07-09, later still again) — exercise database rebuilt on muscleGroup + bias

- `data/exercises.json` expanded from 23 to 124 exercises (Chest 18, Back
  20, Shoulders 17, Arms 21, Core 15, Legs 33), and every exercise's
  schema changed from `muscles: { simple, advanced }` to a single
  `muscleGroup` (Chest/Back/Shoulders/Arms/Core/Legs, for library
  browsing) plus a `bias` list of real anatomical muscle names with
  emphasis weights (the heatmap's data source). See `docs/decisions.md`
  "Exercise database — muscleGroup + bias schema" for the full reasoning,
  including how bias muscles that share one body-highlighter region (e.g.
  Gluteus Maximus + Gluteus Medius → `gluteal`) get summed together.
- New `js/muscle-taxonomy.js` holds both taxonomies (`MUSCLE_GROUPS`,
  `MUSCLE_TO_REGIONS`). `js/heat.js`'s `computeRawHeat` now reads
  `exercise.bias` and resolves each muscle through that mapping.
  `js/exercises.js` and `js/log.js` read `exercise.muscleGroup` directly
  instead of searching an array for a "primary" entry — this also removed
  the old `LEG_MUSCLES` filter-pill bucketing hack, since `muscleGroup` is
  already the exact filter value. Filter pills expanded from 4 to all 6
  groups (Arms and Core previously had no dedicated pill).
- The Exercise detail sheet now lists `bias` muscles ranked by emphasis
  with a percentage (e.g. "Pectoralis Major — 50%") instead of generic
  primary/secondary tags — more informative, and uses the new data's full
  precision even though the heatmap itself still can't paint below
  region-level.

## Done (2026-07-09, later still again again) — tap a region to quick-log

- Wired body-highlighter's `onClick`. Tapping a region opens a new sheet
  suggesting exercises for whichever of that region's `bias` muscles is
  least trained (`js/heat.js`'s new `computeMuscleHeat`, per-muscle
  rather than per-region), ranked by how much each exercise emphasises
  it. Tapping a suggestion adds it straight to the session, reusing
  `log.js`'s existing `addExerciseToSession` — the exact same action as
  the Exercise library's "Add to session." See `docs/decisions.md` "Tap a
  region → quick-log sheet" for the full design, including how this
  partially resolves (for this one interactive drill-down, not the
  passive callouts) the per-muscle-vs-per-region tension noted below.
- `js/heat.js`'s `computeRawHeat` (region-level) is now a thin rollup on
  top of `computeMuscleHeat` (per real muscle) — one summation loop
  feeding both, instead of two.

## Done (2026-07-11) — hardened on-device persistence + PWA installability

- `js/data.js` gained `requestPersistentStorage()` (`navigator.storage.persist()`,
  best-effort/silent), `exportLogs()`/`importLogs()` (JSON backup —
  buttons in the History topbar). `manifest.json` + a deliberately minimal
  `sw.js` (no offline asset caching, just enough for installability) make
  the app installable to a homescreen, which is what actually matters for
  mobile storage eviction — see `docs/decisions.md` "Harden on-device
  persistence" for the full reasoning, including why `localStorage` was
  kept rather than migrating to IndexedDB. This also closes out the
  **PWA manifest** item that had been sitting in this backlog.
- Along the way, found and fixed a real bug in `.claude/serve.ps1` (the
  local dev server, not the shipped app) that could wedge its request
  loop — see `docs/decisions.md` "Dev server bug found + fixed along the
  way."

## Done (2026-07-11, later same day) — History: view + delete a logged workout

- Tapping a History list entry opens a new bottom sheet showing that log's
  full detail (exercise names, muscle group, every set's reps/weight/RPE),
  and a "Delete workout" button that removes it and repaints the heatmap.
  See `docs/decisions.md` "View + delete a logged workout" for the full
  design, including the new `.cta-danger` button style and why this is
  list-view-only (not the calendar).
- `js/data.js` gained `deleteLog(id)`. Along the way, found and fixed a real
  gap: `finishSession()` never assigned a logged workout an `id` at all —
  fixed by generating one with `crypto.randomUUID()` at finish time. See
  `docs/data-model.md`'s workout log entry field notes.

## Done (2026-07-11, later still) — remove an exercise from the in-progress session

- Each exercise card on the Log screen now has a small ✕ that drops that
  exercise (and any sets logged for it) from the current session before
  Finish is pressed — no confirm needed, since nothing's saved yet. See
  `docs/decisions.md` "Remove an exercise from the in-progress session."

## Done (2026-07-11, later still again) — bodyweight exercises skip the weight field

- Logging a set for a bodyweight exercise (equipment tagged `"bodyweight"`
  — Push-Up, Pull-Up, Plank, etc.) no longer shows or requires a weight
  input; only reps and RPE are captured. Stored sets for these exercises
  have no `weight` key at all. Set-row rendering (previously duplicated
  in `log.js` and `history.js`) was pulled into one shared
  `formatSetRow()` helper in `js/utils.js` so both views stay in sync.
  See `docs/decisions.md` "Bodyweight exercises don't ask for weight."

## Done (2026-07-11, later still again again) — duplicate/edit/remove a single logged set

- Each set in the active Log screen session now has duplicate (⧉), edit
  (✎), and remove (✕) icons — duplicating inserts an identical copy right
  after (handy for repeated warm-up sets), edit turns the row into an
  inline pre-filled form (save ✓ / cancel ✕), and remove drops just that
  set rather than the whole exercise. Scoped to the in-progress session
  only — History's saved logs are still read-only/delete-the-whole-log.
  See `docs/decisions.md` "Per-set duplicate/edit/remove in the active
  session."

## Done (2026-07-11, later still again again again) — bigger tap targets for mobile

- Ryan tested on his phone and found the set duplicate/edit/remove icons
  and the reps/weight/RPE inputs too small to comfortably tap. Enlarged
  those plus the other icon buttons, filter pills, toggle pills, and the
  search input (font-size and padding bumped a step each). Set-row layout
  re-checked at 375px width with the icons at their new size — still no
  overflow, since the row had more spare width than it needed.

## Done (2026-07-12) — continuous heatmap gradient

- The heatmap no longer buckets normalized heat into 3 discrete
  warm/hot/max colours — `js/heatmap.js`'s new `buildGradient()`
  interpolates the same 4 named tokens (cold/warm/hot/max) into a
  40-step colour ramp, and `paintHeatmap()` picks a step by rounding
  the normalized value instead of doing a 3-way tier lookup. Works
  entirely through body-highlighter's existing public API (it indexes
  `highlightedColors[frequency - 1]`, clamped to the array's length —
  no fork, no DOM patching needed). `js/heat.js`'s now-unused `tier()`
  was removed. See `docs/decisions.md` "Continuous heatmap gradient"
  for the live-verified example (1 bench press set vs. 5 bicep curl
  sets, previously identical, now visibly different).

---

## Not yet built

- **Nav icons** — Tabler outline set, replacing the current text labels
- **Light mode** — `[data-theme="light"]` token overrides + a toggle
- **Training balance card** — push/pull or upper/lower split, per
  `docs/decisions.md`'s "Heatmap home screen — secondary content" decision
- **Finer heatmap sub-muscle splits** — bicep/tricep heads, quad heads,
  lats-vs-rhomboids — not tracked in `bias` at all (see `docs/data-model.md`'s
  naming principle) since body-highlighter can't paint them as separate
  regions regardless; would need a renderer swap to become worth adding
- **Per-muscle heatmap callouts** — e.g. "Needs work: Gluteus Medius"
  specifically rather than "Gluteal" — still not done for the *passive*
  callout cards (only the interactive quick-log sheet, above, resolves
  this) because it requires deciding how to roll up multiple
  different-heat muscles sharing one visual region (see `docs/decisions.md`)
