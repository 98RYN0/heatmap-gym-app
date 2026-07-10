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
