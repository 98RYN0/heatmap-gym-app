// Data access — exercise library (fetched once) and workout logs (localStorage).
// Nothing in here touches the DOM; it's the one place that knows how data
// gets in and out of storage, so the rest of the app doesn't need to.

const LOGS_KEY = 'heatmap_logs';
const LEGACY_BODY_MODEL_KEY = 'heatmap_body_model'; // pre-Profile key, read once by loadProfile()'s migration below, never written to anymore
const PROFILE_KEY = 'heatmap_profile';
const WEIGHT_ENTRIES_KEY = 'heatmap_weight_entries';
const WEIGHT_UNIT_KEY = 'heatmap_weight_unit';
const THEME_KEY = 'heatmap_theme'; // kept in sync with index.html's inline anti-flash <head> script, which reads this same key name directly (it runs before any module, so it can't import this constant)

// Cached after the first fetch so re-navigating screens doesn't re-request
// the same static JSON file.
let exercisesCache = null;

export async function loadExercises() {
  if (exercisesCache) return exercisesCache;
  const response = await fetch('data/exercises.json');
  if (!response.ok) {
    throw new Error(`Failed to load exercises.json: ${response.status}`);
  }
  exercisesCache = await response.json();
  return exercisesCache;
}

// localStorage only stores strings, so logs are parsed/stringified on the
// way in and out. Falls back to an empty array on first run, when the key
// doesn't exist yet.
//
// Backfills `id` on any log that predates it being assigned at finish time
// (see log.js's finishSession()) — logs saved before that change have no
// id at all, which silently breaks the History screen's view/delete-by-id
// lookup for them. Every read goes through here, so this self-heals on
// first load after the update rather than needing a one-off migration step.
export function loadLogs() {
  const logs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
  let migrated = false;
  logs.forEach((log) => {
    if (!log.id) {
      log.id = crypto.randomUUID();
      migrated = true;
    }
  });
  if (migrated) saveLogs(logs);
  return logs;
}

export function saveLogs(logs) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

// Appends one finished workout session to the stored log list.
export function addLog(log) {
  const logs = loadLogs();
  logs.push(log);
  saveLogs(logs);
  return logs;
}

// Removes one logged session by id — used when a workout was logged
// incorrectly (History screen's log detail sheet).
export function deleteLog(id) {
  const logs = loadLogs().filter((log) => log.id !== id);
  saveLogs(logs);
  return logs;
}

// Personalization: name (for the Heatmap screen's greeting) and gender
// (js/vendor/body-highlighter.js's `gender` option — which body model
// paints the heatmap and exercise mini-heatmaps). Gender used to be its
// own standalone Settings toggle (`heatmap_body_model`); the Profile
// sheet (js/profile.js) absorbed it, so this migrates any value already
// sitting in that legacy key into the new profile the first time it's
// read, the same self-healing pattern loadLogs() uses to backfill ids —
// no one-off migration step, no lost preference for anyone who'd already
// picked a body model. Name defaults to '' (no greeting name shown until
// set); gender defaults to 'male' if there's no legacy value either.
export function loadProfile() {
  const stored = localStorage.getItem(PROFILE_KEY);
  if (stored) return JSON.parse(stored);

  const profile = { name: '', gender: localStorage.getItem(LEGACY_BODY_MODEL_KEY) || 'male' };
  saveProfile(profile);
  return profile;
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// Weight check-ins over time (Profile sheet's "Log weight") — always in
// kg (see js/utils.js's convertKgToUnit/convertUnitToKg), same canonical-
// storage convention as workout set weights. Not to be confused with
// exercises tagged "bodyweight" (js/data-model.md) — an unrelated concept.
export function loadWeightEntries() {
  return JSON.parse(localStorage.getItem(WEIGHT_ENTRIES_KEY) || '[]');
}

export function saveWeightEntries(entries) {
  localStorage.setItem(WEIGHT_ENTRIES_KEY, JSON.stringify(entries));
}

// One weigh-in per calendar date — logging again on a date that already
// has an entry overwrites its weight rather than pushing a duplicate,
// since a second same-day check-in almost always means "I mistyped" or
// "let me correct this," not a genuinely separate data point.
export function addWeightEntry(date, weightKg) {
  const entries = loadWeightEntries();
  const existing = entries.find((entry) => entry.date === date);
  if (existing) {
    existing.weight = weightKg;
  } else {
    entries.push({ id: crypto.randomUUID(), date, weight: weightKg });
  }
  saveWeightEntries(entries);
  return entries;
}

// Which unit weight is entered/displayed in — 'kg' or 'lbs'. Storage
// itself is always kg (see js/utils.js's convertKgToUnit/convertUnitToKg);
// this only controls the display/entry boundary. Falls back to 'kg',
// matching every set logged before this preference existed.
export function loadUnit() {
  return localStorage.getItem(WEIGHT_UNIT_KEY) || 'kg';
}

export function saveUnit(unit) {
  localStorage.setItem(WEIGHT_UNIT_KEY, unit);
}

// Which theme to render — 'dark' or 'light'. A deliberate user choice
// (Settings screen toggle), not a system prefers-color-scheme follow —
// see docs/ui-notes.md "Theme". Falls back to 'dark', the app's original
// and still-default palette.
export function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

// Asks the browser to exempt this origin's storage from automatic eviction
// under storage pressure (Chrome/Firefox/Edge — no-op where unsupported,
// e.g. Safari, which instead treats an installed/homescreen PWA as
// persistent). Best-effort and silent by design: the browser grants or
// denies based on its own engagement heuristics, there's nothing useful
// for the user to do in response either way.
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
  } catch {
    // Ignore — worst case storage stays evictable, same as before this call.
  }
}
