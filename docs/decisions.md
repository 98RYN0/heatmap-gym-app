# Muscle heatmap app — decisions log

A running record of every product and design decision made, with reasoning. Update this file whenever a decision is made or revised.

---

## Product

### Target user
Intuitive lifters — people who go to the gym without a fixed program but have a rough sense of what they want to hit. Specifically targeting people who are *new* to intuitive lifting and need help identifying gaps in their training coverage.

### Core feature loop
1. Log a workout → select exercises → muscles auto-populate from database
2. Heatmap updates to reflect recent training volume
3. Tap a cold muscle group → get exercise suggestions for it

### Platform
Progressive Web App (PWA) built with vanilla HTML, CSS, and JavaScript. Chosen because:
- Maps directly to the developer's current skillset (Scrimba curriculum)
- No native app tooling required
- Can be installed to home screen and used offline
- A gym tracker doesn't need anything a PWA can't provide
- Can be rebuilt in React/Expo later if native feel becomes a priority

---

## Heatmap

### ~~Granularity — toggle between two modes~~ — superseded 2026-07-09
- ~~Simple mode~~ — ~10–12 major muscle groups (chest, back, shoulders, biceps, triceps, core, quads, hamstrings, glutes, calves)
- ~~Advanced mode~~ — sub-muscle breakdown (e.g. long/short head bicep, anterior/lateral/posterior delt, upper/lower chest, lats vs traps vs rhomboids, VMO vs general quad)
- ~~UI pattern: a simple/advanced toggle, not two separate screens~~

Superseded by "Heatmap toggle removed" below, once the body-highlighter
renderer made it clear the two "modes" were never actually a different
diagram — see that entry for why.

### Colour language — thermal palette
- Cold/untrained muscles: dark grey (near invisible against dark background)
- Trained muscles: amber → orange → red (thermal camera style)
- Chosen over red→green traffic light palette because red = danger/neglect is counterintuitive; thermal reads more naturally as "heat = work done"

### Recency window
- **10-day rolling window** drives heatmap heat
- Sessions fade with recency — day 1 = full intensity, day 10 = ~30% — so the heatmap tapers rather than dropping off a cliff
- Reasoning: captures the last two upper body sessions for most common training splits, allowing the user to see front-delt vs rear-delt alternation decisions

### History view
- Separate **30-day history view** (on the History tab)
- Answers "am I balanced over the longer term" — distinct from the heatmap which answers "what's fresh right now"

### Body views
- Front and back anatomical views shown side by side (or flippable)
- Required because many exercises hit muscles on both sides of the body

### 3D vs 2D heatmap renderer — RESOLVED 2026-06-30
**Decision:** Build the hero heatmap as 2D front/back SVG block shapes first (per "Body views" above and the MVP approach in `data-model.md`), not a rotatable 3D model.
**Reasoning:** A 3D version (Three.js, orbit/pinch-zoom controls, raycasting for region picking) is a proven pattern elsewhere but adds real cost here: a new rendering stack, a segmented anatomical model that has to be sourced or rebuilt to match this app's exact muscle boundaries, materially larger asset size (works against the offline-installable PWA goal), weaker accessibility (SVG regions are real DOM elements; canvas regions aren't), and more battery draw on the older/budget phones this app is likely used on mid-set. The core job — a 2-second glance at what needs work — doesn't need rotation to do well; most muscle-tracking apps use the same front/back pattern for this reason. The data model already separates muscle identity/heat value from rendering, so a 3D view stays possible later as a second renderer over the same data, without redoing the heat-calc work.

