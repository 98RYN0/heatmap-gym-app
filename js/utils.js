// Small helpers shared across modules — kept here instead of duplicated
// wherever they're needed.

// "biceps" -> "Biceps". Used for muscle group names, categories, equipment.
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// "front-deltoids" -> "Front Deltoids". For the hyphenated body-highlighter
// muscle ids (heat.js's MUSCLE_GROUPS) — plain capitalize() alone would
// leave the hyphen in, e.g. "Front-deltoids".
export function formatMuscleName(id) {
  return id.split('-').map(capitalize).join(' ');
}

// Local calendar date as "YYYY-MM-DD". Deliberately not toISOString() (which
// converts to UTC first) — that shifts the date by a day for anyone in a
// timezone ahead of UTC, e.g. logging a workout at 8am AEST would land on
// yesterday's date.
export function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Weight is always stored in kg (docs/data-model.md) — these two convert
// at the display/entry boundary only, for the kg/lbs preference set on
// the Settings screen. kg is the identity in both directions, so a value
// entered in kg round-trips exactly; lbs only rounds for *display*
// (nearest 0.5 lb, matching plate increments), the underlying stored kg
// value stays full-precision either way.
const KG_PER_LB = 0.45359237;

export function convertKgToUnit(kg, unit) {
  if (unit !== 'lbs') return kg;
  return Math.round((kg / KG_PER_LB) * 2) / 2;
}

export function convertUnitToKg(value, unit) {
  if (unit !== 'lbs') return Number(value);
  return Number(value) * KG_PER_LB;
}

// One logged set's markup — used by history.js's read-only log detail
// sheet (js/log.js's active session has its own interactive version,
// buildSetRowHTML(), since it needs edit/duplicate/remove controls this
// read-only view doesn't). Bodyweight sets have no `weight` field at all
// (see log.js's buildExerciseCard), so that column is left out rather
// than showing a weight of 0.
export function formatSetRow(set, index, unit) {
  const weightPart = set.weight != null ? `<span>${convertKgToUnit(set.weight, unit)} ${unit}</span>` : '';
  return `<div class="set-row"><span>#${index + 1}</span><span>${set.reps} reps</span>${weightPart}<span>RPE ${set.rpe}</span></div>`;
}
