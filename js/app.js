// Orchestrator — nav/tab switching, kicks off the other modules.
//
// This is the only file that knows about all the other modules. Each of
// exercises.js/heatmap.js/history.js owns one screen and exposes an init
// function; log.js is the exception — it owns the in-progress session
// rather than a screen of its own, rendering into a section of the
// Exercises screen and into the persistent session bar (see log.js's own
// comment). app.js wires everything together and hands out `switchTab` so
// any module can navigate (e.g. Finish workout jumping back to Heatmap).

import { loadExercises, requestPersistentStorage, loadProfile, loadUnit, saveUnit, loadTheme, saveTheme } from './data.js';
import { initExercises, setMiniHeatmapGender, setTheme as setExercisesTheme } from './exercises.js';
import { initLog, addExerciseToSession, updateSessionBar, setUnit as setLogUnit } from './log.js';
import { initHeatmap, paintHeatmap, setGender, setTheme as setHeatmapTheme, refreshGreeting } from './heatmap.js';
import { initHistory, refreshHistory, setUnit as setHistoryUnit, selectHistoryView } from './history.js';
import { initProfile, setUnit as setProfileUnit } from './profile.js';

const navButtons = document.querySelectorAll('.nav-item');
const screens = document.querySelectorAll('.screen');

// Shows the screen whose data-screen matches targetName and hides the rest,
// keeping the bottom-nav highlight in sync. Every module that needs to
// navigate (e.g. adding an exercise -> Exercises screen) is handed this
// function rather than importing it, so there's a single source of truth
// for nav state. There's no "log" target — that screen was merged into
// Exercises (see docs/decisions.md "Merge Log into Exercises").
function switchTab(targetName) {
  screens.forEach((screen) => {
    screen.classList.toggle('active', screen.dataset.screen === targetName);
  });
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === targetName);
  });
  // A plain navigation can change whether the session bar should be
  // showing (e.g. landing on Exercises hides it) even though the session
  // itself didn't change.
  updateSessionBar();
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.target));
});

// The Heatmap screen's own CTA — jumps to the Exercises screen, which
// shows the current session (if any) right above the library either way,
// so this doesn't need to special-case "start a new session" vs.
// "continue the existing one."
document.getElementById('log-workout-cta').addEventListener('click', () => switchTab('exercises'));

// The session bar and bottom nav are stacked inside one fixed-position
// wrapper (see index.html's .bottom-chrome) so the bar always sits right
// above the nav regardless of either one's height — but .screens still
// needs to know that combined height to pad its scrollable content
// correctly, kept in a --bottom-chrome-height custom property rather than
// another manual px guess like the last two times this number had to be
// bumped. Two observers feed it, for two different reasons:
//   - ResizeObserver: the general case (viewport/orientation changes,
//     anything that reflows the nav itself).
//   - MutationObserver on the session bar's class: ResizeObserver's
//     callback is tied to the rendering pipeline, which browsers throttle
//     for backgrounded/inactive tabs — verified live where a show/hide
//     toggle on the bar produced zero ResizeObserver callbacks. A
//     MutationObserver's callback is a microtask, not subject to that
//     throttling, so it reliably catches the one thing in this app that
//     actually changes the wrapper's height: the bar's own hidden toggle.
const bottomChrome = document.querySelector('.bottom-chrome');
const sessionBarEl = document.getElementById('session-bar');
function syncBottomChromeHeight() {
  document.documentElement.style.setProperty('--bottom-chrome-height', `${bottomChrome.offsetHeight}px`);
}
new ResizeObserver(syncBottomChromeHeight).observe(bottomChrome);
new MutationObserver(syncBottomChromeHeight).observe(sessionBarEl, { attributes: true, attributeFilter: ['class'] });
syncBottomChromeHeight(); // set an initial value now rather than waiting for either observer's first async callback

// Registering a service worker (even one that does nothing but pass
// requests through, see sw.js) is what makes the app installable to a
// homescreen — the main lever for the browser treating this origin's
// storage as persistent rather than evictable. Feature-detected: older
// browsers just skip this and fall back to whatever storage.persist()
// below manages to do.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Not fatal — the app works the same without it, just without the
    // installability/persistence benefit.
  });
}

requestPersistentStorage();