### Heatmap renderer — body-highlighter library — RESOLVED 2026-07-09
**Decision:** Replaced the hand-drawn block-shape SVGs (`assets/legacy/body-front.svg` / `body-back.svg`, ~6 crude regions each) with the [`body-highlighter`](https://github.com/lahaxearnaud/body-highlighter) npm package (MIT, zero runtime dependencies, real vanilla JS not React-only). Loaded via CDN import (`https://unpkg.com/body-highlighter@3/dist/body-highlighter.esm.js`) in `js/heatmap.js` — no npm install, no build step, consistent with the existing architecture (and Node isn't actually installed on this machine anyway). Colour comes from `--color-heat-*` tokens read at runtime via `getComputedStyle`, so `tokens.css` stays the one source of truth for the palette.

The library doesn't take a continuous heat value — it colours a muscle by counting how many synthetic `{name, muscles}` entries in a `data` array mention it ("frequency"), then indexes into a 3-colour `highlightedColors` array. `js/heat.js`'s existing `tier()` output (cold/warm/hot/max) converts cleanly to that: cold = 0 entries (falls back to `bodyColor`), warm/hot/max = 1/2/3 entries. `heat.js` itself needed no changes — it's pure calculation with no DOM access; only `js/heatmap.js`'s adapter layer changed.

**Reasoning:** Fixes the "replace block shapes with anatomical SVG paths" item that had been sitting in `docs/roadmap.md` since MVP, for less implementation cost than building/sourcing anatomically-accurate SVG paths ourselves, without compromising the "vanilla JS, no build step" architecture decision above.

**Advanced-mode taxonomy — adopted the library's own regions, RESOLVED 2026-07-09:** `data/exercises.json`'s `muscles.advanced` ids and `docs/data-model.md`'s taxonomy table were rewritten to be exactly the library's own `MuscleType` strings (`trapezius`, `upper-back`, `lower-back`, `chest`, `biceps`, `triceps`, `forearm`, `front-deltoids`, `back-deltoids`, `abs`, `obliques`, `hamstring`, `quadriceps`, `calves`, `gluteal`) — `js/heat.js`/`js/heatmap.js` pass them straight through with no mapping.

This is a step down in granularity from what the original Advanced taxonomy envisioned — the library has no lats-vs-rhomboids distinction (both collapse to `upper-back`), no bicep/tricep head splits (collapse to `biceps`/`triceps`), and no quad-head split (`vmo`/`rectus-femoris` collapse to `quadriceps`). Old entries that collapse into the same new id had their `emphasis` values summed (occasionally exceeding 1.0 as a result, e.g. Barbell Curl's `biceps` entry is 1.3 — see `docs/data-model.md`'s field notes). Traded that precision for a real, maintained anatomical SVG rather than the placeholder block shapes; can revisit if a future library swap or custom SVG work restores the finer split.

The library's `onClick` callback (fires with the clicked muscle) was left unwired — it makes the long-standing "tap a cold muscle → Exercise library, pre-filtered" backlog item (`docs/roadmap.md` "Later") trivial to add later, but wasn't asked for in this pass.

### Heatmap toggle removed — RESOLVED 2026-07-09
**Decision:** Removed the Simple/Advanced toggle from the Heatmap screen entirely. The heatmap always paints from `muscles.advanced` now — no granularity switch, no `data-toggle="granularity"` markup, no simple↔library mapping table in `js/heatmap.js`. `js/heat.js` was simplified to match: a single `MUSCLE_GROUPS` list (the 15 library ids) and a `computeRawHeat(logs, exercises)` with no granularity parameter.

`muscles.simple` stays in the data model — it wasn't only feeding the old toggle. It's the display taxonomy for the Exercise library (list rows, filter pills, session cards, detail sheet — see `docs/data-model.md`), which is a separate concern from what the heatmap paints and was never affected by this change.

**Reasoning:** Once the heatmap moved onto the body-highlighter library (previous entry), Simple mode stopped being a genuinely different diagram — it was always the same 15-region SVG, just with some regions (e.g. front/back delts, the three back regions) forced to share one color instead of being computed independently. There was no rendering-cost or complexity reason left to keep two states; Advanced was strictly more informative for the same visual "shape," so keeping only it removes UI surface (one less thing to explain/build, e.g. nav icons) and code (the mapping table, the toggle state, the dual-granularity branch in `heat.js`) for no loss of capability.

The one real tradeoff, raised and accepted: the original "Granularity" decision (above, now superseded) existed partly for vocabulary reasons, not just visual ones — `docs/decisions.md`'s "Target user" is explicitly people *new* to intuitive lifting, who may not know terms like "front deltoids" or "trapezius." Going always-advanced means the callout cards now show that more technical vocabulary (e.g. "Needs work: Trapezius") by default. Ryan chose to accept this rather than add a display-name rollup back to the Simple taxonomy — revisit if it turns out to actually confuse users in practice.

### Exercise database — muscleGroup + bias schema — RESOLVED 2026-07-09
**Decision:** Replaced `muscles: { simple, advanced }` with two independent fields: `muscleGroup` (a single value — Chest/Back/Shoulders/Arms/Core/Legs — for Exercise library browsing/filtering only) and `bias` (a list of real anatomical muscle names with `emphasis` weights, e.g. `{ "muscle": "Pectoralis Major", "emphasis": 0.5 }` — the heatmap's data source). `role` (primary/secondary) is gone; emphasis alone conveys weight. The database itself was expanded from 23 to 124 exercises across the 6 groups (Chest 18, Back 20, Shoulders 17, Arms 21, Core 15, Legs 33 — legs is largest since it spans more distinct sub-areas: quads/hamstrings/glutes/adductors/abductors/calves).

New file `js/muscle-taxonomy.js` holds both taxonomies: `MUSCLE_GROUPS` (the 6 browsing categories) and `MUSCLE_TO_REGIONS` (real muscle name → body-highlighter region id(s), one-to-many where needed, e.g. Soleus → `left-soleus` + `right-soleus`).

**The rollup problem, and how it's solved:** real anatomy has far more named muscles than body-highlighter's ~20 paintable regions (e.g. Gluteus Maximus and Gluteus Medius are both real, distinctly-trainable muscles, but both only ever render as the single `gluteal` region). `js/heat.js`'s `computeRawHeat` resolves this by mapping every `bias` muscle through `MUSCLE_TO_REGIONS` and **summing** contributions into whichever region(s) it lands on — the same aggregation pattern the app already used for exercises whose old `muscles.advanced` entries collapsed into one id (see "Advanced-mode taxonomy" above). Painting and the "Needs work"/"Most trained" callouts stay region-based, not muscle-based — a true per-muscle callout (e.g. "Gluteus Medius" specifically) would require deciding how to roll up two different-heat muscles sharing one visual region (max? average?), which wasn't worth solving speculatively. `js/heatmap.js` needed **no changes** for this — it already just paints whatever region ids `heat.js` hands it.

The `bias` data's full anatomical precision isn't wasted, though: the Exercise detail sheet (`js/exercises.js`) lists `bias` muscles ranked by emphasis with a percentage (e.g. "Pectoralis Major — 50%"), which is more informative than the old primary/secondary tags and has no rendering ceiling to hit, since it's just a text list.

**Verified live (2026-07-09):** every newly-introduced region (`adductor`, `abductors`, `neck`, `left-soleus`/`right-soleus`) was checked in isolation in the browser and renders as a distinct, correctly-sized shape — none are invisible or zero-size. One quirk worth recording: body-highlighter's own `adductor` region renders on the *posterior* view and `abductors` on the *anterior* view, at visually mirrored groin-level positions — not the textbook front-inner-thigh (adductors) vs. outer-hip (abductors) placement a real anatomy chart would use. This lines up with an oddity already spotted in the library's own type definitions (its `ABDUCTOR` constant's string value is literally `"adductor"`). This is the library's own region design, not a mapping mistake on this app's side — `MUSCLE_TO_REGIONS` correctly points each muscle at the library's own id for it; there's no way to fix the library's internal placement short of forking it, which isn't warranted here.

### Tap a region → quick-log sheet — RESOLVED 2026-07-09
**Decision:** Wired body-highlighter's `onClick` (fires with `{ muscle }`, the clicked region id) to open a new bottom sheet suggesting exercises. For regions fed by more than one `bias` muscle (`upper-back`, `gluteal`, `front-deltoids`, `biceps`, `forearm` — most regions only have one), the sheet targets whichever of that region's muscles has the **lowest raw heat** (`js/heat.js`'s new `computeMuscleHeat`, same recency-weighted metric used everywhere else — no new formula invented). It then lists the exercises whose `bias` targets that muscle hardest, ranked by emphasis, top 4. Tapping a suggestion reuses `log.js`'s existing `addExerciseToSession` (the exact function already wired to the Exercise library's "Add to session" button) — no separate "quick add" code path, and it already handles jumping to the Log tab.

This directly resolves the "would require deciding how to roll up two different-heat muscles sharing one region" concern raised in the muscleGroup/bias entry above — but only for this interactive per-muscle drill-down, not for the passive heatmap painting or callout cards, which still stay region-based. Painting is a *display* problem (the SVG genuinely cannot show two colours in one shape); the quick-log sheet sidesteps it entirely by picking one muscle and switching to a text list, which has no such ceiling.

**`js/heat.js` refactor:** `computeRawHeat` (region-level, used for painting/callouts) is now a thin rollup on top of the new `computeMuscleHeat` (per real muscle, used by the quick-log picker) via the same `MUSCLE_TO_REGIONS` table — single source of truth, `js/heatmap.js`'s existing painting code needed no changes.

**Reasoning:** Reuses every existing piece (the heat formula, the emphasis-ranked list UI already built for the exercise detail sheet, the add-to-session action) rather than inventing new ones — the feature is almost entirely composition of what was already there once the muscle-level heat existed.

**Reasoning:** Separates "how a real muscle rolls up to what the current renderer can paint" (a rendering-technology limitation) from "what does this exercise actually train" (a fact about anatomy) — if body-highlighter is ever swapped again, only `MUSCLE_TO_REGIONS` needs updating, not the whole exercise database. Also fixes the `muscleGroup` filter pills' old "Legs" bucketing hack (`LEG_MUSCLES.includes(...)` in `js/exercises.js`) for free, since `muscleGroup` now equals the filter value directly — filter pills expanded from 4 to all 6 groups (Arms and Core previously had no dedicated pill).

---

## Logging

### Set tracking
Each set captures: reps, weight, and RPE (Rate of Perceived Exertion, 1–10 scale)

### Effort/heat formula
```
heat contribution per set = reps × (rpe / 10)
```
Summed per muscle group across all sets in the recency window, then normalised to 0–1 for colour mapping.

RPE chosen over 1RM-based weighting because:
- It's inherently relative to the individual — no baseline setup required
- Works for any experience level out of the box
- Presented to users as "how hard was that set?" slider (1–10) so it's intuitive even without knowing the term RPE

*Note: heat formula flagged for revisiting post-MVP once real usage data is available.*

---

## UI / UX

### Design direction
- Mobile-first
- Dark mode primary, with a light mode toggle available
- Proactive assistant feel (surfaces insights and callouts) rather than reactive journal feel (just logs what happened)

### Navigation
- Bottom tab bar, 4 tabs: Heatmap, Log, Exercises, History

### Home screen
- Heatmap is the hero element
- Contextual callout cards above the heatmap (e.g. "Rear delts — 9 days since last trained", "Chest — most trained, 3 sessions")
- Primary CTA: "+ Log workout" button always visible

### Screens (inventory)
1. **Heatmap** (home) — hero heatmap, simple/advanced toggle, contextual callouts
2. **Log workout** — active session, add exercises, log sets with reps/weight/RPE
3. **Exercise library** — browsable/searchable, filterable by muscle group; also the landing point when tapping a cold muscle on the heatmap
4. **History** — 30-day view, calendar or list based

### Log workout entry point — RESOLVED 2026-06-30
**Decision:** Blank session. Tapping "+ Log workout" opens an empty session; exercises are added manually via search/browse, not pre-suggested.
**Reasoning:** Simpler to build for MVP than surfacing heatmap-informed suggestions. Revisit post-MVP if the reactive flow feels like it's fighting the "proactive assistant" design direction.

### Exercise detail interaction — RESOLVED 2026-06-30
**Decision:** Tapping an exercise in the library opens a bottom sheet (not a full second-level screen) showing the muscle map, primary/secondary muscles, and an "Add to session" CTA.
**Reasoning:** Fits the current single-page architecture (4 top-level screens, no navigation stack) without needing back-button/history logic. Quick in-and-out for a frequent action.

### History screen format — RESOLVED 2026-06-30
**Decision:** List view by default, with a List/Calendar toggle pill — reuses the Simple/Advanced toggle component from the Heatmap screen rather than introducing a new UI pattern.
**Reasoning:** List is simplest to build and easiest to scan session details on. Calendar is useful for spotting consistency at a glance, so it's offered as a toggle rather than dropped.

### Heatmap home screen — secondary content — RESOLVED 2026-06-30
**Decision:** Add a "Training balance" card below the "+ Log workout" CTA, showing a two-segment bar comparing a muscle pairing (push/pull via each exercise's `category` field, upper/lower body, or an antagonist pair like front/rear delt in Advanced mode) plus a one-line insight (e.g. "Push-dominant this week"). Shows whichever pairing is currently most skewed rather than all pairings at once.
**Reasoning:** Fills whitespace between the CTA and bottom nav with something diagnostic rather than another action shortcut (quick-add exercises was the other option considered, and remains worth adding elsewhere later). Reuses heat data already being computed — no new tracking needed — and is a direct payoff of the recency-window design (see "Recency window" above, which already calls out front-delt/rear-delt alternation as a goal).

---

## Docs/code reset — RESOLVED 2026-07-09
**Decision:** As of 2026-07-09, this file and `README.md` claimed Phase 1+2
(exercise library, heat calc) were fully built, but the actual files on disk
were still empty stubs — the docs had drifted ahead of the code at some
point, not the other way around. Rather than try to reconcile, Ryan chose to
treat the code on disk as ground truth and rebuild from there, docs
corrected to match. `docs/roadmap.md` was converted from a step-by-step
tutorial into a plain build/status log at the same time.

**Collaboration mode, confirmed 2026-07-09:** Claude writes the app code
directly; Ryan reviews. (This had also been the stated mode as of
2026-06-30 below, then reverted, then reconfirmed here — worth checking
again if this project is picked back up after a long gap.)

**Data loading:** exercises are loaded via `fetch('data/exercises.json')`
rather than a hardcoded JS constant — see `js/data.js`. The app therefore
needs to be served over `http://`, not opened as `file://` (see README
"Running it").

The implementation decisions below (2026-06-30) describe intent that didn't
actually exist in code until this reset — they're kept here because the
2026-07-09 rebuild followed them and they turned out to still be accurate,
**except** "Sample workout log fixture," which was not carried forward (see
strikethrough note below).

## Implementation notes — Phase 1 + 2 (2026-06-30)

Collaboration mode changed 2026-06-30: Ryan asked me to write the app logic
directly (exercise library wiring, heat calc, etc.) rather than him writing
it with me consulting — see `docs/roadmap.md`. These are the implementation
decisions made while building Phase 1 (exercise library) and Phase 2 (heat
calculation), logged per this file's usual practice.

### Exercise library filter pills — RESOLVED 2026-06-30
**Decision:** Filter pills (All/Chest/Back/Shoulders/Legs) filter by an exercise's primary `muscles.simple` group, not by its `category` field (push/pull/legs/core) — the pill labels are muscle groups and don't line up with category values. "Legs" buckets quads + hamstrings + glutes + calves together. Exercises whose primary muscle is biceps, triceps, or core have no dedicated pill and only appear under "All".
**Reasoning:** Simplest mapping that matches the pill labels as already written; a fuller muscle-group pill set (or a category-based second filter) can be added later if the gaps are felt in practice.

### Simple-mode emphasis default — RESOLVED 2026-06-30
**Decision:** The heat formula's `emphasis` term (`docs/data-model.md` "Heat calculation") only has explicit values in `muscles.advanced`. For `muscles.simple`, which only has a `role`, emphasis defaults to 1.0 for `"primary"` and 0.5 for `"secondary"`.
**Reasoning:** Matches the existing data-model note that "secondary muscles render at a lighter tint" — translates that intent into the actual math rather than leaving secondary muscles weighted equally to primary ones.

### Heat tier thresholds — RESOLVED 2026-06-30
**Decision:** Normalised heat values map to the 4 existing CSS tiers as: 0 → cold, 0–0.33 → warm, 0.33–0.66 → hot, 0.66–1 → max (even thirds).
**Reasoning:** `data-model.md` only specifies the 0/1 endpoints and that intermediate values pass through amber/orange — no exact cutoffs given. An even split is the simplest default; revisit once there's a feel for how it looks across a real range of muscle heat values.

### Exercise detail sheet muscle breakdown — RESOLVED 2026-06-30
**Decision:** The exercise-detail bottom sheet always shows `muscles.simple`, regardless of the Heatmap screen's Simple/Advanced toggle state.
**Reasoning:** The sheet has no toggle of its own and its muscle-map area is still a placeholder either way; simple mode is enough until the sheet's own anatomical mini-map exists.

### ~~Sample workout log fixture~~ — superseded 2026-07-09
This described a planned fallback (`data/sample-log.json` filling in until
`localStorage` had real entries) that was never implemented. The actual
`loadLogs()` in `js/data.js` reads only from `localStorage`, with no
fixture fallback — `data/sample-log.json` is an empty, unused file. Log a
real workout via the Log tab to see the heatmap populated.

### Local date handling — RESOLVED 2026-07-09
**Decision:** `daysAgo()` (`js/heat.js`) compares log dates and "today" as
UTC-midnight-of-the-calendar-date on both sides, via `Date.UTC(...)` built
from parsed/local date components. Session dates (`log.js`) and the
calendar's "today" cell (`history.js`) use a shared `todayDateString()`
helper (`js/utils.js`) built from local date components, not
`toISOString()`.
**Reasoning:** `new Date(dateStr)` parses a date-only string as UTC
midnight, while `new Date()` + `toISOString()` converts local time to UTC
first. Mixing those meant a workout logged today, in a timezone ahead of
UTC (e.g. AEST), read as "-1 days ago" — found live during Checkpoint 3
verification. Comparing everything in one consistent reference frame
(calendar-date components, not instants) fixes it for any timezone.

---

## Open questions / revisit later
- Heat formula weighting — may need adjustment once tested with real data
- Recency window — open to revisiting 10 days vs 7 days post-MVP
