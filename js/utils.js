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

// One logged set's markup — shared by log.js (active session) and
// history.js (read-only log detail), so the two views can't drift apart.
// Bodyweight sets have no `weight` field at all (see log.js's
// buildExerciseCard), so that column is left out rather than showing "kg".
export function formatSetRow(set, index) {
  const weightPart = set.weight != null ? `<span>${set.weight} kg</span>` : '';
  return `<div class="set-row"><span>#${index + 1}</span><span>${set.reps} reps</span>${weightPart}<span>RPE ${set.rpe}</span></div>`;
}
