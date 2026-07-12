// Heatmap screen — renders the front/back body figures via the
// body-highlighter library, keeps the "Needs work"/"Most trained"
// callout cards in sync, and drives the quick-log sheet opened by
// tapping a region. This is the hero feature of the app.
//
// body-highlighter (MIT, https://github.com/lahaxearnaud/body-highlighter)
// is zero-dependency vanilla JS with a prebuilt ESM file, so it's imported
// straight from a CDN — no npm install, no build step, matches how the
// rest of this project runs. See docs/decisions.md for why it replaced the
// original hand-drawn block-shape SVGs, and for why there's no
// Simple/Advanced toggle — the SVG is the same regions either way, so the
// former "Simple" mode was just this same data with some regions forced to
// match colours. Painting always uses the full-precision data directly.

import createBodyHighlighter from 'https://unpkg.com/body-highlighter@3/dist/body-highlighter.esm.js';
import { loadLogs } from './data.js';
import { computeRawHeat, computeMuscleHeat, normalize, daysAgo, recencyWeight } from './heat.js';
import { MUSCLE_TO_REGIONS } from './muscle-taxonomy.js';
import { formatMuscleName } from './utils.js';

// The library colours a muscle by counting how many entries in its `data`
// array mention it (that's "frequency"), not by a continuous value — so a
// normalized 0-1 heat value has to become a whole number of synthetic
// entries. body-highlighter indexes highlightedColors[frequency - 1],
// clamped to the array's own length rather than requiring exactly 3
// entries — so handing it a much longer array of finely-interpolated
// colours (buildGradient() below) turns what used to be 3 visible buckets
// into a near-continuous ramp, entirely through the library's existing
// public API. See docs/decisions.md "Continuous heatmap gradient."
const GRADIENT_STEPS = 40;

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

// Piecewise-linear interpolation across an arbitrary number of colour
// stops, producing `steps` evenly-spaced hex colours along that ramp.
// Used to turn the 4 named thermal tokens (cold/warm/hot/max) into a long
// gradient array — the first and last generated colours land exactly on
// the first and last stops, so the ramp's endpoints still match the named
// tokens exactly; only the space between them is now continuous rather
// than jumping straight from one named colour to the next.
function buildGradient(stops, steps) {
  const stopRgb = stops.map(hexToRgb);
  const colors = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1); // 0..1 across the whole ramp
    const segment = t * (stopRgb.length - 1);
    const idx = Math.min(Math.floor(segment), stopRgb.length - 2);
    const localT = segment - idx;
    const from = stopRgb[idx];
    const to = stopRgb[idx + 1];
    const rgb = from.map((channel, c) => channel + (to[c] - channel) * localT);
    colors.push(rgbToHex(rgb));
  }
  return colors;
}

const frontContainer = document.querySelector('.body-view[data-view="front"]');
const backContainer = document.querySelector('.body-view[data-view="back"]');

const [neededCard, mostTrainedCard] = document.querySelectorAll('.callout-card');
const neededValue = neededCard.querySelector('.callout-value');
const neededMeta = neededCard.querySelector('.callout-meta');
const mostTrainedValue = mostTrainedCard.querySelector('.callout-value');
const mostTrainedMeta = mostTrainedCard.querySelector('.callout-meta');

const quickLogSheet = document.getElementById('quick-log-sheet');
const quickLogTitle = quickLogSheet.querySelector('.sheet-title');
const quickLogSubtitle = quickLogSheet.querySelector('.sheet-subtitle');
const quickLogList = quickLogSheet.querySelector('.exercise-list');
const quickLogBackdrop = quickLogSheet.querySelector('.sheet-backdrop');
const quickLogClose = quickLogSheet.querySelector('.sheet-close');

let exercises = [];
let frontHighlighter = null;
let backHighlighter = null;
let onQuickAdd = null; // callback from app.js, ultimately log.js's addExerciseToSession

