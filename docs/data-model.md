# Muscle heatmap app — data model

Reference file for all data structures. Update as the model evolves.

---

## Exercise entry

```json
{
  "id": "barbell-curl",
  "name": "Barbell Curl",
  "category": "pull",
  "equipment": ["barbell"],
  "muscleGroup": "Arms",
  "bias": [
    { "muscle": "Biceps Brachii", "emphasis": 0.8 },
    { "muscle": "Brachialis", "emphasis": 0.2 }
  ]
}
```

### Field notes
- `category` — "push", "pull", "legs", or "core". Movement-pattern tag, independent of `muscleGroup` below — used by `history.js` for session labels ("Push day", "Pull day", ...)
- `muscleGroup` — one of 6 broad categories (see "Exercise library groups" below). A single value, not a list — purely for browsing/filtering the Exercise library (list rows, filter pills, session cards). Doesn't drive the heatmap at all
- `bias` — every real anatomical muscle the exercise meaningfully trains (see "Heatmap muscles" below), each with an `emphasis` weight. This is what drives the heatmap
- `emphasis` — roughly 0 to 1, representing how much of the exercise's total effort goes to that muscle; a given exercise's `bias` entries should sum to ~1.0. Used to make heat accurate rather than binary (e.g. bench press shouldn't light up chest and triceps equally)
- There's no `role` (primary/secondary) field — `emphasis` alone conveys weight. The Exercise detail sheet ranks `bias` muscles by emphasis directly rather than showing a primary/secondary tag (see `docs/decisions.md`)

---

## Workout log entry

```json
{
  "id": "log-001",
  "date": "2025-06-29",
  "exercises": [
    {
      "exerciseId": "barbell-curl",
      "sets": [
        { "reps": 10, "weight": 40, "rpe": 7 },
        { "reps": 8, "weight": 42.5, "rpe": 8 },
        { "reps": 7, "weight": 42.5, "rpe": 9 }
      ]
    }
  ]
}
```

### Field notes
- `weight` — stored in kg
- `rpe` — Rate of Perceived Exertion, integer 1–10. Presented to user as "how hard was that set?" to keep it accessible. Captures relative effort without needing individual baselines

---

## Heat calculation

### Per set
```
set_heat = reps × (rpe / 10)
```

### Per body-highlighter region (within recency window)
```
recency_weight = 1 - (days_ago / 10) × 0.7
  → day 0  = 1.0 (full intensity)
  → day 10 = 0.3 (30% intensity)

region_heat = sum(set_heat × emphasis × recency_weight)
             for every bias muscle that maps to that region
             (js/muscle-taxonomy.js's MUSCLE_TO_REGIONS)
             within the 10-day rolling window
```

Note the rollup step: `bias` is keyed by real muscle name (e.g. "Gluteus
Maximus", "Gluteus Medius"), but the heatmap can only paint
body-highlighter's ~20 fixed regions (e.g. both those muscles → `gluteal`).
Contributions from every bias muscle mapping to the same region are summed
together before normalising — see `docs/decisions.md` "Exercise database —
muscleGroup + bias schema" for why this was chosen over trying to show
per-muscle precision on the heatmap itself.

### Normalisation
- Raw region-heat values are normalised across all regions to a 0–1 scale
- 0 maps to dark grey (untrained)
- 1 maps to red (most trained)
- Intermediate values map through amber → orange on the thermal scale

*Note: formula flagged for revisiting post-MVP.*

---

## Muscle taxonomy

Two separate id sets, for two separate purposes (see `docs/decisions.md`
"Exercise database — muscleGroup + bias schema"). Nothing converts between
them automatically at the data level — `js/muscle-taxonomy.js` is the one
place that maps from the second list to the first's rendering targets.

### Exercise library groups (`muscleGroup`)
The single category each exercise is filed under for browsing/filtering.

| Value |
|---|
| Chest |
| Back |
| Shoulders |
| Arms |
| Core |
| Legs |

### Heatmap muscles (`bias[].muscle`)
Real anatomical muscle names. One entry per commonly-named muscle a lifter
would recognize — not per muscle *head* (e.g. `Biceps Brachii`,
`Triceps Brachii`, `Quadriceps`, `Hamstrings` stay singular) — except
deltoids and glutes, which get their standard, commonly-programmed-for
split. `js/muscle-taxonomy.js`'s `MUSCLE_TO_REGIONS` maps each to the
[body-highlighter](https://github.com/lahaxearnaud/body-highlighter)
region(s) it paints; a few map to more than one region (Soleus → both
`left-soleus` and `right-soleus`).

| Muscle | Exercise library group | Heatmap region(s) |
|---|---|---|
| Pectoralis Major | Chest | chest |
| Latissimus Dorsi | Back | upper-back |
| Trapezius | Back | trapezius |
| Rhomboids | Back | upper-back |
| Teres Major | Back | upper-back |
| Erector Spinae | Back | lower-back |
| Anterior Deltoid | Shoulders | front-deltoids |
| Lateral Deltoid | Shoulders | front-deltoids |
| Posterior Deltoid | Shoulders | back-deltoids |
| Neck | Shoulders | neck |
| Biceps Brachii | Arms | biceps |
| Brachialis | Arms | biceps |
| Brachioradialis | Arms | forearm |
| Triceps Brachii | Arms | triceps |
| Forearms | Arms | forearm |
| Rectus Abdominis | Core | abs |
| Obliques | Core | obliques |
| Quadriceps | Legs | quadriceps |
| Hamstrings | Legs | hamstring |
| Gluteus Maximus | Legs | gluteal |
| Gluteus Medius | Legs | gluteal |
| Adductors | Legs | adductor |
| Abductors | Legs | abductors |
| Gastrocnemius | Legs | calves |
| Soleus | Legs | left-soleus, right-soleus |

---

## Storage (MVP)
- Exercise database: `fetch()`ed from `data/exercises.json` once and cached
  in memory (`js/data.js`) — not stored in `localStorage`, it's static
  content shipped with the app, not user data
- Workout logs: `localStorage`, key `heatmap_logs` — no backend required
- Hardened against browser storage eviction (not migrated to a different
  storage API — see `docs/decisions.md` "Harden on-device persistence" for
  why `localStorage` itself was kept) via `navigator.storage.persist()`,
  PWA installability (`manifest.json` + `sw.js`), and a manual JSON
  export/import backup (History screen topbar)
- Migrate to a real backend (e.g. Supabase) post-MVP if cross-device sync
  or accounts become a goal — single-device persistence doesn't need one
