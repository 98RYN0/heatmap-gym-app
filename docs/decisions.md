# Muscle heatmap app — decisions log

A running record of every product and design decision made, with reasoning. Update this file whenever a decision is made or revised.

---

## Product

### Target user
Intuitive lifters — people who go to the gym without a fixed program but have a rough sense of what they want to hit. Specifically targeting people who are *new* to intuitive lifting and need help identifying gaps in their training coverage.

### App name — Atlas — RESOLVED 2026-07-13
**Decision:** The app's actual identity — `manifest.json`'s `name`/`short_name` (what shows under the icon on a phone's homescreen) and `index.html`'s `<title>` (browser tab) — changed from the placeholder "Heatmap" to "Atlas". The **Heatmap tab/screen itself keeps its name** — it's a distinct in-app feature (the anatomical heatmap), not the app's brand, the same way a fitness app's brand name and its "Dashboard" tab aren't the same thing. Nothing else changed: `js/*.js`, `data/exercises.json`, region ids, CSS classes, and every doc's references to "the Heatmap screen" are all about that feature and were left alone.
**Not done:** the GitHub repo (`heatmap-gym-app`) and its live Pages URL (`https://98ryn0.github.io/heatmap-gym-app/`) still say "heatmap" — renaming either would break the current published link (GitHub does redirect after a repo rename, but Pages URLs built from the repo name change regardless), so that's left as a separate call for Ryan to make rather than done as a side effect of this one.

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

### Continuous heatmap gradient — RESOLVED 2026-07-12
**Decision:** Replaced the 3-bucket warm/hot/max tier system with a 40-step interpolated gradient. Ryan's complaint was concrete: one bench press set and five bicep curl sets could both round into the same "warm" bucket and paint chest and biceps identically, even though they're obviously not the same amount of training. body-highlighter colours a region by counting synthetic entries in its `data` array and indexing `highlightedColors[frequency - 1]` (confirmed by reading the library's own source, `body-highlighter@3.0.2/dist/body-highlighter.esm.js`) — critically, that index is **clamped to the array's length**, not hardcoded to expect exactly 3 colours. So `js/heatmap.js` now builds a 40-colour array (`buildGradient()`, piecewise-linear RGB interpolation across the same 4 named tokens: cold → warm → hot → max) and picks `Math.max(1, Math.round(normalized * 40))` synthetic entries per region instead of a 3-way tier lookup — same mechanism as before (the library's public `data`/`highlightedColors` API, no fork, no low-level DOM patching), just finer-grained. The gradient's first and last colours land exactly on the named cold/max tokens, so the endpoints are pixel-identical to before; only the space between them changed from 2 hard jumps to a smooth ramp.

**Verified live (2026-07-12):** logged 1 set of Barbell Bench Press + 5 sets of Barbell Curl (Ryan's own example). Biceps normalized to 1.0 (exact `--color-heat-max` red, the session's peak) while chest normalized to 0.11 — a distinctly different, much cooler shade, confirmed by reading the actual rendered `<polygon>` fill colours and cross-checking by hand against `buildGradient()`'s math. Previously both would have landed in the "warm" bucket and painted identically.

**Trade-off, accepted:** still discrete, not truly continuous — body-highlighter has no per-pixel/per-shape arbitrary-fill API, only frequency-indexed colours, so two values within about 1/40th (2.5%) of each other can still round to the same step (seen live: triceps at 0.05 and front-deltoids at 0.04 shared a colour in the same test). 40 steps was picked as comfortably below the threshold where quantization is visually noticeable, at negligible cost (worst case ~20 regions × 40 tiny synthetic objects, rebuilt only on `paintHeatmap()`, not per frame) — not tuned against real usage data yet, may revisit.

**`js/heat.js`'s `tier()` removed** — it was single-purpose (only `js/heatmap.js`'s tier→colour lookup used it) and is now dead code with the tier system gone. `normalize()` is untouched; it already just produces the 0-1 values the gradient reads.

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

### Remove an exercise from the in-progress session — RESOLVED 2026-07-11
**Decision:** Each exercise card in the active Log screen session now has a small ✕ (`.remove-exercise-btn`, reusing `.icon-button`) in its header, dropping that exercise — and any sets already entered for it — from `currentSession` before Finish is pressed. No `confirm()` gate, unlike History's delete-a-saved-log flow: nothing has been persisted yet, so there's nothing destructive to guard against, just an in-memory array filter followed by a re-render.

Required restructuring `buildExerciseCard`'s header markup slightly: `exercise-name`/`exercise-meta` are now wrapped in a new `.exercise-card-title` container so the header's existing `justify-content: space-between` still reads as "title block on the left, one action on the right" with three children instead of two. The read-only card markup History's log detail sheet reuses (`js/history.js`) was deliberately left as the old two-child structure — it has no remove action and isn't meant to, so it didn't need the wrapper.

**Reasoning:** Distinct from (and simpler than) History's delete flow — this corrects an accidental add before anything is saved, not a persisted-data deletion. Prompted directly by testing: added Push-Up to a session by mistake with no way to back out short of finishing the whole session or reloading the page.

### Bodyweight exercises don't ask for weight — RESOLVED 2026-07-11
**Decision:** `log.js`'s `buildExerciseCard` checks `exercise.equipment.includes('bodyweight')` and, for those exercises, leaves the weight `<input>` out of the set-entry form entirely (not shown-and-optional — genuinely absent) and doesn't require it to add a set. Sets logged for a bodyweight exercise have no `weight` key at all in storage, rather than `0` or `null` — `0 kg` would misleadingly read as "you logged a weight, it was zero," and the field simply isn't meaningful for e.g. a bodyweight Push-Up or Plank.

Since both the Log screen's active session cards and History's read-only log detail sheet render set rows, and both needed the same "only show kg if it's there" conditional, that rendering moved into one shared `formatSetRow(set, index)` helper (`js/utils.js`) used by both `log.js` and `history.js` — avoids the two views silently drifting apart the way `.exercise-card-header` markup nearly did across three near-duplicate copies already in this codebase.

**Reasoning:** Ryan pointed out the app was forcing a weight value on exercises that plainly don't have one — a real usability gap, not a design nuance. No formula change needed: `heat.js`'s `setHeat` (`reps × rpe / 10`) never used `weight` in the first place, so bodyweight exercises already contributed heat correctly; this only ever affected the logging *form*, not the calculation.

**Scope boundary:** doesn't handle weighted bodyweight variants (e.g. a weighted pull-up with a dip belt) — no exercise in the current database is tagged as needing both a bodyweight-style entry and an optional added-weight field, so that's not built. If one's added later, it'd need its own equipment tag (e.g. `"weighted-bodyweight"`) rather than overloading `"bodyweight"`.

### Per-set duplicate/edit/remove in the active session — RESOLVED 2026-07-11
**Decision:** Each logged set in the active Log screen session (not History's read-only view — see below) now has three icons: **duplicate** (⧉, inserts an identical copy directly after — the concrete case that prompted this: three warm-up sets at the same reps/weight, log one, then just duplicate it twice), **edit** (✎, turns that one row into an inline form pre-filled with its current values), and **remove** (✕, deletes just that set, not the whole exercise). Editing reuses the same reps/weight(if applicable)/RPE inputs and validation as adding a new set — weight is still skipped for bodyweight exercises (previous entry) — and replaces the set in place via `entry.sets[index] = updated`, so its position in the list doesn't change. A save (✓) commits it; cancel (✕) discards the edit and restores the original row untouched.

At most one set across the whole session can be mid-edit at once, tracked by a single module-level `editingSet = { entry, index } | null` in `log.js` rather than a per-row flag — simple because `renderSession()` already throws away and rebuilds every card on any change, so there's nowhere for stale per-row state to live anyway. Explicitly cleared when it'd otherwise go stale: the exercise it belongs to gets removed, the set itself gets removed, or the whole session finishes.

**Reasoning:** Previously the only way to correct a logged set was deleting the entire exercise card and re-adding it — reasonable for "I added the wrong exercise" (still handled by the exercise-level ✕ from the previous session's work) but heavy-handed for "I mistyped one number" or "I want three identical warm-up sets." This is scoped to the *in-progress* session only, same boundary as the exercise-level remove button above — History's already-saved logs stay read-only (delete-the-whole-log is still the only mutation there, see "View + delete a logged workout"), so `utils.js`'s shared `formatSetRow()` (used by History) was left untouched; this instead got its own `buildSetRowHTML()` local to `log.js`, since the interactive controls have no read-only equivalent to share.

---

## UI / UX

### Design direction
- Mobile-first
- Dark mode primary, with a light mode toggle available
- Proactive assistant feel (surfaces insights and callouts) rather than reactive journal feel (just logs what happened)

### Navigation
- Bottom tab bar, 3 tabs: Heatmap, Exercises, History (originally 4 — see "Merge Log into Exercises")

### Bottom nav icons — RESOLVED 2026-07-12
**Decision:** Added a Tabler outline icon above each nav label — flame (Heatmap, matching the thermal colour language already used for heat), clipboard-list (Log), barbell (Exercises), history (History). Icons sit *alongside* the existing text labels, not replacing them — Ryan was explicit that both should stay, unlike the "replacing the current text labels" framing the roadmap backlog item had used. Icons are Tabler's real SVGs (MIT licensed), inlined directly as raw `<svg>` markup in `index.html` rather than pulled from a CDN or icon font — only 4 are needed, so embedding them costs nothing and keeps the nav working without a network request, unlike `body-highlighter`'s CDN import (which has to be a CDN import, since it's a whole rendering library, not 4 static icons). Each icon uses `stroke="currentColor"`, so it automatically tracks `.nav-item`'s own text colour (muted vs. accent when `.active`) with zero extra CSS — no separate active-icon-colour rule needed.

**Reasoning for taller nav:** icon + label needs more vertical room than a label alone — `.nav-item` grew from ~30px to ~77px tall (padding bumped from `--space-sm` all round to `--space-md`/`--space-sm`, gap from a hardcoded `2px` to `--space-xs`). `.screens`' `padding-bottom` (which exists purely to keep scrollable content from sitting under the fixed nav) was bumped from 80px to 100px to match, checked live against the Heatmap screen's CTA button to confirm no overlap.

### Real app icon — RESOLVED 2026-07-13
**Decision:** Replaced the placeholder `assets/icon.svg` (a bootstrap-era generated silhouette) with the real icon Ryan supplied (`assets/app_icon.png`, 1254×1254 — the same heated-chest/thermal visual language as the rest of the app). Since manifest icon guidance expects accurate `sizes` per file rather than one oversized image, generated `icon-192.png` and `icon-512.png` (manifest.json's two icon entries, both `purpose: "any"`) plus `icon-180.png` (the size iOS specifically expects for `apple-touch-icon`) from the source via .NET's `System.Drawing` in a one-off PowerShell script — no image-processing package needed for a one-time resize, consistent with this project's "no build step, no npm install" stance elsewhere. Also cut the 512px version's file size from the source's 1.4MB down to ~324KB in the process.

Added `<link rel="apple-touch-icon">` alongside the existing favicon `<link>` — iOS Safari's "Add to Home Screen" reads that tag specifically rather than the manifest's `icons` array (which is what Android/Chrome uses), so without it the homescreen icon would silently fall back to a screenshot of the page instead of this icon. The original full-res PNG is kept as `assets/app_icon.png` (source of truth, not referenced directly anywhere) rather than deleted, in case a size needs regenerating later. `assets/icon.svg` was deleted outright rather than moved to `assets/legacy/` — that folder is for superseded assets kept as reference (the old hand-drawn body SVGs, still structurally interesting); the placeholder icon has no such value now that a real one exists.

### Merge Log into Exercises — RESOLVED 2026-07-14
**Decision:** Removed "Log" as its own bottom-nav tab — reachable cold with nothing in it (empty-state message, a button that just jumped to Exercises) was a real problem Ryan called out directly. `#screen-log` is gone; its content (session list, Finish button) now lives inside `#screen-exercises`, in a session section hidden until the session has ≥1 exercise. `js/log.js` keeps owning `currentSession` and all the set add/edit/duplicate/remove logic exactly as before — only *where* it renders changed, not how the session itself works. A session still only starts from Heatmap's "+ Log workout" CTA or "Add to session" from the exercise detail/quick-log sheets; there's no way to land on an empty session cold anymore, which was the actual goal.

**Getting back to an active session.** Confirmed with Ryan up front (not obvious from the request alone): not a second bottom-nav entry, not Heatmap-CTA-only — a small persistent bar fixed above the bottom nav, visible on any screen except Exercises itself (redundant there — the session's already showing) whenever `currentSession.exercises` is non-empty. Owned by `js/log.js` (`updateSessionBar()`, exported) since it already owns the session state; `app.js`'s `switchTab()` also calls it after every navigation, since landing on Exercises needs to hide the bar even when the session itself didn't change.

**`.bottom-chrome` wrapper.** The session bar and the bottom nav are both fixed-position elements at the viewport bottom, and needed to stack directly on top of each other regardless of either one's height. Rather than computing a manual offset (`bottom: 77px` or similar, which breaks the moment either element's height changes — as it already has twice this session), both now live as normal-flow children inside one `position: fixed` wrapper (`.bottom-chrome`), so they stack via ordinary layout with no coordinate math.

**`--bottom-chrome-height` instead of a fourth hardcoded px guess.** `.screens`' `padding-bottom` has been manually bumped twice already as the nav grew (icons, then bigger touch targets) — adding a second dynamically-appearing element (the session bar) made a third guess clearly not worth it. `app.js` now measures `.bottom-chrome`'s real height and writes it to a CSS custom property. Two observers feed it: a `ResizeObserver` for the general case, and a `MutationObserver` watching the session bar's `class` attribute specifically — added after live testing showed `ResizeObserver`'s callback (tied to the rendering pipeline) produced zero notifications for a show/hide toggle in a backgrounded browser tab, while a `MutationObserver` (a microtask, not subject to that throttling) caught it immediately. Real foregrounded usage wouldn't hit the `ResizeObserver` gap, but a backgrounded/inactive tab on a real phone is a plausible enough case that the `MutationObserver` stayed in rather than being test-only scaffolding.

**Hiding mechanism.** Both the session section and the session bar declare their own non-default `display` (`block`/`flex`), so a plain `[hidden]`-attribute approach wouldn't reliably override it (a class selector and an attribute selector tie on specificity, and author rules always win over the `[hidden]` UA default at equal specificity regardless of source order). Used a `.hidden { display: none !important; }` utility, toggled via `classList`, for both instead. The Finish button has no such conflict (`.text-action` declares no `display` of its own), so it still uses the plain `hidden` attribute.

### Home screen
- Heatmap is the hero element
- Contextual callout cards above the heatmap (e.g. "Rear delts — 9 days since last trained", "Chest — most trained, 3 sessions")
- Primary CTA: "+ Log workout" button always visible

### Screens (inventory)
1. **Heatmap** (home) — hero heatmap, contextual callouts, "+ Log workout" CTA
2. **Exercises** — browsable/searchable library, filterable by muscle group; also hosts the in-progress session (added exercises, sets, Finish) once one exists — see "Merge Log into Exercises"
3. **History** — 30-day view, calendar or list based

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

### ~~Heat tier thresholds~~ — superseded 2026-07-12
~~Decision: Normalised heat values map to the 4 existing CSS tiers as: 0 → cold, 0–0.33 → warm, 0.33–0.66 → hot, 0.66–1 → max (even thirds).~~ Superseded by "Continuous heatmap gradient" below, once it became clear 3 buckets made meaningfully-different training amounts (e.g. one bench press set vs. five bicep curl sets) paint identically whenever they landed in the same third.

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

## Storage & persistence

### Harden on-device persistence — RESOLVED 2026-07-11
**Decision:** Ryan asked about persistence after noticing what turned out to be Claude clearing `localStorage` between test batches during verification, not a real bug — `localStorage` already survives normal app/browser/server restarts. Confirmed the actual goal was reliable *single-device* storage, not cross-device sync (which stays deferred — see `docs/data-model.md` "Storage (MVP)"). Implemented three things:

1. **`navigator.storage.persist()`** (`js/data.js`'s `requestPersistentStorage()`, called once from `app.js`) — asks supporting browsers (Chrome/Firefox/Edge) to exempt this origin from automatic storage eviction under pressure. Best-effort and silent by design — the browser grants or denies based on its own engagement heuristics (confirmed via `navigator.storage.persisted()` in a fresh test browser: `false`, as expected with no real usage history — this is the browser working correctly, not a bug).
2. **PWA installability** — `manifest.json` + a deliberately minimal `sw.js` (install/activate/fetch passthrough, no offline asset caching — that's a separate feature with its own cache-versioning concerns, not needed here). This was already sitting in `docs/roadmap.md`'s backlog; doing it now serves double duty, since an installed/homescreen PWA is treated as persistent storage on mobile browsers (especially iOS Safari) in a way a plain bookmarked tab isn't.
3. ~~**Export/import backup**~~ — removed 2026-07-14, see below.

**Explicitly not done:** migrating from `localStorage` to IndexedDB. Both are evicted under the same browser storage-pressure policy, so it wouldn't reduce eviction risk — the actual risk this work targets. IndexedDB's real advantage (capacity) isn't a constraint here: years of workout logs as JSON stays well under `localStorage`'s ~5-10MB cap. Would add real complexity (async API, a data migration) for a problem this app doesn't have.

### Export/import backup — REMOVED 2026-07-14
**Decision:** Removed the manual JSON export/import backup UI (the ↓/↑ icon buttons in the History screen topbar, plus `js/data.js`'s `exportLogs()`/`importLogs()`) entirely — Ryan hadn't asked for it (it was added proactively alongside `storage.persist()` and PWA installability in "Harden on-device persistence" above, as a third layer of protection against storage eviction) and didn't find it useful in practice. `js/history.js`'s `onLogsChanged` callback stays — deleting a single log (see "View + delete a logged workout") still needs it to repaint the heatmap, it just no longer fires from an import path that no longer exists.
**Reasoning:** A feature nobody asked for and nobody uses is just surface area — extra UI to explain, extra code path to keep working, for a risk (storage eviction) the other two layers already cover reasonably well. Confirms the general lesson: proactively adding "might be useful" safety-net features has a cost even when each one seems individually reasonable at the time.

### Dev server bug found + fixed along the way
While testing, `.claude/serve.ps1` (the local static file server, not part of the shipped app) threw `"Bytes to be written to the stream exceed the Content-Length bytes size specified"` and appeared to wedge the whole listener loop. Root cause: the 404-response branch wrote bytes without ever setting `ContentLength64` first (unlike the 200 branch, which always matched the two). Fixed by setting it in both branches, wrapped the per-request handling in try/catch so one bad request can't take down the loop, and set `KeepAlive = $false` since this single-threaded server can only handle one request at a time — keep-alive connections being reused/pipelined by the browser before a response fully closed was the likely trigger.

### Deployment — GitHub Pages — RESOLVED 2026-07-11
**Decision:** Deployed to GitHub Pages at https://98ryn0.github.io/heatmap-gym-app/, serving directly from the `master` branch root (no build step needed — the app already runs as-is). This required making the repo **public** — GitHub Pages' free tier only publishes from public repos; private-repo Pages needs a paid plan. Ryan chose public + Pages over the alternative (keep it private, deploy via a host that supports private repos on a free tier, e.g. Netlify/Vercel) after that tradeoff was raised explicitly.

**Reasoning:** Ryan asked how to test the PWA install flow on his phone. Two things ruled out simpler options: the local dev server only binds to `localhost` (unreachable from a phone at all), and even exposing it over the LAN wouldn't have worked — service worker registration and the "Add to Home Screen" prompt both require a secure context (HTTPS, or `localhost` specifically), so a plain-HTTP LAN address would silently fail to demonstrate installability even though the page would load. A real HTTPS deployment was the only way to actually test this.

**Bug caught before it mattered:** `manifest.json`'s `start_url`/`scope` were `"/"`, which resolves to the *domain* root (`https://98ryn0.github.io/`) rather than this repo's `/heatmap-gym-app/` subpath — would have made the installed app's start_url wrong. Changed both to `"."`, which resolves relative to the manifest's own location and works correctly under any subpath (including local testing, where it's already effectively the root).

---

## History

### View + delete a logged workout — RESOLVED 2026-07-11
**Decision:** Tapping a History list entry opens a new bottom sheet (`#log-detail-sheet`) showing that log's date, a summary line, and one read-only `.exercise-card` per logged exercise (name, muscle group, and every set's reps/weight/RPE) — reusing the exact same card markup `log.js` renders for an active session, minus the interactive add-set form. A "Delete workout" button, styled with a new `.cta-danger` class (same shape as `.cta-primary`, but using the existing `--color-heat-max` red so it doesn't read as the primary positive action), removes the log after a native `confirm()` — consistent with the existing import flow's "destructive, confirm first" pattern.

Deleting changes the data the heatmap is computed from, so it needed the same repaint the Log screen's "Finish" already triggers. Rather than add a second callback, the existing `onDataImported` callback (previously only fired after a backup import) was renamed to `onLogsChanged` and now fires from both import and delete — one callback, two triggers, since both need the identical downstream effect.

**Scope boundary:** list view only, not the calendar — a calendar day can't unambiguously represent one log (nothing stops logging twice in a day), so disambiguating multiple same-day logs from a tapped calendar cell is a separate design question, not addressed here.

**Bug found along the way:** `finishSession()` (`js/log.js`) never assigned an `id` to a session before saving it — every previously-logged workout in real usage had no stable identifier at all (only hand-written test fixtures happened to include one). Fixed by generating one with `crypto.randomUUID()` at finish time, same mechanism already used elsewhere for ids in a build with no backend. See `docs/data-model.md`'s workout log entry field notes.

**Follow-up bug, caught by Ryan testing on his phone (2026-07-11):** the id fix above only covers logs saved *after* the update — anyone with logs already sitting in `localStorage` from before it (Ryan's phone, from earlier PWA-install testing) still had `id: undefined` on those, so tapping them did nothing (the id-based lookup silently failed to match). Fixed by backfilling `id` inside `loadLogs()` (`js/data.js`) itself: any log missing one gets `crypto.randomUUID()` assigned and the array re-saved, the first time it's read after the update. Every consumer already goes through `loadLogs()`, so this self-heals on next load with no separate migration step needed.

---

## Open questions / revisit later
- Heat formula weighting — may need adjustment once tested with real data
- Recency window — open to revisiting 10 days vs 7 days post-MVP