// Reads the thermal palette straight from tokens.css at runtime rather
// than duplicating hex values here — tokens.css stays the single source
// of truth for colour.
function readThermalColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name) => styles.getPropertyValue(name).trim();
  return {
    cold: read('--color-heat-cold'),
    warm: read('--color-heat-warm'),
    hot: read('--color-heat-hot'),
    max: read('--color-heat-max'),
  };
}

// Called once from app.js. Creates the two body-highlighter instances
// (front/back) inside their containers, wires the quick-log sheet, and
// does the first paint.
export async function initHeatmap(exerciseData, { onQuickAdd: onQuickAddCb } = {}) {
  exercises = exerciseData;
  onQuickAdd = onQuickAddCb || null;

  const colors = readThermalColors();
  const highlightedColors = buildGradient([colors.cold, colors.warm, colors.hot, colors.max], GRADIENT_STEPS);
  const svgStyle = { width: '100%', height: 'auto' };
  const onClick = ({ muscle }) => handleRegionClick(muscle);

  frontHighlighter = createBodyHighlighter({
    container: frontContainer,
    type: 'anterior',
    bodyColor: colors.cold,
    highlightedColors,
    svgStyle,
    onClick,
  });
  backHighlighter = createBodyHighlighter({
    container: backContainer,
    type: 'posterior',
    bodyColor: colors.cold,
    highlightedColors,
    svgStyle,
    onClick,
  });

  quickLogList.addEventListener('click', (e) => {
    const item = e.target.closest('li');
    if (!item || !item.dataset.exerciseId) return;
    const exercise = exercises.find((ex) => ex.id === item.dataset.exerciseId);
    if (exercise && onQuickAdd) onQuickAdd(exercise);
    closeQuickLogSheet();
  });
  quickLogBackdrop.addEventListener('click', closeQuickLogSheet);
  quickLogClose.addEventListener('click', closeQuickLogSheet);

  paintHeatmap();
}

// Recomputes heat from the current logs and repaints both body views.
// Exported so log.js can call it again after a workout is finished,
// without this module needing to know when that happens.
export function paintHeatmap() {
  const logs = loadLogs();
  const raw = computeRawHeat(logs, exercises);
  const normalized = normalize(raw);

  // Build the library's expected data shape: one synthetic "exercise"
  // entry per frequency unit, per muscle. heat.js's group ids are already
  // the library's own MuscleType strings, so they're used directly — no
  // translation needed. The same array is handed to both highlighters;
  // each one only has SVG regions for the muscles visible from its own
  // view (e.g. biceps has no posterior region), so it naturally ignores
  // anything that doesn't apply to it.
  //
  // A normalized value has to become a whole number of entries — rounded
  // to the nearest of GRADIENT_STEPS rather than bucketed into 3 tiers, so
  // two different amounts of training only render identically if they're
  // within about a GRADIENT_STEPS-th of each other, not within a third.
  // Math.max(1, ...) keeps any nonzero value visibly above bodyColor even
  // if it rounds down to 0 — only an exact 0 (untrained) stays at bodyColor.
  const libraryData = [];
  Object.keys(normalized).forEach((group) => {
    const value = normalized[group];
    if (!value) return; // untrained — leave at bodyColor, nothing to add

    const steps = Math.max(1, Math.round(value * GRADIENT_STEPS));
    for (let i = 0; i < steps; i++) {
      libraryData.push({ name: `${group}-${i}`, muscles: [group] });
    }
  });

  frontHighlighter.update({ data: libraryData });
  backHighlighter.update({ data: libraryData });

  updateCallouts(raw, normalized, logs);
}

// Which logged sessions (within the recency window) trained a given
// muscle group at all — used for the callout cards' "X days since" /
// "X sessions" meta lines.
function sessionsTrainingMuscle(region, logs) {
  return logs.filter((log) => {
    if (recencyWeight(daysAgo(log.date)) === 0) return false;
    return log.exercises.some((entry) => {
      const exercise = exercises.find((ex) => ex.id === entry.exerciseId);
      if (!exercise) return false;
      return (exercise.bias || []).some((b) => (MUSCLE_TO_REGIONS[b.muscle] || []).includes(region));
    });
  });
}

