// Heat calculation — pure functions turning workout logs into per-muscle heat values.
// No DOM access in this file on purpose: it's easy to reason about and easy
// to hand-test (call a function, check the number) when it doesn't touch
// the page. heatmap.js is the module that takes this output and paints it.
// Formulas per docs/data-model.md.

import { MUSCLE_TO_REGIONS } from './muscle-taxonomy.js';

// Every body-highlighter region an exercise's bias data can resolve to
// (see js/muscle-taxonomy.js). Pre-seeding every region to 0 means an
// untrained one still shows up as "cold" in the result rather than being
// absent from it entirely.
export const MUSCLE_GROUPS = [
  'trapezius', 'upper-back', 'lower-back', 'front-deltoids', 'back-deltoids',
  'chest', 'biceps', 'triceps', 'forearm', 'abs', 'obliques',
  'quadriceps', 'hamstring', 'gluteal', 'adductor', 'abductors',
  'calves', 'left-soleus', 'right-soleus', 'neck',
];

const RECENCY_WINDOW_DAYS = 10;

// Raw effort score for one set: more reps and/or higher perceived effort = more heat.
export function setHeat(reps, rpe) {
  return reps * (rpe / 10);
}

export function daysAgo(dateStr) {
  // Compare calendar dates in a single reference frame (UTC) on both sides —
  // `new Date(dateStr)` parses a date-only string as UTC midnight, so comparing
  // it against local midnight would be off by a day in timezones ahead of UTC.
  const [year, month, day] = dateStr.split('-').map(Number);
  const logged = Date.UTC(year, month - 1, day);

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.floor((today - logged) / (1000 * 60 * 60 * 24));
}

// Linear taper across the 10-day recency window: today = full intensity
// (1.0), 10 days ago = 30% intensity, anything older = excluded (0)
// entirely so old sessions don't keep contributing forever.
export function recencyWeight(days) {
  if (days > RECENCY_WINDOW_DAYS) return 0;
  return 1 - (days / RECENCY_WINDOW_DAYS) * 0.7;
}

// Walks every set in every exercise in every log, and sums each set's
// contribution into the real anatomical muscles its bias targets —
// weighted by how recent the session was and how much that muscle was
// emphasised in that exercise (exercises.json's `bias[].emphasis`). This
// is the source of truth both the heatmap (via computeRawHeat below,
// which just rolls this up) and the quick-log muscle picker
// (js/heatmap.js, which needs per-muscle — not per-region — numbers to
// find which specific muscle in a clicked region is most under-trained)
// are built from.
export function computeMuscleHeat(logs, exercises) {
  const heat = {};
  Object.keys(MUSCLE_TO_REGIONS).forEach((muscle) => {
    heat[muscle] = 0;
  });

  logs.forEach((log) => {
    const weight = recencyWeight(daysAgo(log.date));
    if (weight === 0) return; // outside the recency window — doesn't count at all

    log.exercises.forEach((entry) => {
      const exercise = exercises.find((ex) => ex.id === entry.exerciseId);
      if (!exercise) return; // guards against stale/removed exercise ids in old logs
      const bias = exercise.bias || [];

      entry.sets.forEach((set) => {
        const contribution = setHeat(set.reps, set.rpe) * weight;
        bias.forEach(({ muscle, emphasis }) => {
          heat[muscle] = (heat[muscle] || 0) + contribution * emphasis;
        });
      });
    });
  });

  return heat;
}

// Rolls per-muscle heat up into body-highlighter's paintable regions —
// the heatmap's actual data source. Multiple bias muscles (e.g. Gluteus
// Maximus and Gluteus Medius) can resolve to the same region and simply
// sum together, same as multiple exercises training the same region
// already do.
export function computeRawHeat(logs, exercises) {
  const muscleHeat = computeMuscleHeat(logs, exercises);

  const heat = {};
  MUSCLE_GROUPS.forEach((group) => {
    heat[group] = 0;
  });

  Object.entries(muscleHeat).forEach(([muscle, value]) => {
    const regions = MUSCLE_TO_REGIONS[muscle] || [];
    regions.forEach((region) => {
      heat[region] = (heat[region] || 0) + value;
    });
  });

  return heat;
}

// Scales raw heat values so the highest-heat muscle is 1.0 and everything
// else is relative to it — that's what tier() and the heatmap colours are
// keyed off, rather than raw unbounded numbers.
export function normalize(rawHeat) {
  const values = Object.values(rawHeat);
  const max = values.length ? Math.max(...values) : 0;
  if (max === 0) return rawHeat; // no training data yet — leave everything at 0 rather than dividing by zero

  const normalized = {};
  Object.entries(rawHeat).forEach(([group, value]) => {
    normalized[group] = value / max;
  });
  return normalized;
}

// Buckets a normalized 0-1 heat value into one of 4 colour tiers, which
// heatmap.js maps to actual colours for the body-highlighter library.
// Even thirds above 0 — see docs/decisions.md "Heat tier thresholds" for why.
export function tier(value) {
  if (!value) return 'cold';
  if (value <= 0.33) return 'warm';
  if (value <= 0.66) return 'hot';
  return 'max';
}
