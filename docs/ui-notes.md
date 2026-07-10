# Muscle heatmap app — UI notes

Reference file for design decisions, screen inventory, and layout notes.

---

## Design language

### Theme
- Dark mode primary
- Light mode toggle available (not a system-follow, a deliberate user choice)
- Flat, clean — no gradients, no heavy shadows

### Colour palette
| Role | Value | Usage |
|---|---|---|
| Background | `#111110` | App background |
| Surface | `#1a1a18` | Cards, heatmap area |
| Surface raised | `#2c2c2a` | Pills, toggles, inactive elements |
| Border | `#3a3835` | Subtle borders |
| Text primary | `#f0efe8` | Headings, primary labels |
| Text muted | `#888780` | Secondary labels, metadata |
| Thermal cold | `#2c2c2a` | Untrained muscle groups |
| Thermal warm | `#BA7517` | Lightly trained |
| Thermal hot | `#EF9F27` | Moderately trained |
| Thermal max | `#E24B4A` | Heavily trained |
| Accent / CTA | `#EF9F27` | Primary buttons, active nav |

### Typography
- Font: system sans-serif for MVP
- Heading: 18px / weight 500
- Body: 14px / weight 400
- Label/meta: 11–12px / weight 400, muted colour
- Uppercase tracking used sparingly for category labels only

---

## Navigation
- Bottom tab bar, 4 tabs
- Tab order: Heatmap · Log · Exercises · History
- Active tab uses accent colour (`#EF9F27`)
- Icons: Tabler outline icon set

| Tab | Icon | Screen |
|---|---|---|
| Heatmap | `ti-flame` | Home / heatmap view |
| Log | `ti-plus-circle` | Log workout |
| Exercises | `ti-list-search` | Exercise library |
| History | `ti-calendar-stats` | 30-day history |

---

## Screens

### 1. Heatmap (home)
**Purpose:** Hero screen. Answers "what do I need to work on?"

**Layout (top to bottom):**
- Status bar
- Top bar: "Heatmap" title (no toggle — see decisions.md "Heatmap toggle removed")
- Callout cards row (2 cards side by side):
  - "Needs work" — coldest muscle + days since trained
  - "Most trained" — hottest muscle + session count
- Heatmap area: front + back body SVG, side by side
- "+ Log workout" primary CTA button (amber)
- Training balance card — two-segment bar comparing a muscle pairing (push/pull, upper/lower, or an antagonist pair like front vs. rear delt) + one-line insight — see decisions.md
- Bottom nav

**Interactions:**
- Tap a muscle region → navigate to Exercise library filtered to that muscle
- Tap "+ Log workout" → navigate to Log screen

**Design note:** Proactive assistant feel — callout cards and the training balance card surface insights so the user doesn't have to interpret the heatmap themselves. The balance card always shows whichever pairing is currently most skewed, rather than a static set of metrics.

---

### 2. Log workout
**Purpose:** Capture today's session. Answers "what did I do?"

**Entry point:** Blank session — see decisions.md. No heatmap-informed suggestions for MVP.

**Layout (top to bottom):**
- Topbar: "Log workout" title + "Finish" text action (top right)
- Session list — one card per added exercise:
  - Header row: exercise name + muscle/category tag, remove (✕) button
  - Set rows: index, reps, weight, RPE — one row per logged set
  - "+ Add set" row at the bottom of the card
- "+ Add exercise" primary CTA, sticky at the bottom of the screen
- Empty state (no exercises added yet) shown before the first exercise is added

**Key interactions:**
- Add exercises one by one (search or browse)
- Per exercise: log sets with reps, weight, RPE slider
- RPE presented as "how hard was that set?" (1–10)
- Session auto-saves as user logs
- On completion → heatmap updates

---

### 3. Exercise library
**Purpose:** Browse and discover exercises. Also the landing screen when tapping a cold muscle on the heatmap.

**Layout (top to bottom):**
- Topbar: "Exercises" title
- Search input + horizontally-scrolling filter pills (by muscle group)
- Exercise list — each row: name, muscle + equipment meta line, chevron

**Detail interaction:** Tapping a list item opens a bottom sheet (see decisions.md — "Exercise detail interaction") with:
- Exercise name + category/equipment subtitle
- Primary/secondary muscle tags (text list — no mini body-map here; the sheet always reads `muscles.simple`, see decisions.md "Exercise detail sheet muscle breakdown")
- Instructions placeholder (real copy TBD once the exercise database has it)
- "Add to session" CTA

**Key interactions:**
- Search by name
- Filter by muscle group (inherits selection if arriving from heatmap tap)
- Tap exercise → opens detail sheet → "Add to session"

---

### 4. History
**Purpose:** 30-day training overview. Answers "am I balanced over time?"

**Layout:**
- Topbar: "History" title + List/Calendar toggle pill (`.toggle-pill`/`.toggle-option`, shared CSS component)
- **List view** (default): reverse-chronological entries, each showing date + session summary (e.g. "Pull day · 3 exercises")
- **Calendar view**: month grid with a prev/next header; trained days marked with a dot/tint, today outlined

**Format:** List by default, Calendar via toggle — see decisions.md.

---

## Heatmap SVG notes
- Requires front and back anatomical views
- 15 colourable regions per pair of views (front + back combined) — one
  fixed set, not two granularities; see decisions.md "Heatmap toggle removed"
- Regions are coloured dynamically via JavaScript based on heat calculation
- Tappable — the underlying library supports an `onClick` per muscle,
  though nothing listens yet (see roadmap.md)

**Status (updated 2026-07-09):** Rendered by the
[`body-highlighter`](https://github.com/lahaxearnaud/body-highlighter)
library (CDN import, see decisions.md "Heatmap renderer — body-highlighter
library") rather than a hand-built SVG — real anatomical shapes, not block
placeholders. `heatmap.js` creates one instance per view (`type: 'anterior'`
/ `'posterior'`) inside the `.body-view` containers; each instance owns its
own SVG and fill colours internally, driven by `heat.js`'s computed heat.
Colour comes from the `--color-heat-*` tokens, read at runtime so
`tokens.css` stays the single source of truth. Still open: tap-to-filter
navigation to the Exercise library (the library's `onClick` makes this
trivial to add) — see decisions.md "3D vs 2D heatmap renderer" for why a
flat front/back SVG was chosen over a 3D model in the first place.
