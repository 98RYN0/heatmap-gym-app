// Exercise library screen — renders the list, wires search + filter pills,
// and drives the detail bottom sheet ("Add to session" hands off to log.js
// via the onAdd callback passed into initExercises, so this module doesn't
// need to know log.js exists).

import { capitalize } from './utils.js';

// DOM refs are queried once at module load and reused — the elements
// themselves never change, only their contents/classes.
const exerciseList = document.querySelector('.exercise-list');
const searchInput = document.querySelector('.search-input');
const filterPills = document.querySelectorAll('.filter-pill');

const sheet = document.getElementById('exercise-detail-sheet');
const sheetTitle = sheet.querySelector('.sheet-title');
const sheetSubtitle = sheet.querySelector('.sheet-subtitle');
const muscleRoleList = sheet.querySelector('.muscle-role-list');
const sheetAddBtn = sheet.querySelector('.sheet-add-btn');
const sheetCloseBtn = sheet.querySelector('.sheet-close');
const sheetBackdrop = sheet.querySelector('.sheet-backdrop');

let exercises = [];
let activeFilter = 'all';
let onAddToSession = null; // callback supplied by app.js, ultimately log.js's addExerciseToSession
let sheetExercise = null; // the exercise currently shown in the open sheet, if any

// Called once from app.js after the exercise database has loaded.
export function initExercises(exerciseData, { onAdd } = {}) {
  exercises = exerciseData;
  onAddToSession = onAdd || null;

  renderExercises(exercises);

  searchInput.addEventListener('input', () => renderExercises(getFilteredExercises()));
  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      activeFilter = pill.dataset.muscle;
      filterPills.forEach((p) => p.classList.toggle('active', p === pill));
      renderExercises(getFilteredExercises());
    });
  });

  // Delegated click listener: the <li> elements are created dynamically by
  // renderExercises(), so listening on the static parent <ul> catches
  // clicks on any of them, including ones that didn't exist at page load.
  exerciseList.addEventListener('click', (e) => {
    const item = e.target.closest('li');
    if (!item || !item.dataset.exerciseId) return;
    const exercise = exercises.find((ex) => ex.id === item.dataset.exerciseId);
    if (exercise) openSheet(exercise);
  });

  sheetBackdrop.addEventListener('click', closeSheet);
  sheetCloseBtn.addEventListener('click', closeSheet);
  sheetAddBtn.addEventListener('click', () => {
    if (sheetExercise && onAddToSession) onAddToSession(sheetExercise);
    closeSheet();
  });
}

function matchesFilter(exercise) {
  if (activeFilter === 'all') return true;
  return exercise.muscleGroup === activeFilter;
}

// Search and filter always apply together — an exercise has to pass both.
function getFilteredExercises() {
  const term = searchInput.value.toLowerCase();
  return exercises.filter(
    (exercise) => exercise.name.toLowerCase().includes(term) && matchesFilter(exercise)
  );
}

// Re-renders the whole list from scratch. Simple and fast enough at this
// list size (~150 exercises) — no need for a diffing/patch approach.
function renderExercises(list) {
  exerciseList.innerHTML = '';

  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No exercises match';
    exerciseList.appendChild(li);
    return;
  }

  list.forEach((exercise) => {
    const li = document.createElement('li');
    li.dataset.exerciseId = exercise.id; // lets the delegated click handler map back to the exercise object
    li.innerHTML = `
      <span class="exercise-name">${exercise.name}</span>
      <span class="exercise-meta">${exercise.muscleGroup}</span>
    `;
    exerciseList.appendChild(li);
  });
}

// Populates and opens the bottom sheet for one exercise: name, category/
// equipment, and its bias muscles ranked by emphasis (highest first) with
// each shown as a percentage of the exercise's total effort.
function openSheet(exercise) {
  sheetExercise = exercise;
  sheetTitle.textContent = exercise.name;
  // muscleGroup is already shown in the list row — category can equal it
  // verbatim for Legs/Core (e.g. "Legs · Legs"), so it's left out here.
  sheetSubtitle.textContent = `${capitalize(exercise.category)} · ${exercise.equipment.map(capitalize).join(', ')}`;

  muscleRoleList.innerHTML = '';
  const rankedBias = [...exercise.bias].sort((a, b) => b.emphasis - a.emphasis);
  rankedBias.forEach(({ muscle, emphasis }) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="muscle-role-tag">${Math.round(emphasis * 100)}%</span><span>${muscle}</span>`;
    muscleRoleList.appendChild(li);
  });

  sheet.classList.add('open');
}

function closeSheet() {
  sheet.classList.remove('open');
}
