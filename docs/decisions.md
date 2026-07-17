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

### Exercise detail sheet: labelled percentages + mini per-exercise heatmap — RESOLVED 2026-07-14
**Decision:** The exercise detail sheet's muscle percentages were unlabelled — Ryan pointed out nothing said what they represented. Added a "Muscle emphasis" heading above the list, and a "Muscles worked" mini heatmap above that: two small `createBodyHighlighter` instances, painted from `exercise.bias` rolled up through `MUSCLE_TO_REGIONS` (the same table `heat.js` uses for the real heatmap) — no logs, no recency, no normalization against other exercises, since this is static per-exercise data, not training history. Uses the exact same 40-step gradient the main Heatmap paints with, so a given shade means the same thing in both places.

**Reuse over duplication:** rather than a second copy of body-highlighter's setup logic, `js/heatmap.js` gained two exports — `getThermalGradient()` (bundles `readThermalColors()` + `buildGradient()` into what a second consumer needs: `bodyColor`, `highlightedColors`, and a precomputed `bodyColorRgbString` for the zoom logic below) and `buildLibraryData(regionValues)` (the "turn a 0-1 value into N synthetic frequency entries" loop, extracted out of `paintHeatmap()`, which now calls it too — pure refactor there, verified the main Heatmap's own colours were unaffected).

**"Zoomed in":** body-highlighter has a fixed anatomical viewBox with no built-in zoom. `js/exercises.js`'s `zoomToHighlighted()` runs after every `.update()`: finds polygons whose fill isn't still `bodyColorRgbString` (the browser normalizes inline hex fills to `rgb(...)` on readback — same fact already relied on during the gradient work), unions their `getBBox()` rects with ~30% padding, and sets that as the SVG's own `viewBox`. Works for any exercise generically rather than a fixed zoom level or hardcoded per-muscle regions — verified live: Barbell Curl crops tight to just the arm, Barbell Back Squat (which spans both views) crops each figure to its own leg/hip region. A view with nothing coloured (most exercises only touch one side — confirmed live with Deadlift, back-view only) gets `.hidden` rather than showing an empty grey silhouette.

One correctness detail worth recording: `getBBox()` on an SVG inside a `display:none` ancestor returns a zero rect, so `openSheet()` has to apply `sheet.classList.add('open')` *before* calling the mini-heatmap paint/zoom function, not after.

**Label styling reuse:** both new headings use `.section-heading` (introduced for the Log/Exercises merge's session section) rather than new CSS — but that class baked in horizontal padding tuned for its original unpadded container, which would have double-indented it inside `.sheet` (already uniformly padded). Moved the horizontal inset into a `.session-section .section-heading` override scoped to the original use case, leaving the base class padding-free so it drops cleanly into any already-padded container.

### Add a female body model option — RESOLVED 2026-07-14
**Decision:** Ryan has family friends who wanted a female body model. Confirmed by reading its actual source that `body-highlighter` has no way to supply one — the anterior/posterior geometry is two hardcoded constant arrays baked into the bundle, and no public option (`type`, `bodyColor`, `highlightedColors`, etc.) exposes a way to swap in different geometry. Searched for an off-the-shelf replacement combining real male/female support with this app's no-build-step, CDN-importable architecture — nothing fit (`body-muscles` has the right architecture but only one body; `react-muscle-highlighter`/`react-native-body-highlighter` have real male/female data but are React/React Native, unusable here directly). Landed on: fork `body-highlighter` (vendor a modified copy locally, no more CDN import) and adapt the female anatomical path data out of `TeamBuildr/react-native-body-highlighter`'s `assets/bodyFemaleFront.ts`/`bodyFemaleBack.ts` (MIT), which is genuinely just framework-independent `{ slug, pathArray }` data underneath its React Native wrapper.

**The fork — reimplemented, not hand-patched.** `js/vendor/body-highlighter.js` is a from-scratch, readable reimplementation of the original's behaviour (frequency-based colouring, click handling, `update()`/`destroy()` lifecycle — all unchanged) rather than edits applied to the minified CDN bundle, since patching obfuscated single-letter variable names would have produced unmaintainable code. The male geometry (`MALE_ANTERIOR`/`MALE_POSTERIOR`) was extracted verbatim from the original bundle to guarantee zero behaviour change for the existing model — confirmed live side-by-side against the female render, pixel-identical to before. Two real additions: a `gender: 'male' | 'female'` option (default `'male'`), and `<path d="...">` element support alongside the original's `<polygon points="...">`-only rendering, since the female source data is curved paths, not straight-line points. The original's natural-language alias-normalization table (`"Pectoralis Major"` → `chest`, etc.) was dropped entirely in the fork — this app only ever calls it with already-canonical region ids (`js/muscle-taxonomy.js` does that translation upstream), so porting that table would have been dead weight.

**Data extraction.** `js/vendor/body-highlighter-female-data.js` — `bodyFemaleFront.ts`/`bodyFemaleBack.ts` with the two TypeScript-only lines stripped (a type import, a type annotation; everything else was already valid JS), region ids renamed to match `muscle-taxonomy.js`'s vocabulary (`deltoids` → `front-deltoids`/`back-deltoids` per file, `adductors` → `adductor`), and cosmetic/unused regions (`hair`, `hands`, `feet`, `ankles`, `knees`, `head`, `tibialis`) dropped. No Node or Python available on this machine to script the extraction — done with `sed`/`awk` text processing instead, since the actual transform needed (see below) turned out to be a pure SVG group transform, not per-coordinate rewriting, so no numeric scripting was needed at all.

**Coordinate system.** body-highlighter's viewBox is a fixed `"0 0 100 200"`. The TeamBuildr source uses a completely different convention: one shared coordinate plane split into front/back halves via viewBox windowing (male front `"0 0 724 1448"`, back `"724 0 724 1448"`; female front `"-50 -40 734 1538"`, back `"756 0 774 1448"` — confirmed live that a female back-view path's raw coordinates started at x=1096, squarely inside that offset range). Rather than rewriting every path's coordinate numbers, each female view's shapes are wrapped in one `<g transform="translate(...) scale(...)">` per render, computed from comparing that view's own source viewbox against the target box (`femaleViewTransform()` in the vendored file). Male's own plane happens to scale by an exact uniform 7.24 on both axes (724/100 = 1448/200); female's is close but not identical (~7.34 horizontal vs. ~7.69 vertical) — a small non-uniform stretch, confirmed visually negligible after rendering (see verification below).

