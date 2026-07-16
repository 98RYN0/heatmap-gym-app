// In-progress workout session — owns currentSession, rendering exercise
// cards with inline set-entry forms inside the Exercises screen's session
// section, plus the persistent session bar shown on other screens while a
// session is active. There's no separate "Log" screen or nav tab: tapping
// "Add to session" on any exercise adds it to currentSession and jumps to
// the Exercises screen, which shows the session section right above the
// library. See docs/decisions.md "Merge Log into Exercises."

import { addLog } from './data.js';
import { todayDateString, convertKgToUnit, convertUnitToKg } from './utils.js';

const sessionSection = document.getElementById('session-section');
const sessionList = document.querySelector('.session-list');
const finishBtn = document.getElementById('finish-session-btn');
const sessionBar = document.getElementById('session-bar');
const sessionBarText = sessionBar.querySelector('.session-bar-text');

let exercisesById = new Map(); // built once from the exercise list for O(1) lookups while rendering
let currentSession = { exercises: [] };
let switchTabFn = null; // injected from app.js so this module can navigate without importing app.js
let onFinished = null; // callback app.js uses to repaint the heatmap/history after a session is saved
let currentUnit = 'kg'; // display/entry unit for weight — storage is always kg, see js/utils.js
// At most one set across the whole session can be mid-edit at a time —
// tracked by object reference (which exercise entry, which index into its
// sets array) rather than a per-card flag, since cards are thrown away and
// rebuilt on every renderSession() call anyway.
let editingSet = null; // { entry, index } | null

export function initLog(exercises, { switchTab, onFinished: onFinishedCb, unit } = {}) {
  exercisesById = new Map(exercises.map((ex) => [ex.id, ex]));
  switchTabFn = switchTab;
  onFinished = onFinishedCb;
  if (unit) currentUnit = unit;

  finishBtn.addEventListener('click', finishSession);
  sessionBar.addEventListener('click', () => switchTabFn('exercises'));

  renderSession();
}

// Called from app.js when the Settings screen's Units toggle changes.
// Re-renders immediately so an active session's displayed weights (and
// the add-set form's placeholder) reflect the new unit right away,
// rather than waiting for the next unrelated re-render.
export function setUnit(unit) {
  currentUnit = unit;
  renderSession();
}

// Called by exercises.js (via the onAdd callback) when the user taps
// "Add to session" in the exercise detail sheet.
export function addExerciseToSession(exercise) {
  currentSession.exercises.push({ exerciseId: exercise.id, sets: [] });
  renderSession();
  if (switchTabFn) switchTabFn('exercises');
}

// Re-renders the session section from currentSession, and keeps the
// Finish button + session bar in sync with it. Called after every change
// (add/remove exercise, add/edit/remove set, finish) rather than patching
// the DOM in place — the session is small, so a full re-render stays
// cheap and keeps the rendering logic in one place.
function renderSession() {
  const isEmpty = currentSession.exercises.length === 0;
  sessionSection.classList.toggle('hidden', isEmpty);
  finishBtn.hidden = isEmpty;

  sessionList.innerHTML = '';
  currentSession.exercises.forEach((entry) => {
    sessionList.appendChild(buildExerciseCard(entry));
  });

  updateSessionBar();
}

// Shows/hides the persistent session bar (index.html, fixed above the
// bottom nav) and keeps its text current. Visible whenever there's a
// session to return to and you're not already looking at it — exported so
// app.js's switchTab() can also call this after a plain navigation (e.g.
// landing on Exercises should hide the bar immediately, even though the
// session itself didn't change).
export function updateSessionBar() {
  const count = currentSession.exercises.length;
  const activeScreen = document.querySelector('.screen.active')?.dataset.screen;
  const shouldShow = count > 0 && activeScreen !== 'exercises';

  sessionBar.classList.toggle('hidden', !shouldShow);
  if (shouldShow) {
    sessionBarText.textContent = `Session in progress · ${count} exercise${count === 1 ? '' : 's'}`;
  }
}

