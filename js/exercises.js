// Exercise library screen — renders the list, wires search + filter pills,
// and drives the detail bottom sheet ("Add to session" hands off to log.js
// via the onAdd callback passed into initExercises, so this module doesn't
// need to know log.js exists). The sheet also paints a mini per-exercise
// heatmap (paintMiniHeatmap() below) — same body-highlighter library and
// colour gradient as the main Heatmap screen, but driven purely by this
// one exercise's own bias data, not training history.

import createBodyHighlighter from './vendor/body-highlighter.js';
import { capitalize } from './utils.js';
import { getThermalGradient, buildLibraryData } from './heatmap.js';
import { MUSCLE_TO_REGIONS } from './muscle-taxonomy.js';

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
const miniFrontContainer = sheet.querySelector('.mini-body-view[data-view="front"]');
const miniBackContainer = sheet.querySelector('.mini-body-view[data-view="back"]');

let exercises = [];
let activeFilter = 'all';
let onAddToSession = null; // callback supplied by app.js, ultimately log.js's addExerciseToSession
let sheetExercise = null; // the exercise currently shown in the open sheet, if any
let miniFrontHighlighter = null;
let miniBackHighlighter = null;
let bodyColorRgbString = ''; // set alongside the highlighters — see zoomToHighlighted()
let currentGender = 'male';

// Called once from app.js after the exercise database has loaded.
export function initExercises(exerciseData, { onAdd, gender } = {}) {
  exercises = exerciseData;
  onAddToSession = onAdd || null;
  currentGender = gender || 'male';

  // Same colour gradient the main Heatmap paints with (js/heatmap.js),
  // so a given shade means the same thing everywhere — only the data
  // feeding it differs (see paintMiniHeatmap()).
  const { bodyColor, bodyColorRgbString: rgbString, highlightedColors } = getThermalGradient();
  bodyColorRgbString = rgbString;
  const svgStyle = { width: '100%', height: 'auto' };

  miniFrontHighlighter = createBodyHighlighter({
    container: miniFrontContainer,
    type: 'anterior',
    gender: currentGender,
    bodyColor,
    highlightedColors,
    svgStyle,
  });
  miniBackHighlighter = createBodyHighlighter({
    container: miniBackContainer,
    type: 'posterior',
    gender: currentGender,
    bodyColor,
    highlightedColors,
    svgStyle,
  });

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

  // Must come before paintMiniHeatmap() — it measures rendered SVG
  // geometry (getBBox()), which returns a zero rect for anything inside
  // a display:none ancestor, and the sheet is display:none until .open
  // is applied.
  sheet.classList.add('open');
  paintMiniHeatmap(exercise);
}

function closeSheet() {
  sheet.classList.remove('open');
}

// Called by app.js when the body-model toggle changes. Just updates the
// remembered gender if no sheet is open (the next openSheet() will pick
// it up); if one's already open, repaints it immediately so switching
// models is visible right away rather than only on the next exercise.
export function setMiniHeatmapGender(gender) {
  currentGender = gender;
  if (sheetExercise) paintMiniHeatmap(sheetExercise);
}

// Rolls this exercise's bias muscles up into body-highlighter regions
// (same MUSCLE_TO_REGIONS table heat.js uses for the real heatmap) and
// paints both mini highlighters from that alone — no logs, no recency, no
// normalization against other exercises. Multiple bias muscles mapping to
// the same region sum together, same convention used everywhere else this
// rollup happens.
function paintMiniHeatmap(exercise) {
  const regionValues = {};
  exercise.bias.forEach(({ muscle, emphasis }) => {
    (MUSCLE_TO_REGIONS[muscle] || []).forEach((region) => {
      regionValues[region] = (regionValues[region] || 0) + emphasis;
    });
  });

  const libraryData = buildLibraryData(regionValues);
  // gender is re-sent on every paint (not just when it changes) since
  // this is also how a toggle change while the sheet is open takes
  // effect — see setMiniHeatmapGender().
  miniFrontHighlighter.update({ data: libraryData, gender: currentGender });
  miniBackHighlighter.update({ data: libraryData, gender: currentGender });

  zoomToHighlighted(miniFrontContainer);
  zoomToHighlighted(miniBackContainer);
}

// Crops an already-painted mini heatmap to just the muscles this exercise
// actually highlighted, instead of showing the full-body silhouette at a
// glance — the whole point of this being a "zoomed in" indicator. Finds
// the coloured shapes (anything not still at bodyColor — <polygon> for
// the male model, <path> for female, see js/vendor/body-highlighter.js),
// unions their bounding boxes with generous padding, and sets that as
// the SVG's own viewBox. Works for any exercise generically, tight crop
// for a single-muscle exercise, wider for one that spans more of the
// body. A view with nothing coloured (most exercises only touch one
// side) is hidden entirely rather than left showing an empty grey figure.
function zoomToHighlighted(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  const highlighted = Array.from(svg.querySelectorAll('polygon, path')).filter(
    (shape) => shape.style.fill && shape.style.fill !== bodyColorRgbString
  );

  if (highlighted.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  // Female shapes sit inside a transformed <g> (see FEMALE_VIEW_TRANSFORMS
  // in js/vendor/body-highlighter.js) — getBBox() alone returns a shape's
  // bounding box in its *own* local space, before that ancestor transform
  // is applied, which for female would be the raw untransformed source
  // coordinates (hundreds of units, not the ~100x200 target box). getCTM()
  // gives the matrix from that local space into the SVG's own user space,
  // accounting for every transform in between — applying it to each
  // shape's bbox corners gives the true post-transform box. For the male
  // model (no wrapping transform) this CTM is the identity, so the result
  // is identical to plain getBBox() — one code path handles both.
  const boxes = highlighted.map((shape) => {
    const bbox = shape.getBBox();
    const ctm = shape.getCTM();
    if (!ctm) return bbox;
    const corners = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    ].map((p) => ({
      x: ctm.a * p.x + ctm.c * p.y + ctm.e,
      y: ctm.b * p.x + ctm.d * p.y + ctm.f,
    }));
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  });

  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.3;

  svg.setAttribute(
    'viewBox',
    `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  );
}