**Bug found and fixed while wiring this in:** `js/exercises.js`'s `zoomToHighlighted()` (the mini per-exercise heatmap's "crop to what's coloured" logic, from the previous entry) only ever queried `<polygon>` elements and read `getBBox()` directly — both wrong for female. It now queries `polygon, path`, and each shape's bounding box is transformed through `getCTM()` (the matrix from the shape's own local space into the SVG's user space, accounting for every ancestor transform in between) rather than plain `getBBox()`, which returns a box in the shape's *local* space — for female paths sitting inside the transformed `<g>`, that local space is still the raw untransformed source coordinates (hundreds of units), not the ~100×200 target box. For the male model, which has no wrapping transform, the CTM is effectively the identity, so this one code path produces identical results to before for male and correct results for female.

**Where the toggle lives and how it persists.** A `.toggle-pill`/`.toggle-option` pair (the exact existing component — same classes History's List/Calendar toggle uses), originally placed in the Heatmap screen's topbar since a dedicated Settings screen didn't exist yet — moved there once it did, see "Settings screen" below. Persists via `js/data.js`'s `loadBodyModel()`/`saveBodyModel()` (new `heatmap_body_model` key, same shape as `loadLogs`/`saveLogs`), read once in `app.js` at bootstrap and passed to both `initHeatmap()` and `initExercises()` so the main Heatmap and the exercise detail sheet's mini heatmap always agree. The toggle's click listeners are wired only after both modules' `init` calls resolve (not immediately at module load) — clicking during the brief `exercises.json` fetch window would otherwise call `setGender()`/`setMiniHeatmapGender()` while the highlighter instances are still `null`.

**Known, accepted gap:** the source female dataset is coarser than male's — no left/right split, no abductor/adductor distinction (one combined `adductor` region), no soleus left/right split. Regions this app already paints that don't exist in the female geometry (`abductors`, `left-soleus`, `right-soleus`) simply don't highlight under the female model — the same "no geometry for that id in this view" case the library already handles gracefully today (e.g. biceps has no posterior region). Confirmed live: clicking through every region on the female model opened the quick-log sheet correctly with no errors.

**Verified live (2026-07-14):** standalone render of both female views before any UI was wired, side-by-side against the male model — anatomically correct, no distortion from the non-uniform scale, comfortably within the target viewBox. Logged a workout, toggled male ↔ female — same heat data, correct colours on both (confirmed pixel-exact against the known `--color-heat-max` token), confirmed the main Heatmap's `buildLibraryData()` refactor didn't change male's own rendering. Exercise detail sheet's mini heatmap respects the toggle, including a live re-paint if changed while a sheet is already open. Reloaded — preference persisted. Mobile viewport (375px) — toggle fits cleanly in the topbar, no overflow.

**Attribution:** `body-highlighter` (MIT) © lahaxearnaud; female geometry adapted from `TeamBuildr/react-native-body-highlighter` (MIT), itself descended from HichamELBSI/react-native-body-highlighter. Both licenses retained in the vendored files' header comments.

### Settings screen — RESOLVED 2026-07-15
**Decision:** Added a 4th bottom-nav tab, "Settings" — Ryan wants a dedicated place to personalise the app, starting with the body-model toggle (previously sitting in the Heatmap topbar, a slightly odd home for a preference that also affects the exercise detail sheet) and room to grow into kg/lbs units and light/dark theme. Scoped down from the full request: this pass builds the screen and moves the one preference that already exists; kg/lbs and theme are each genuinely separate features (unit conversion touches how weight is entered/stored/displayed everywhere; light mode needs a full parallel colour palette designed from scratch — it's been sitting in "Not yet built" since the "Design direction" decision below first mentioned it), so they show as inert "Coming soon" rows rather than being half-built now.

**Moving, not duplicating, the toggle.** `app.js` already queried the toggle-pill via a bare `document.querySelector('[data-toggle="body-model"]')`, not scoped to `#screen-heatmap` — so relocating the markup into the new `#screen-settings` in `index.html` was a pure cut-paste, zero changes needed to the existing `setGender`/`setMiniHeatmapGender`/`saveBodyModel` wiring. Confirmed live: toggling from the new location still repaints both the main Heatmap and the exercise detail sheet's mini heatmap correctly.

**Layout.** A small `.settings-row` list (new, minimal CSS — bordered-bottom rows, label left/control right, same row convention as `.history-entry` but a different internal layout since these need label+control rather than a single block of text). The two placeholder rows use `.callout-meta`'s existing muted-text styling for "Coming soon" rather than introducing a new label style, and are plain non-interactive text — no dead click handlers or disabled-button styling for features that don't exist yet.

### kg/lbs unit preference — RESOLVED 2026-07-16
**Decision:** Turned the Settings screen's "Units" row from an inert placeholder into a working kg/lbs toggle. Ryan confirmed weight doesn't feed into any calculation — `heat.js`'s `setHeat = reps × (rpe / 10)` never reads it — so this is purely a display/entry-boundary conversion, not a data-model change. Canonical storage stays kg everywhere (`docs/data-model.md`'s existing "weight — stored in kg" note is unchanged); a chosen unit only converts at the edges. Two pure functions in `js/utils.js`, `convertKgToUnit(kg, unit)`/`convertUnitToKg(value, unit)`, do the conversion: kg is the identity in both directions (a value entered in kg round-trips exactly, unrounded), lbs only rounds for *display* (nearest 0.5 lb, matching plate increments) — the stored kg value stays full-precision regardless of which unit it was entered in, so toggling units back and forth never degrades already-logged data (verified live: a set entered as 225 lbs displays as `102.05828325 kg` when switched to kg — correct full-precision round-trip, not a bug).

**Where unit state lives.** Same pattern as the body-model toggle: `js/data.js` gained `loadUnit()`/`saveUnit()` (new `heatmap_weight_unit` key, defaults `'kg'`). `app.js` reads it once at bootstrap and passes it into both `initLog()` and `initHistory()`, and wires the Settings toggle's click to `saveUnit()` plus each module's own `setUnit()` export — mirroring `setGender`/`setMiniHeatmapGender` exactly, including waiting until after both modules are wired to attach the toggle's click listener.

**Touch points.** `js/log.js`'s active-session weight input placeholder shows the current unit; adding or editing a set runs the typed value through `convertUnitToKg()` before storing, and the display/edit-prefill both run stored kg through `convertKgToUnit()`. `setUnit()` there re-renders the session immediately so an in-progress session's numbers update live when the toggle is changed mid-session (same live-repaint precedent as the gender toggle). `js/utils.js`'s shared `formatSetRow()` (History's read-only log detail sheet) gained a third `unit` parameter; `js/history.js` tracks its own `currentUnit` + `setUnit()`.

