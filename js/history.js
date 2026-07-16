// History screen — a reverse-chronological list and a month calendar, both
// derived from the same localStorage logs (no separate data source). Also
// owns the log detail sheet (view/delete a single logged session) — a
// natural fit since this screen is already "your training data over time."

import { loadLogs, deleteLog, loadWeightEntries } from './data.js';
import { capitalize, todayDateString, formatSetRow, formatDate, convertKgToUnit } from './utils.js';

const listView = document.querySelector('.history-view[data-view="list"]');
const calendarView = document.querySelector('.history-view[data-view="calendar"]');
const weightView = document.querySelector('.history-view[data-view="weight"]');
const toggleButtons = document.querySelectorAll('[data-toggle="history-view"] .toggle-option');
const monthLabel = document.querySelector('.calendar-month-label');
const calendarGrid = document.querySelector('.calendar-grid');
const prevBtn = document.getElementById('cal-prev');
const nextBtn = document.getElementById('cal-next');

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
let onLogsChanged = null; // callback from app.js — repaints the heatmap, since deleting a log changes its data
let openLogId = null; // which log the detail sheet is currently showing, for the delete button
let currentUnit = 'kg'; // display unit for weight in the log detail sheet — storage is always kg, see js/utils.js

// Called once from app.js.
export function initHistory(exerciseData, { onLogsChanged: onLogsChangedCb, unit } = {}) {
  exercises = exerciseData;
  onLogsChanged = onLogsChangedCb || null;
  if (unit) currentUnit = unit;

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.value));
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
  if (weightView.classList.contains('active')) renderWeightTrend();
}

// Called from app.js when the Settings screen's Units toggle changes. The
// log detail sheet itself won't retroactively re-render if already open
// (same accepted tradeoff as the exercise detail sheet elsewhere in the
// app) — but the weight trend is a whole screen view, not a sheet, so it
// gets the live-repaint treatment other toggles already give visible content.
export function setUnit(unit) {
  currentUnit = unit;
  if (weightView.classList.contains('active')) renderWeightTrend();
}

// Switches the active History view programmatically — shares the toggle
// click handler's own logic (setActiveView below) rather than duplicating
// it, so the two stay in sync. Exported for the Profile sheet's "View
// trend" link (js/profile.js, wired via app.js) to land directly on the
// Weight tab.
export function selectHistoryView(view) {
  setActiveView(view);
}

// Toggles which .toggle-option/.history-view has .active, plus whatever
// per-view render each one needs on becoming visible (List's own render
// happens unconditionally elsewhere — see renderHistoryList()).
function setActiveView(view) {
  toggleButtons.forEach((button) => button.classList.toggle('active', button.dataset.value === view));
  listView.classList.toggle('active', view === 'list');
  calendarView.classList.toggle('active', view === 'calendar');
  weightView.classList.toggle('active', view === 'weight');
  if (view === 'calendar') renderCalendar();
  if (view === 'weight') renderWeightTrend();
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
        ${entry.sets.map((set, i) => formatSetRow(set, i, currentUnit)).join('')}
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

// Fixed-size viewBox for the weight trend SVG — units below are in this
// coordinate space, not real pixels (the SVG itself scales to its
// container via .weight-trend-svg's width:100%/height:auto).
const CHART_WIDTH = 300;
const CHART_HEIGHT = 150;
const CHART_PADDING = { top: 16, right: 12, bottom: 20, left: 12 };

// Hand-rolled SVG line chart — no charting library, consistent with this
// app's no-build-step/no-external-deps stance (same spirit as
// heatmap.js's own buildGradient()). Below 2 entries there's nothing to
// draw a line between, so those get an .empty-state message instead.
function renderWeightTrend() {
  const entries = loadWeightEntries().slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  weightView.innerHTML = '';

  if (entries.length < 2) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = entries.length === 0
      ? 'No weight logged yet — check in from Settings → Profile.'
      : 'Log one more weigh-in to see a trend.';
    weightView.appendChild(empty);
    return;
  }

  const values = entries.map((entry) => convertKgToUnit(entry.weight, currentUnit));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1; // avoid a divide-by-zero if every entry is identical

  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const points = entries.map((entry, i) => ({
    x: CHART_PADDING.left + (i / (entries.length - 1)) * plotWidth,
    y: CHART_PADDING.top + (1 - (convertKgToUnit(entry.weight, currentUnit) - minVal) / valRange) * plotHeight,
    entry,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const circles = points.map((p) => `<circle class="weight-trend-point" cx="${p.x}" cy="${p.y}" r="2.5" />`).join('');
  const latest = entries[entries.length - 1];

  weightView.innerHTML = `
    <svg class="weight-trend-svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
      <text class="weight-trend-label" x="${CHART_PADDING.left}" y="${CHART_PADDING.top - 4}">${maxVal} ${currentUnit}</text>
      <text class="weight-trend-label" x="${CHART_PADDING.left}" y="${CHART_HEIGHT - CHART_PADDING.bottom + 10}">${minVal} ${currentUnit}</text>
      <polyline class="weight-trend-line" points="${polylinePoints}" />
      ${circles}
      <text class="weight-trend-label" x="${points[0].x}" y="${CHART_HEIGHT - 4}">${formatDate(entries[0].date)}</text>
      <text class="weight-trend-label" x="${points[points.length - 1].x}" y="${CHART_HEIGHT - 4}" text-anchor="end">${formatDate(entries[entries.length - 1].date)}</text>
    </svg>
    <p class="profile-weight-current">Latest: ${convertKgToUnit(latest.weight, currentUnit)} ${currentUnit} (${formatDate(latest.date)})</p>
  `;
}
