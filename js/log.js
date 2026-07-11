// Log workout screen — owns the in-progress session, rendering exercise
// cards with inline set-entry forms, and finishing a session out to storage.
//
// There's no "browsing vs actively adding" mode: tapping "Add to session"
// on any exercise always adds it to the current session and jumps to this
// tab. That's simpler than tracking a separate flag and still supports the
// "+ Add exercise" -> Exercises tab -> pick one -> back here flow.

import { addLog } from './data.js';
import { todayDateString } from './utils.js';

const sessionList = document.querySelector('.session-list');
const addExerciseBtn = document.getElementById('add-exercise-btn');
const finishBtn = document.getElementById('finish-session-btn');

let exercisesById = new Map(); // built once from the exercise list for O(1) lookups while rendering
let currentSession = { exercises: [] };
let switchTabFn = null; // injected from app.js so this module can navigate without importing app.js
let onFinished = null; // callback app.js uses to repaint the heatmap/history after a session is saved

export function initLog(exercises, { switchTab, onFinished: onFinishedCb } = {}) {
  exercisesById = new Map(exercises.map((ex) => [ex.id, ex]));
  switchTabFn = switchTab;
  onFinished = onFinishedCb;

  addExerciseBtn.addEventListener('click', () => switchTabFn('exercises'));
  finishBtn.addEventListener('click', finishSession);

  renderSession();
}

// Called by exercises.js (via the onAdd callback) when the user taps
// "Add to session" in the exercise detail sheet.
export function addExerciseToSession(exercise) {
  currentSession.exercises.push({ exerciseId: exercise.id, sets: [] });
  renderSession();
  if (switchTabFn) switchTabFn('log');
}

// Re-renders the whole session list from currentSession. Called after every
// change (add exercise, add set, finish) rather than patching the DOM
// in place — the session is small, so a full re-render stays cheap and
// keeps the rendering logic in one place.
function renderSession() {
  sessionList.innerHTML = '';

  if (currentSession.exercises.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No exercises added yet';
    sessionList.appendChild(li);
    return;
  }

  currentSession.exercises.forEach((entry) => {
    sessionList.appendChild(buildExerciseCard(entry));
  });
}

// Builds one <li class="exercise-card"> — the exercise's logged sets so
// far, plus an inline reps/weight/RPE form to add another.
function buildExerciseCard(entry) {
  const exercise = exercisesById.get(entry.exerciseId);

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
      ${entry.sets
        .map(
          (set, i) => `
        <div class="set-row"><span>#${i + 1}</span><span>${set.reps} reps</span><span>${set.weight} kg</span><span>RPE ${set.rpe}</span></div>
      `
        )
        .join('')}
    </div>
    <div class="set-form">
      <input type="number" class="set-input" data-field="reps" placeholder="Reps" min="0">
      <input type="number" class="set-input" data-field="weight" placeholder="kg" min="0" step="0.5">
      <input type="number" class="set-input" data-field="rpe" placeholder="RPE" min="1" max="10">
      <button class="add-set-btn">+ Add set</button>
    </div>
  `;

  const repsInput = li.querySelector('[data-field="reps"]');
  const weightInput = li.querySelector('[data-field="weight"]');
  const rpeInput = li.querySelector('[data-field="rpe"]');

  // Drops the exercise (and any sets already logged for it) from the
  // in-progress session — for correcting an accidental add before Finish,
  // not the same thing as History's delete-a-saved-log flow (data.js's
  // deleteLog), which operates on already-persisted logs. No confirm()
  // here: nothing's been saved yet, so there's nothing destructive to guard.
  li.querySelector('.remove-exercise-btn').addEventListener('click', () => {
    currentSession.exercises = currentSession.exercises.filter((e) => e !== entry);
    renderSession();
  });

  // This card gets thrown away and rebuilt on every renderSession() call,
  // so this listener is safe to attach fresh each time — no risk of
  // stacking duplicate listeners on a stale element.
  li.querySelector('.add-set-btn').addEventListener('click', () => {
    if (!repsInput.value || !weightInput.value || !rpeInput.value) return; // require all three fields
    entry.sets.push({
      reps: Number(repsInput.value),
      weight: Number(weightInput.value),
      rpe: Number(rpeInput.value),
    });
    renderSession(); // re-render clears the inputs and shows the new set row
  });

  return li;
}

// Persists the session, resets state, and hands control back to the
// heatmap — the natural "you just trained, here's the payoff" moment.
function finishSession() {
  if (currentSession.exercises.length === 0) return; // nothing to save

  currentSession.id = crypto.randomUUID(); // needed to view/delete this specific log later (History screen)
  currentSession.date = todayDateString();
  addLog(currentSession);
  currentSession = { exercises: [] };
  renderSession();

  if (onFinished) onFinished(); // repaints heatmap + history with the new data
  if (switchTabFn) switchTabFn('heatmap');
}