**Scope boundary, accepted:** if the Units toggle is changed while History's log detail sheet happens to already be open, it won't retroactively re-render — closing and reopening picks up the new unit. Same "one-way sync while a specific sheet is open" tradeoff already accepted for the exercise detail sheet elsewhere in the app; not worth extra plumbing for this one narrow case.

**Verified live (2026-07-16):** logged a set at 100 kg, toggled to lbs — displayed 220.5 lbs (input placeholder also switched to "lbs"), edit-mode pre-fill showed the same converted value. Added a second set at 225 lbs, switched back to kg — first set round-tripped to exactly 100 kg, second displayed at full precision. Finished the session and opened it from History in both unit modes — both showed the correct converted values. A bodyweight exercise (Push-Up) still shows no weight input or field either way. No console errors, mobile viewport (375px).

### Light mode — RESOLVED 2026-07-16
**Decision:** Built the last remaining Settings placeholder — a real dark/light theme toggle, per `docs/ui-notes.md`'s "Theme" note ("light mode toggle available, not a system-follow"). `css/tokens.css`'s `:root` keeps today's values as the dark/default palette; a new `:root[data-theme="light"]` block overrides only `--color-bg`/`--color-surface`/`--color-surface-raised`/`--color-border`/`--color-text`/`--color-text-muted`/`--color-heat-cold`. Thermal warm/hot/max, accent, accent-text, accent-shadow, accent-ring, and danger-shadow are **left identical between themes** — they're saturated brand/status colours that already read fine against both a dark and a light background, so "orange = accent"/"red = max heat" mean the same thing regardless of theme; only backgrounds/surfaces/borders/text actually flip. `--color-heat-cold` initially tracked `--color-surface-raised` in the light block too, the same convention the dark palette already uses — revised same-day, see "Light mode contrast fix" below, once it turned out that pairing made the light-mode silhouette nearly invisible. `docs/ui-notes.md`'s palette table gained a Light column alongside the existing Dark one.