// Finds the coldest and hottest muscle groups and writes them into the two
// callout cards at the top of the Heatmap screen.
function updateCallouts(raw, normalized, logs) {
  const totalHeat = Object.values(raw).reduce((sum, v) => sum + v, 0);
  const groups = Object.keys(normalized);
  if (totalHeat === 0 || groups.length === 0) return; // no recent training data — leave the "—" placeholders

  // reduce() walks the group list comparing pairs — <= keeps the earlier
  // group on ties, so with no data (all zero) the first group in the list
  // always wins as coldest. Harmless: this path only runs once
  // totalHeat > 0, so ties are rare in practice.
  const coldest = groups.reduce((a, b) => (normalized[a] <= normalized[b] ? a : b));
  const hottest = groups.reduce((a, b) => (normalized[a] >= normalized[b] ? a : b));

  const coldestSessions = sessionsTrainingMuscle(coldest, logs);
  const hottestSessions = sessionsTrainingMuscle(hottest, logs);

  neededValue.textContent = formatMuscleName(coldest);
  neededMeta.textContent = coldestSessions.length
    ? `${Math.min(...coldestSessions.map((log) => daysAgo(log.date)))} days since last trained`
    : 'Not trained recently';

  mostTrainedValue.textContent = formatMuscleName(hottest);
  mostTrainedMeta.textContent = `${hottestSessions.length} session${hottestSessions.length === 1 ? '' : 's'}`;
}

// Every real muscle whose bias data can paint the given body-highlighter
// region — the reverse of MUSCLE_TO_REGIONS. Most regions have exactly
// one (e.g. `chest` <- only Pectoralis Major); a handful have 2-3 (e.g.
// `gluteal` <- Gluteus Maximus + Medius), which is exactly the case this
// quick-log feature exists to disambiguate.
function musclesForRegion(region) {
  return Object.keys(MUSCLE_TO_REGIONS).filter((muscle) => MUSCLE_TO_REGIONS[muscle].includes(region));
}

// Tapping a region: find whichever of its muscles is least recently/
// heavily trained (lowest raw heat — the same recency-weighted effort
// metric used everywhere else), then open the quick-log sheet for it.
function handleRegionClick(region) {
  const muscles = musclesForRegion(region);
  if (muscles.length === 0) return; // decorative/unmapped region (e.g. head) — nothing to suggest

  const muscleHeat = computeMuscleHeat(loadLogs(), exercises);
  const target = muscles.reduce((worst, m) => (muscleHeat[m] <= muscleHeat[worst] ? m : worst), muscles[0]);

  openQuickLogSheet(target);
}

// The exercises whose bias targets `muscle` hardest, highest emphasis
// first, capped to a short list — these are the "most optimal" picks for
// that specific muscle.
function topExercisesForMuscle(muscle, limit = 4) {
  return exercises
    .map((exercise) => ({ exercise, bias: (exercise.bias || []).find((b) => b.muscle === muscle) }))
    .filter((entry) => entry.bias)
    .sort((a, b) => b.bias.emphasis - a.bias.emphasis)
    .slice(0, limit);
}

function openQuickLogSheet(muscle) {
  quickLogTitle.textContent = formatMuscleName(muscle);
  quickLogSubtitle.textContent = 'Needs work — best exercises for it';

  quickLogList.innerHTML = '';
  topExercisesForMuscle(muscle).forEach(({ exercise, bias }) => {
    const li = document.createElement('li');
    li.dataset.exerciseId = exercise.id;
    li.innerHTML = `
      <span class="exercise-name">${exercise.name}</span>
      <span class="exercise-meta">${Math.round(bias.emphasis * 100)}%</span>
    `;
    quickLogList.appendChild(li);
  });

  quickLogSheet.classList.add('open');
}

function closeQuickLogSheet() {
  quickLogSheet.classList.remove('open');
}