// Same instant-save-on-click pattern used by every Settings toggle, for
// the kg/lbs weight preference (see js/utils.js's convertKgToUnit/
// convertUnitToKg).
const weightUnitToggle = document.querySelector('[data-toggle="weight-unit"]');
const weightUnitOptions = weightUnitToggle.querySelectorAll('.toggle-option');

function setWeightUnitActiveButton(unit) {
  weightUnitOptions.forEach((button) => {
    button.classList.toggle('active', button.dataset.value === unit);
  });
}

setWeightUnitActiveButton(loadUnit());

// Same pattern again, for the dark/light theme. Unlike the two toggles
// above, this one also needs to actually apply a DOM change beyond its
// own button state — index.html's inline anti-flash <head> script
// already set data-theme before any of this ran (if the saved
// preference is light), so applyTheme() here mostly just re-affirms it
// and keeps <meta name="theme-color"> (the browser chrome tint) in sync.
// manifest.json's own theme_color/background_color stay fixed on the
// dark values — those only govern the installed PWA's splash screen
// before any JS runs, which can't be made per-user without a dynamic
// manifest; accepted as a known, cosmetic-only limitation.
const themeToggle = document.querySelector('[data-toggle="theme"]');
const themeOptions = themeToggle.querySelectorAll('.toggle-option');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function setThemeActiveButton(theme) {
  themeOptions.forEach((button) => {
    button.classList.toggle('active', button.dataset.value === theme);
  });
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
  themeColorMeta.content = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
}

const initialTheme = loadTheme();
setThemeActiveButton(initialTheme);
applyTheme(initialTheme);

// Everything downstream needs the exercise database, so it's loaded first
// and passed into each module's init function rather than each module
// fetching it separately.
async function bootstrap() {
  const exercises = await loadExercises();
  const profile = loadProfile();
  const gender = profile.gender;
  const unit = loadUnit();

  initExercises(exercises, { onAdd: addExerciseToSession, gender });
  // onQuickAdd reuses the exact same "add to session" action as the
  // Exercise library's detail sheet — tapping a heatmap region's
  // suggestion behaves identically to tapping "Add to session" there.
  await initHeatmap(exercises, { onQuickAdd: addExerciseToSession, gender }); // awaited: it fetches + injects the body SVGs before first paint
  initHistory(exercises, {
    // Deleting a single log changes the data the heatmap is computed
    // from, so it needs the same repaint finishing a session triggers.
    onLogsChanged: paintHeatmap,
    unit,
  });
  initLog(exercises, {
    switchTab,
    // Finishing a workout changes the data behind both the heatmap and
    // history, so both get told to refresh.
    onFinished: () => {
      paintHeatmap();
      refreshHistory();
    },
    unit,
  });

  // Wired only after both highlighters exist above — a gender change from
  // the sheet before that (a narrow but real window during the initial
  // exercises.json fetch) would otherwise call setGender()/
  // setMiniHeatmapGender() while they're still null. Gender used to be
  // its own standalone Settings toggle, wired the same way, right here —
  // the Profile sheet (js/profile.js) absorbed it, see docs/decisions.md
  // "Profile."
  initProfile({
    unit,
    onProfileChanged: (nextProfile) => {
      setGender(nextProfile.gender);
      setMiniHeatmapGender(nextProfile.gender);
      refreshGreeting();
      refreshHistory(); // picks up a new weight entry if History's Weight tab is open
    },
    onViewTrend: () => {
      switchTab('history');
      selectHistoryView('weight');
    },
  });

  weightUnitOptions.forEach((button) => {
    button.addEventListener('click', () => {
      const nextUnit = button.dataset.value;
      setWeightUnitActiveButton(nextUnit);
      saveUnit(nextUnit);
      setLogUnit(nextUnit);
      setHistoryUnit(nextUnit);
      setProfileUnit(nextUnit);
    });
  });

  // Also wired only after both highlighters exist — setHeatmapTheme()/
  // setExercisesTheme() push the new colours onto them directly.
  themeOptions.forEach((button) => {
    button.addEventListener('click', () => {
      const nextTheme = button.dataset.value;
      setThemeActiveButton(nextTheme);
      saveTheme(nextTheme);
      applyTheme(nextTheme);
      setHeatmapTheme();
      setExercisesTheme();
    });
  });
}

bootstrap();