**Persistence and wiring** — identical shape to the body-model and weight-unit toggles: `js/data.js` gained `loadTheme()`/`saveTheme()` (`heatmap_theme` key, defaults `'dark'`), and the Settings screen's Theme row became a real `.toggle-pill`. `app.js` applies the theme via a small `applyTheme(theme)` helper (sets/removes `documentElement.dataset.theme`, and also updates `<meta name="theme-color">`'s `content` to the current `--color-bg` so the browser's own address-bar tint tracks the in-app theme). `manifest.json`'s own `theme_color`/`background_color` stay fixed on the dark values — those only govern the installed PWA's splash screen before any JS has run, and making that per-user would need a dynamic manifest; accepted as a known, cosmetic-only, first-launch-only limitation rather than solved here.

**Avoiding a flash of dark-then-light on load.** Unlike the gender/unit toggles — which only affect elements that already render acceptably either way — a theme swap changes the colour of literally every pixel, and `app.js` is a deferred module that only runs after the DOM is parsed. Without intervention, a light-mode user would see a flash of the dark palette on every load. Fixed with a small inline `<script>` in `index.html`'s `<head>` (right after the stylesheet `<link>`s) that synchronously reads `localStorage.getItem('heatmap_theme')` and sets `documentElement.dataset.theme` before first paint, ahead of any deferred module. This necessarily duplicates `js/data.js`'s `THEME_KEY` (`'heatmap_theme'`) as a literal string — the inline script has to run before any module loads, so it can't import the constant — with a comment on both sides pointing at the other so the two don't drift silently if the key is ever renamed.

