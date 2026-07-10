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
