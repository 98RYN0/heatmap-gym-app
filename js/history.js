// History screen — a reverse-chronological list and a month calendar, both
// derived from the same localStorage logs (no separate data source). Also
// owns the manual backup UI (export/import) and the log detail sheet
// (view/delete a single logged session) — both natural fits since this
// screen is already "your training data over time."

import { loadLogs, exportLogs, importLogs, deleteLog } from './data.js';
import { capitalize, todayDateString } from './utils.js';

const listView = document.querySelector('.history-view[data-view="list"]');
const calendarView = document.querySelector('.history-view[data-view="calendar"]');
const toggleButtons = document.querySelectorAll('[data-toggle="history-view"] .toggle-option');
const monthLabel = document.querySelector('.calendar-month-label');
const calendarGrid = document.querySelector('.calendar-grid');
const prevBtn = document.getElementById('cal-prev');
const nextBtn = document.getElementById('cal-next');
const exportBtn = document.getElementById('export-data-btn');
const importBtn = document.getElementById('import-data-btn');
const importFileInput = document.getElementById('import-file-input');

const logSheet = document.getElementById('log-detail-sheet');
const logSheetTitle = logSheet.querySelector('.sheet-title');
const logSheetSubtitle = logSheet.querySelector('.sheet-subtitle');
const logSheetList = logSheet.querySelector('.session-list');
const logSheetClose = logSheet.querySelector('.sheet-close');
const logSheetBackdrop = logSheet.querySelector('.sheet-backdrop');
const deleteLogBtn = document.getElementById('delete-log-btn');

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday-start, matches renderCalendar()'s startDay math

let exercises = [];
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed (0 = January), same as the Date API
let onLogsChanged = null; // callback from app.js — repaints the heatmap, since import/delete both change its data
let openLogId = null; // which log the detail sheet is currently showing, for the delete button

// Called once from app.js.
export function initHistory(exerciseData, { onLogsChanged: onLogsChangedCb } = {}) {
  exercises = exerciseData;
  onLogsChanged = onLogsChangedCb || null;

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      toggleButtons.forEach((b) => b.classList.toggle('active', b === button));
      listView.classList.toggle('active', button.dataset.value === 'list');
      calendarView.classList.toggle('active', button.dataset.value === 'calendar');
      if (button.dataset.value === 'calendar') renderCalendar();
    });
  });

  prevBtn.addEventListener('click', () => {
    calMonth -= 1;
    if (calMonth < 0) {
      calMonth = 11;
      calYear -= 1;
    }
    renderCalendar();
  });

  nextBtn.addEventListener('click', () => {
    calMonth += 1;
    if (calMonth > 11) {
      calMonth = 0;
      calYear += 1;
    }
    renderCalendar();
  });

  exportBtn.addEventListener('click', exportLogs);
  importBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', handleImportFile);

  // Delegated click: entries are rebuilt on every render, same pattern as
  // exercises.js's exercise list.
  listView.addEventListener('click', (e) => {
    const entry = e.target.closest('.history-entry');
    if (!entry || !entry.dataset.logId) return;
    const log = loadLogs().find((l) => l.id === entry.dataset.logId);
    if (log) openLogDetailSheet(log);
  });

  logSheetBackdrop.addEventListener('click', closeLogDetailSheet);
  logSheetClose.addEventListener('click', closeLogDetailSheet);
  deleteLogBtn.addEventListener('click', handleDeleteLog);

  renderHistoryList();
}

export function refreshHistory() {
  renderHistoryList();
  if (calendarView.classList.contains('active')) renderCalendar();
}

// Import replaces everything currently stored, so confirm first — this is
// one of two destructive actions in the app (the other is deleting a
// single log, below), native confirm()/alert() are a pragmatic fit rather
// than building a custom dialog just for these two spots.
async function handleImportFile(e) {
  const file = e.target.files[0];
  importFileInput.value = ''; // reset so re-picking the same file still fires 'change' next time
  if (!file) return;

  if (!confirm('Import this backup? It will replace all workouts currently saved on this device.')) {
    return;
  }

  try {
    await importLogs(file);
    refreshHistory();
    if (onLogsChanged) onLogsChanged();
  } catch (err) {
    alert(`Couldn't import that file: ${err.message}`);
  }
}