**Making the already-rendered heatmap repaint live, not just future paints.** `js/heatmap.js`'s `readThermalColors()` already reads CSS custom properties fresh via `getComputedStyle()` on every call, so anything painted *after* the toggle already gets the right colours for free. The gap: body-highlighter's two instances (main heatmap) have colours baked into already-rendered SVG shapes from their last `update()` call — flipping the CSS variable alone doesn't retroactively repaint them. Confirmed by reading the vendored `js/vendor/body-highlighter.js`'s `update()`: it accepts `bodyColor`/`highlightedColors` as partial fields and re-renders from full current state, leaving `data`/`gender` untouched — exactly the tool needed. `js/heatmap.js` gained an exported `setTheme()` that re-reads `getThermalGradient()` and pushes the new `bodyColor`/`highlightedColors` onto both highlighters (no `paintHeatmap()` re-run needed, since the underlying heat data hasn't changed). `js/exercises.js` gained the equivalent for the mini per-exercise heatmap, with one extra step: `bodyColorRgbString` (cached at `initExercises()` time, and read by `zoomToHighlighted()` to tell "still untrained" shapes from "trained" ones) has to be refreshed too, since the actual rendered bodyColor just changed. If a sheet is open when the toggle fires, `setTheme()` re-runs `paintMiniHeatmap()` so the crop reflects the new colours immediately — same "live if open" precedent `setMiniHeatmapGender()` already established.

**Accepted, not addressed this pass:** the `:active`/`:hover` `filter: brightness(...)` states used throughout `styles.css` (darken-on-press, lighten-on-hover) weren't re-tuned per theme — they multiply whatever the current surface colour already is, so they still produce a visible, directionally-correct cue in both themes, just a more subtle one against a near-white light surface than against a dark one. Not worth a per-theme filter value for a still-functional, if slightly softer, hover/press cue.

**Verified live (2026-07-16):** toggled Settings → Theme to Light — background/surface/border/text flipped correctly across Heatmap, Exercises (incl. active session), History (list/calendar), and Settings itself; confirmed via computed styles that the main heatmap's untrained-region fill changed from `rgb(44, 44, 42)` (dark) to `rgb(239, 237, 230)` (light) while trained-region colours (e.g. `rgb(226, 75, 74)`, the max token) stayed identical. Opened the exercise detail sheet's mini heatmap, then toggled back to dark *while the sheet stayed open* — confirmed it recoloured live (fill flipped back to the dark token) and the crop `viewBox` stayed a sane non-degenerate rect, not reset to the full silhouette. Simulated a fresh load with `light` already in `localStorage` (`navigate` to the same URL) — `data-theme="light"` and the toggle-pill's active state were both already correct on the very first read after load, confirming the anti-flash inline script does its job. `<meta name="theme-color">` tracked `--color-bg` on both toggles. No console errors, mobile viewport (375px).

#### Light mode contrast fix — RESOLVED 2026-07-16 (same day)
**Decision:** Ryan flagged, right after the above landed, that light mode's untrained-muscle silhouette was nearly invisible — `--color-heat-cold` was `#EFEDE6` against a `#FFFFFF` heatmap surface (~1.1:1 contrast), inheriting the dark palette's "cold matches Surface raised so untrained muscles blend into the UI" convention, which doesn't survive the jump to a near-white surface. Asked Ryan whether to fix this in light mode only or adopt a consistent blue "cold" colour in both themes; he chose **light mode only** — dark mode's existing look hadn't been flagged as a problem, so it's left untouched.

Light mode's `--color-heat-cold` changed from `#EFEDE6` to `#7C93B0` (a slate blue), and is **no longer tied to `--color-surface-raised`** in the light block — that pairing was specifically what caused the invisibility. Chose blue deliberately rather than just a darker grey: it still reads as "cold"/calm rather than an alert colour (consistent with the app's cold=calm/hot=alert thermal language), gives a real ~3:1 contrast against the white surface, and is arguably a more literal thermal-camera read (blue → amber → orange → red) than dark mode's "blend into the UI" approach. Dark mode's `--color-heat-cold` is unchanged, still tracking `--color-surface-raised`.

**Verified live (2026-07-16):** screenshotted the Heatmap screen and the exercise detail sheet's mini heatmap in light mode — the slate-blue silhouette is clearly visible against the white heatmap area on both, and doesn't compete with or get confused for the amber/orange/red trained-region colours layered on top of it. No console errors.

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
- Bottom tab bar, 4 tabs: Heatmap, Exercises, History, Settings (a "Log" tab existed briefly then was merged into Exercises — see "Merge Log into Exercises" — before Settings was added as the 4th)

