// Data access — exercise library (fetched once) and workout logs (localStorage).
// Nothing in here touches the DOM; it's the one place that knows how data
// gets in and out of storage, so the rest of the app doesn't need to.

const LOGS_KEY = 'heatmap_logs';

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