function sessionLabel(log) {
  const categories = log.exercises
    .map((entry) => exercises.find((ex) => ex.id === entry.exerciseId)?.category)
    .filter(Boolean);
  const unique = [...new Set(categories)];
  const label = unique.length === 1 ? `${capitalize(unique[0])} day` : 'Mixed session';
  const count = log.exercises.length;
  return `${label} · ${count} exercise${count === 1 ? '' : 's'}`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function renderHistoryList() {
  const logs = loadLogs().slice().sort((a, b) => new Date(b.date) - new Date(a.date)); // newest first
  listView.innerHTML = '';

  if (logs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No workouts logged yet.';
    listView.appendChild(empty);
    return;
  }

  logs.forEach((log) => {
    const entry = document.createElement('div');
    entry.className = 'history-entry';
    entry.dataset.logId = log.id;
    entry.innerHTML = `
      <p class="history-date">${formatDate(log.date)}</p>
      <p class="history-summary">${sessionLabel(log)}</p>
    `;
    listView.appendChild(entry);
  });
}

// Populates and opens the log detail sheet: date/summary header, then one
// read-only exercise-card per logged exercise (same markup log.js renders
// for an active session, minus the add-set form — nothing to edit here).
function openLogDetailSheet(log) {
  openLogId = log.id;
  logSheetTitle.textContent = formatDate(log.date);
  logSheetSubtitle.textContent = sessionLabel(log);

  logSheetList.innerHTML = '';
  log.exercises.forEach((entry) => {
    const exercise = exercises.find((ex) => ex.id === entry.exerciseId);
    const li = document.createElement('li');
    li.className = 'exercise-card';
    li.innerHTML = `
      <div class="exercise-card-header">
        <span class="exercise-name">${exercise ? exercise.name : 'Unknown exercise'}</span>
        <span class="exercise-meta">${exercise ? exercise.muscleGroup : ''}</span>
      </div>
      <div class="set-rows">
        ${entry.sets
          .map(
            (set, i) => `
          <div class="set-row"><span>#${i + 1}</span><span>${set.reps} reps</span><span>${set.weight} kg</span><span>RPE ${set.rpe}</span></div>
        `
          )
          .join('')}
      </div>
    `;
    logSheetList.appendChild(li);
  });

  logSheet.classList.add('open');
}

function closeLogDetailSheet() {
  logSheet.classList.remove('open');
  openLogId = null;
}

function handleDeleteLog() {
  if (!openLogId) return;
  if (!confirm('Delete this workout? This can\'t be undone.')) return;

  deleteLog(openLogId);
  closeLogDetailSheet();
  refreshHistory();
  if (onLogsChanged) onLogsChanged();
}

// Rebuilds the month grid for calYear/calMonth: a header row of weekday
// labels, blank spacer cells up to the 1st's weekday, then one cell per
// day of the month, marked "trained" if a log exists for that date.
function renderCalendar() {
  monthLabel.textContent = new Date(calYear, calMonth).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate(); // day 0 of next month = last day of this one
  // Date.getDay() is 0=Sunday..6=Saturday; +6 %7 shifts it to a Monday-start index (0=Monday..6=Sunday).
  const startDay = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;

  const trainedDates = new Set(loadLogs().map((log) => log.date));
  const todayStr = todayDateString();

  calendarGrid.innerHTML = '';

  DOW_LABELS.forEach((label) => {
    const cell = document.createElement('div');
    cell.className = 'calendar-dow';
    cell.textContent = label;
    calendarGrid.appendChild(cell);
  });

  // Empty spacer cells so day 1 lands under the correct weekday column.
  for (let i = 0; i < startDay; i++) {
    calendarGrid.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (trainedDates.has(dateStr)) cell.classList.add('trained');
    if (dateStr === todayStr) cell.classList.add('today');
    cell.textContent = String(day);
    calendarGrid.appendChild(cell);
  }
}
