// Profile sheet — name, gender (which now also drives the body model —
// see docs/decisions.md "Profile"), and weight check-ins. Opened from a
// summary row on the Settings screen; owns that row's DOM too, the same
// way exercises.js/history.js own their own sheet-opening triggers even
// though the row and the sheet markup live in different <section>s of
// index.html (a module queries whatever selectors it needs, regardless
// of which screen they're nested under — same precedent).

import { loadProfile, saveProfile, loadWeightEntries, addWeightEntry } from './data.js';
import { convertKgToUnit, convertUnitToKg, todayDateString, formatDate } from './utils.js';

const profileRow = document.getElementById('profile-row');
const profileRowSummary = document.getElementById('profile-row-summary');

const sheet = document.getElementById('profile-sheet');
const sheetClose = sheet.querySelector('.sheet-close');
const sheetBackdrop = sheet.querySelector('.sheet-backdrop');
const nameInput = document.getElementById('profile-name-input');
const genderToggle = document.querySelector('[data-toggle="profile-gender"]');
const genderOptions = genderToggle.querySelectorAll('.toggle-option');
const weightCurrentEl = document.getElementById('profile-weight-current');
const weightInput = document.getElementById('profile-weight-input');
const logWeightBtn = document.getElementById('log-weight-btn');
const viewTrendBtn = document.getElementById('view-trend-btn');

let currentUnit = 'kg'; // display/entry unit for weight — storage is always kg, see js/utils.js
let onProfileChanged = null; // callback from app.js — repaints anything gender/name/weight affects elsewhere
let onViewTrend = null; // callback from app.js — jumps to History's Weight tab

export function initProfile({ unit, onProfileChanged: onProfileChangedCb, onViewTrend: onViewTrendCb } = {}) {
  if (unit) currentUnit = unit;
  onProfileChanged = onProfileChangedCb || null;
  onViewTrend = onViewTrendCb || null;

  updateRowSummary(loadProfile()); // the row itself is visible before the sheet's ever opened, so this needs to be correct immediately

  profileRow.addEventListener('click', openSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  sheetClose.addEventListener('click', closeSheet);

  // Instant-save on blur/Enter, no separate Save button — same
  // low-friction pattern the toggle-pills already use for everything else
  // on Settings.
  nameInput.addEventListener('change', handleNameChange);

  genderOptions.forEach((button) => {
    button.addEventListener('click', () => handleGenderChange(button.dataset.value));
  });

  logWeightBtn.addEventListener('click', handleLogWeight);
  viewTrendBtn.addEventListener('click', handleViewTrend);
}

// Called by app.js when the Settings screen's Units toggle changes —
// same live-repaint precedent as log.js/history.js.
export function setUnit(unit) {
  currentUnit = unit;
  weightInput.placeholder = currentUnit;
  renderWeightCurrent();
}

function updateRowSummary(profile) {
  profileRowSummary.textContent = profile.name || 'Set up your profile';
}

function setGenderActiveButton(gender) {
  genderOptions.forEach((button) => {
    button.classList.toggle('active', button.dataset.value === gender);
  });
}

// Repopulates every field fresh each time the sheet opens — cheap, and
// avoids the fields ever showing stale data if something changed the
// underlying profile/weight-entries elsewhere (nothing does today, but
// this is the same "read fresh on open" convention exercises.js's and
// history.js's own detail sheets already use).
function openSheet() {
  const profile = loadProfile();
  nameInput.value = profile.name;
  setGenderActiveButton(profile.gender);

  weightInput.value = '';
  weightInput.placeholder = currentUnit;
  renderWeightCurrent();

  sheet.classList.add('open');
}

function closeSheet() {
  sheet.classList.remove('open');
}

function renderWeightCurrent() {
  const entries = loadWeightEntries();
  if (entries.length === 0) {
    weightCurrentEl.textContent = 'No weight logged yet';
    return;
  }
  const latest = entries.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  weightCurrentEl.textContent = `${convertKgToUnit(latest.weight, currentUnit)} ${currentUnit} (logged ${formatDate(latest.date)})`;
}

function handleNameChange() {
  const profile = loadProfile();
  profile.name = nameInput.value.trim();
  saveProfile(profile);
  updateRowSummary(profile);
  if (onProfileChanged) onProfileChanged(profile);
}

function handleGenderChange(gender) {
  const profile = loadProfile();
  profile.gender = gender;
  saveProfile(profile);
  setGenderActiveButton(gender);
  if (onProfileChanged) onProfileChanged(profile);
}

// A distinct action from editing name/gender above — each click is a
// dated check-in (js/data.js's addWeightEntry(), which overwrites rather
// than duplicates if you've already logged one today), not just an
// edited field.
function handleLogWeight() {
  if (!weightInput.value) return;
  const kg = convertUnitToKg(weightInput.value, currentUnit);
  addWeightEntry(todayDateString(), kg);
  weightInput.value = '';
  renderWeightCurrent();
  // Nothing about the profile itself changed here, but this reuses the
  // same "something you can see elsewhere just changed" signal so
  // app.js can refresh History's Weight tab if it's currently open.
  if (onProfileChanged) onProfileChanged(loadProfile());
}

function handleViewTrend() {
  closeSheet();
  if (onViewTrend) onViewTrend();
}