### Bottom nav icons — RESOLVED 2026-07-12
**Decision:** Added a Tabler outline icon above each nav label — flame (Heatmap, matching the thermal colour language already used for heat), clipboard-list (Log), barbell (Exercises), history (History). Icons sit *alongside* the existing text labels, not replacing them — Ryan was explicit that both should stay, unlike the "replacing the current text labels" framing the roadmap backlog item had used. Icons are Tabler's real SVGs (MIT licensed), inlined directly as raw `<svg>` markup in `index.html` rather than pulled from a CDN or icon font — only 4 are needed, so embedding them costs nothing and keeps the nav working without a network request, unlike `body-highlighter`'s CDN import (which has to be a CDN import, since it's a whole rendering library, not 4 static icons). Each icon uses `stroke="currentColor"`, so it automatically tracks `.nav-item`'s own text colour (muted vs. accent when `.active`) with zero extra CSS — no separate active-icon-colour rule needed.

**Reasoning for taller nav:** icon + label needs more vertical room than a label alone — `.nav-item` grew from ~30px to ~77px tall (padding bumped from `--space-sm` all round to `--space-md`/`--space-sm`, gap from a hardcoded `2px` to `--space-xs`). `.screens`' `padding-bottom` (which exists purely to keep scrollable content from sitting under the fixed nav) was bumped from 80px to 100px to match, checked live against the Heatmap screen's CTA button to confirm no overlap.

### Real app icon — RESOLVED 2026-07-13
**Decision:** Replaced the placeholder `assets/icon.svg` (a bootstrap-era generated silhouette) with the real icon Ryan supplied (`assets/app_icon.png`, 1254×1254 — the same heated-chest/thermal visual language as the rest of the app). Since manifest icon guidance expects accurate `sizes` per file rather than one oversized image, generated `icon-192.png` and `icon-512.png` (manifest.json's two icon entries, both `purpose: "any"`) plus `icon-180.png` (the size iOS specifically expects for `apple-touch-icon`) from the source via .NET's `System.Drawing` in a one-off PowerShell script — no image-processing package needed for a one-time resize, consistent with this project's "no build step, no npm install" stance elsewhere. Also cut the 512px version's file size from the source's 1.4MB down to ~324KB in the process.

Added `<link rel="apple-touch-icon">` alongside the existing favicon `<link>` — iOS Safari's "Add to Home Screen" reads that tag specifically rather than the manifest's `icons` array (which is what Android/Chrome uses), so without it the homescreen icon would silently fall back to a screenshot of the page instead of this icon. The original full-res PNG is kept as `assets/app_icon.png` (source of truth, not referenced directly anywhere) rather than deleted, in case a size needs regenerating later. `assets/icon.svg` was deleted outright rather than moved to `assets/legacy/` — that folder is for superseded assets kept as reference (the old hand-drawn body SVGs, still structurally interesting); the placeholder icon has no such value now that a real one exists.

### Atlas wordmark header — RESOLVED 2026-07-17
**Decision:** Ryan supplied a stylised "Atlas" wordmark (`assets/Atlas Logo.png`) to use as the app's title/header. Asked where it should appear — every screen's topbar (replacing the plain "Heatmap"/"Exercises"/"History"/"Settings" text) vs. just the Heatmap home screen — Ryan chose **every screen**, trading the per-screen text cue for a consistent brand mark on every topbar; the bottom nav's own active-state label still tells you which screen you're on.

**Processing the source asset.** The supplied PNG was a solid near-black rectangle (`RGB(6,6,12)`, fully opaque, 1774×887) with the wordmark sitting in a small fraction of the canvas — unusable as-is on a themeable app: it'd show as a literal black box on the light theme, and wouldn't quite match `--color-bg` even in dark mode. Processed via a one-off PowerShell + `System.Drawing` script (same no-Node/no-Python tool this project already used for icon generation, see "Real app icon" above): chroma-keyed the near-black backdrop to transparency using `LockBits` for raw pixel access (fast enough for 1.5M pixels; `GetPixel`/`SetPixel` would have been far too slow), de-haloed the edges by un-premultiplying each partially-transparent pixel's colour against the sampled black background (avoids a dark fringe around the letterforms when composited onto a light surface), then cropped to the artwork's own bounding box — 1774×887 down to a tight 1444×338.

**Two variants for two themes.** The wordmark itself is white/chrome, invisible against the light theme's near-white surface. A second pass recolours only the *achromatic* pixels (low saturation — the white/grey wordmark and its chrome-style shading) to a flat dark fill for `atlas-logo-light.png`, leaving the orange-to-red triangle/pulse-line accent completely untouched in both files — the same "accent stays constant across themes, only text/background flips" convention `tokens.css` already uses for `--color-heat-cold` vs. `--color-heat-warm/hot/max`. Flattening the wordmark's chrome shading to one flat colour (rather than trying to preserve the gradient) also happens to match this app's own stated design language — "Flat, clean — no gradients" — better than the source art's chrome effect would have anyway, and doesn't read at header size regardless.

**Wiring — pure CSS, no JS.** `.topbar-logo` is a `<span role="img" aria-label="Atlas — {Screen}">` inside each screen's existing `<h1>`, not an `<img src>` — its `background-image` is set in the base rule and overridden under `[data-theme="light"] .topbar-logo`, so the theme swap needs zero JavaScript, consistent with every other per-theme visual difference in this app living entirely in `tokens.css`/`styles.css`. Sized via CSS `aspect-ratio: 1444 / 338` off the cropped asset's own dimensions rather than a hand-guessed pixel width, so it can't silently drift out of proportion if the source is ever re-exported at a different size. `role="img"` + a distinct `aria-label` per screen ("Atlas — Heatmap", "Atlas — Exercises", ...) preserves the "which screen am I on" cue for screen-reader users that sighted users now only get from the bottom nav.

**Verified live (2026-07-17):** confirmed via computed styles and network requests (not a visual screenshot — the preview tool's screenshot capture was unavailable this session) that all 4 screens' `.topbar-logo` resolve to `atlas-logo.png` (200 OK) by default, the element renders at the exact aspect-ratio-derived size (94×22 for a 22px height), and toggling Settings → Theme → Light swaps every topbar's `background-image` to `atlas-logo-light.png` live with no JS changes needed. Cross-checked the processed PNGs directly (both variants) before wiring them in — clean transparent knockout, no dark halo at the letterform edges, accent colours untouched in the light variant.

**Follow-up bug, caught by Ryan (2026-07-17, same day):** the logo sat visibly lower on the History screen than on the other three. Root cause: `.topbar` sizes itself to its own content, and History's 3-option toggle-pill (List/Calendar/Weight, 34px tall) is taller than the logo's own line box (27px, from the `<h1>`'s font-size/line-height even though the image itself is only 22px) — so that one topbar rendered ~7px taller than the rest, and `align-items: center` centered the logo within that taller row instead of the shorter one everywhere else. Fixed with a `min-height: 68px` on `.topbar` itself, comfortably covering the tallest realistic topbar-actions content, so every screen's row is now the exact same height regardless of what else sits in it. Verified live: all 4 topbars now measure identically (68px tall, logo at the same top/left offset and the same 94×22 size) at mobile width.

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
4. **Settings** — app-wide preferences (body model today; units and theme are placeholder rows for future passes) — see "Settings screen"

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

## Profile

### Profile: name, gender, weight check-ins + trend — RESOLVED 2026-07-16
**Decision:** Ryan wanted a personalization layer: a name (for a home-screen greeting), a gender (driving body model), and a weight he can check in with over time to see a trend. Four scoping questions were asked up front and answered before building:

1. **Gender replaces the standalone Body model toggle, rather than sitting alongside it.** The Settings screen's old `[data-toggle="body-model"]` row is gone entirely — the Profile sheet's own gender toggle is now the single source of truth for which body model paints the Heatmap screen and the exercise detail sheet's mini heatmap. One setting, not two.
2. **Name/Gender/Weight live in a Profile sheet**, opened from a summary row on Settings (showing the saved name, or "Set up your profile" until one's set) — the same bottom-sheet pattern already used for exercise/log detail, rather than three more inline Settings rows.
3. **Weight check-ins are manual only** — no reminder/nudge logic. Simplest version; can revisit if it turns out people forget to check in.
4. **The weight trend lives on the History screen**, as a third toggle-pill option (List/Calendar/**Weight**) — grouped with the app's other "data over time" views rather than living on the Heatmap screen (which stays focused on training) or buried inside the Profile sheet itself.

**Data model.** `js/data.js` gained `loadProfile()`/`saveProfile()` (`heatmap_profile` key, `{ name, gender }`) and `loadWeightEntries()`/`saveWeightEntries()`/`addWeightEntry()` (`heatmap_weight_entries` key, an array of `{ id, date, weight }`, weight always in kg — same canonical-storage convention as workout set weights). `addWeightEntry()` overwrites same-date entries rather than duplicating them — a second same-day check-in reads as "let me correct this," not a genuinely separate data point. `loadBodyModel()`/`saveBodyModel()` are gone, folded into profile; `loadProfile()` self-heals anyone still on the old standalone `heatmap_body_model` key by migrating its value into `profile.gender` the first time it's read post-update — same precedent as `loadLogs()`'s id-backfill (see "View + delete a logged workout" above) — so nobody who'd already picked a body model loses that preference.

**New module, `js/profile.js`, owns the sheet end-to-end** — queries its own trigger (the Settings row) and its own sheet DOM, same as `exercises.js`/`history.js` own their sheets, even though the row and the sheet live in different `<section>`s of `index.html` (a module queries whatever selectors it needs regardless of which screen they're nested under — an established precedent, e.g. `log.js` already queries `#finish-session-btn` which lives inside `#screen-exercises`). Name and gender save instantly on change (blur/Enter for the name field, click for the gender toggle) — no separate Save button, matching every other Settings toggle's existing behaviour. Weight is deliberately a distinct "Log weight" action rather than just another field that autosaves — each click is a dated check-in (`addWeightEntry()`), not an edited setting.

**Greeting, `js/heatmap.js`.** New exported `refreshGreeting()`: a time-of-day phrase (`<12` morning, `<18` afternoon, else evening — local time, consistent with this app's existing local-date convention) plus `, {name}` if one's set, written into a new `.greeting` line on the Heatmap screen between the topbar and the callout cards. Reads `loadProfile()` directly rather than taking a param — same self-contained data-access convention `loadLogs()` already uses throughout this app. Called once inside `initHeatmap()` and again whenever the name changes.

**Weight trend, `js/history.js`.** A hand-rolled SVG line chart — no charting library, consistent with this app's no-build-step/no-external-deps stance (same spirit as `js/heatmap.js`'s own `buildGradient()`). Fixed viewBox, points min/max-scaled to fit, a `<polyline>` connecting them plus a `<circle>` per point, muted axis text for the weight range and date range. Below 2 entries there's nothing to draw a line between, so those get an `.empty-state` message instead (a distinct one for 0 vs. 1 entry, so the copy tells you exactly what's missing). The existing toggle-click handler was refactored into a shared `setActiveView(view)` so a new exported `selectHistoryView()` — used by the Profile sheet's "View trend →" link — shares the exact same code path rather than duplicating the view-switching logic. `setUnit()` and `refreshHistory()` both re-render the trend if the Weight tab is currently active, so a unit toggle or a fresh weight check-in updates it live.

**`js/utils.js` gained `formatDate()`**, pulled out of `history.js` (previously local/unexported there) once `profile.js` needed the exact same short date format for its "Current weight" readout, and `history.js`'s own new trend chart needed it again for axis labels — the trigger for promoting a single-module helper into a shared one, per this file's usual `js/utils.js` "duplicated in more than one place" bar.

**`app.js` wiring** removed the standalone body-model toggle block (query, active-state sync, click handler) entirely, replaced by `initProfile({ unit, onProfileChanged, onViewTrend })`. `onProfileChanged` fires after any name/gender edit *or* weight check-in (weight logging reuses the same callback, even though nothing in the `profile` object itself changed, since it's the same "something you can see elsewhere just changed" signal — the one thing that actually needs it, `refreshHistory()`, only meaningfully does something if the Weight tab happens to be open) and re-runs `setGender()`/`setMiniHeatmapGender()`/`refreshGreeting()`/`refreshHistory()`. `onViewTrend` composes `switchTab('history')` + `selectHistoryView('weight')` — kept in `app.js` rather than `profile.js` importing `history.js` directly, preserving the existing rule that `app.js` is the only file that knows about every other module.

**Verified live (2026-07-16):** opened the Profile sheet with no data set — empty name, Male active, "No weight logged yet." Set a name, blurred — Settings row's summary updated and the Heatmap screen's greeting picked it up immediately. Toggled gender to Female — main heatmap repainted with the female geometry's `<g transform>` wrapper present (confirming the model actually switched, not just the button state), confirmed the old standalone Body model row is genuinely gone from Settings. Logged a weight, confirmed the readout and its kg/lbs conversion; logged again the same day — `localStorage`'s weight-entries array stayed at length 1 (overwrite, not duplicate). Seeded three dated entries, opened History → Weight — the chart rendered 3 correctly-scaled points with sensible min/max/date labels, and re-rendered live (fresh values, same points) on a kg/lbs toggle. "View trend →" from the sheet landed on History with the Weight tab already selected. Simulated a pre-Profile user (`heatmap_body_model: 'female'`, no `heatmap_profile` key) and reloaded — confirmed the migration correctly seeded `profile.gender` from the legacy value. Reloaded again with real data — name, gender, and weight entries all persisted. No console errors, mobile viewport (375px).

**Greeting made prominent, 2026-07-17:** Ryan flagged the greeting as too small/low-contrast once the Atlas wordmark replaced the Heatmap screen's text title (see "Atlas wordmark header" above) — with no page headline left, the greeting is effectively the closest thing that screen has to one now, but it was still styled at `--font-size-body` (14px) in `--color-text-muted`, sized for a quiet secondary line, not a headline. `css/tokens.css` gained `--font-size-hero` (1.5rem/24px, the single largest text size in the app); `.greeting` switched to it plus `--font-weight-heading` and full-contrast `--color-text`. Verified live in both themes via computed styles and a screenshot — clearly the most prominent text on the Heatmap screen now, full contrast against the surface in dark and light alike. Bumped to true bold immediately after (new `--font-weight-bold: 700` token — distinct from every other weight in the app, which tops out at `--font-weight-heading`'s 500) once Ryan asked for it explicitly.

---

## Open questions / revisit later
- Heat formula weighting — may need adjustment once tested with real data
- Recency window — open to revisiting 10 days vs 7 days post-MVP
