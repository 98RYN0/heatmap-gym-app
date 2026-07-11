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
export function loadLogs() {
  return JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
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

// Serializes the current logs to a downloadable JSON file — a manual
// backup that survives even if the browser does evict site storage, or
// the user gets a new device.
export function exportLogs() {
  const logs = loadLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `heatmap-backup-${new Date().toISOString().split('T')[0]}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

// Reads a previously-exported JSON file and replaces the current logs with
// its contents. Throws on invalid input so the caller (history.js) can
// show the user what went wrong rather than silently corrupting storage.
export async function importLogs(file) {
  const text = await file.text();
  const logs = JSON.parse(text);

  if (!Array.isArray(logs)) {
    throw new Error('Backup file is not a valid logs export (expected a JSON array).');
  }

  saveLogs(logs);
  return logs;
}