// Builds one <li class="exercise-card"> — the exercise's logged sets so
// far, plus an inline reps/weight/RPE form to add another.
function buildExerciseCard(entry) {
  const exercise = exercisesById.get(entry.exerciseId);
  // Bodyweight exercises (Push-Up, Pull-Up, Plank, ...) have no meaningful
  // load to log — weight is left out of the add-set form and the per-set
  // edit form alike, so sets for these exercises never get a `weight`
  // field at all (see buildSetRowHTML() below for the display side).
  const isBodyweight = exercise.equipment.includes('bodyweight');

  const li = document.createElement('li');
  li.className = 'exercise-card';
  li.innerHTML = `
    <div class="exercise-card-header">
      <div class="exercise-card-title">
        <span class="exercise-name">${exercise.name}</span>
        <span class="exercise-meta">${exercise.muscleGroup}</span>
      </div>
      <button class="remove-exercise-btn icon-button" aria-label="Remove exercise" title="Remove exercise">✕</button>
    </div>
    <div class="set-rows">
      ${entry.sets.map((set, i) => buildSetRowHTML(entry, isBodyweight, i)).join('')}
    </div>
    <div class="set-form">
      <input type="number" class="set-input" data-field="reps" placeholder="Reps" min="0">
      ${isBodyweight ? '' : `<input type="number" class="set-input" data-field="weight" placeholder="${currentUnit}" min="0" step="0.5">`}
      <input type="number" class="set-input" data-field="rpe" placeholder="RPE" min="1" max="10">
      <button class="add-set-btn">+ Add set</button>
    </div>
  `;

  const repsInput = li.querySelector('[data-field="reps"]');
  const weightInput = li.querySelector('[data-field="weight"]'); // null for bodyweight exercises
  const rpeInput = li.querySelector('[data-field="rpe"]');

  // Drops the exercise (and any sets already logged for it) from the
  // in-progress session — for correcting an accidental add before Finish,
  // not the same thing as History's delete-a-saved-log flow (data.js's
  // deleteLog), which operates on already-persisted logs. No confirm()
  // here: nothing's been saved yet, so there's nothing destructive to guard.
  li.querySelector('.remove-exercise-btn').addEventListener('click', () => {
    currentSession.exercises = currentSession.exercises.filter((e) => e !== entry);
    if (editingSet && editingSet.entry === entry) editingSet = null; // was mid-edit on a set that just left with the exercise
    renderSession();
  });

  // This card gets thrown away and rebuilt on every renderSession() call,
  // so this listener is safe to attach fresh each time — no risk of
  // stacking duplicate listeners on a stale element.
  li.querySelector('.add-set-btn').addEventListener('click', () => {
    // Weight is only required when there's a weight field to fill in.
    if (!repsInput.value || !rpeInput.value || (weightInput && !weightInput.value)) return;
    const set = {
      reps: Number(repsInput.value),
      rpe: Number(rpeInput.value),
    };
    if (weightInput) set.weight = convertUnitToKg(weightInput.value, currentUnit);
    entry.sets.push(set);
    renderSession(); // re-render clears the inputs and shows the new set row
  });

  // One delegated listener covers every set row's duplicate/edit/save/
  // cancel/remove button — same pattern as history.js's list delegation —
  // rather than attaching a listener per button per row.
  li.querySelector('.set-rows').addEventListener('click', (e) => {
    const row = e.target.closest('.set-row');
    if (!row) return;
    const index = Number(row.dataset.setIndex);

    if (e.target.closest('.duplicate-set-btn')) {
      entry.sets.splice(index + 1, 0, { ...entry.sets[index] });
      renderSession();
    } else if (e.target.closest('.edit-set-btn')) {
      editingSet = { entry, index };
      renderSession();
    } else if (e.target.closest('.remove-set-btn')) {
      entry.sets.splice(index, 1);
      if (editingSet && editingSet.entry === entry && editingSet.index === index) editingSet = null;
      renderSession();
    } else if (e.target.closest('.cancel-edit-btn')) {
      editingSet = null;
      renderSession();
    } else if (e.target.closest('.save-set-btn')) {
      const repsVal = row.querySelector('[data-edit-field="reps"]').value;
      const rpeVal = row.querySelector('[data-edit-field="rpe"]').value;
      const editWeightInput = row.querySelector('[data-edit-field="weight"]');
      if (!repsVal || !rpeVal || (editWeightInput && !editWeightInput.value)) return;
      const updated = { reps: Number(repsVal), rpe: Number(rpeVal) };
      if (editWeightInput) updated.weight = convertUnitToKg(editWeightInput.value, currentUnit);
      entry.sets[index] = updated;
      editingSet = null;
      renderSession();
    }
  });

  return li;
}

// One logged set's row within the active session: either its normal
// display form (reps/weight/RPE text + duplicate/edit/remove icons), or,
// if it's the one set currently being edited, an inline form pre-filled
// with its current values. Unlike utils.js's formatSetRow() (used by the
// read-only History detail sheet), this one is interactive and specific
// to the in-progress session, so it stays local to this module.
function buildSetRowHTML(entry, isBodyweight, index) {
  const set = entry.sets[index];

  if (editingSet && editingSet.entry === entry && editingSet.index === index) {
    return `
      <div class="set-row set-row-editing" data-set-index="${index}">
        <input type="number" class="set-input" data-edit-field="reps" value="${set.reps}" min="0">
        ${isBodyweight ? '' : `<input type="number" class="set-input" data-edit-field="weight" value="${convertKgToUnit(set.weight, currentUnit)}" min="0" step="0.5">`}
        <input type="number" class="set-input" data-edit-field="rpe" value="${set.rpe}" min="1" max="10">
        <button class="set-action-btn save-set-btn" aria-label="Save set" title="Save set">✓</button>
        <button class="set-action-btn cancel-edit-btn" aria-label="Cancel edit" title="Cancel edit">✕</button>
      </div>
    `;
  }

  return `
    <div class="set-row" data-set-index="${index}">
      <span>#${index + 1}</span>
      <span>${set.reps} reps</span>
      ${set.weight != null ? `<span>${convertKgToUnit(set.weight, currentUnit)} ${currentUnit}</span>` : ''}
      <span>RPE ${set.rpe}</span>
      <span class="set-row-actions">
        <button class="set-action-btn duplicate-set-btn" aria-label="Duplicate set" title="Duplicate set">⧉</button>
        <button class="set-action-btn edit-set-btn" aria-label="Edit set" title="Edit set">✎</button>
        <button class="set-action-btn remove-set-btn" aria-label="Remove set" title="Remove set">✕</button>
      </span>
    </div>
  `;
}

// Persists the session, resets state, and hands control back to the
// heatmap — the natural "you just trained, here's the payoff" moment.
function finishSession() {
  if (currentSession.exercises.length === 0) return; // nothing to save

  currentSession.id = crypto.randomUUID(); // needed to view/delete this specific log later (History screen)
  currentSession.date = todayDateString();
  addLog(currentSession);
  currentSession = { exercises: [] };
  editingSet = null;
  renderSession();

  if (onFinished) onFinished(); // repaints heatmap + history with the new data
  if (switchTabFn) switchTabFn('heatmap');
}
