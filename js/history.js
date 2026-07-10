// History screen — a reverse-chronological list and a month calendar, both
// derived from the same localStorage logs (no separate data source).

import { loadLogs } from './data.js';
import { capitalize, todayDateString } from './utils.js';

const listView = document.querySelector('.history-view[data-view="list"]');
const calendarView = document.querySelector('.history-view[data-view="calendar"]');
const toggleButtons = document.querySelectorAll('[data-toggle="history-view"] .toggle-option');
const monthLabel = document.querySelector('.calendar-month-label');
const calendarGrid = document.querySelector('.calendar-grid');
const prevBtn = document.getElementById('cal-prev');
const nextBtn = document.getElementById('cal-next');

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday-start, matches renderCalendar()'s startDay math

let exercises = [];
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed (0 = January), same as the Date API

// Called once from app.js.
export function initHistory(exerciseData) {
  exercises = exerciseData;

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
      calMonth = 11; // wrap Jan -> Dec of the previous year
      calYear -= 1;
    }
    renderCalendar();
  });

  nextBtn.addEventListener('click', () => {
    calMonth += 1;
    if (calMonth > 11) {
      calMonth = 0; // wrap Dec -> Jan of the next year
      calYear += 1;
    }
    renderCalendar();
  });

  renderHistoryList();
}

// Called by log.js after a session is saved, so History reflects the new
// entry immediately without waiting for the user to leave and come back.
export function refreshHistory() {
  renderHistoryList();
  if (calendarView.classList.contains('active')) renderCalendar();
}

// "Push day · 3 exercises" if every exercise in the session shares one
// category, otherwise a generic "Mixed session" label.
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
    entry.innerHTML = `
      <p class="history-date">${formatDate(log.date)}</p>
      <p class="history-summary">${sessionLabel(log)}</p>
    `;
    listView.appendChild(entry);
  });
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
