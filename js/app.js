// Orchestrator — nav/tab switching, kicks off the other modules.
//
// This is the only file that knows about all the other modules. Each of
// exercises.js/heatmap.js/history.js owns one screen and exposes an init
// function; log.js is the exception — it owns the in-progress session
// rather than a screen of its own, rendering into a section of the
// Exercises screen and into the persistent session bar (see log.js's own
// comment). app.js wires everything together and hands out `switchTab` so
// any module can navigate (e.g. Finish workout jumping back to Heatmap).

import { loadExercises, requestPersistentStorage, loadBodyModel, saveBodyModel } from './data.js';
import { initExercises, setMiniHeatmapGender } from './exercises.js';
import { initLog, addExerciseToSession, updateSessionBar } from './log.js';
import { initHeatmap, paintHeatmap, setGender } from './heatmap.js';
import { initHistory, refreshHistory } from './history.js';

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

// Which body model (js/vendor/body-highlighter.js's `gender` option)
// paints the Heatmap screen and the exercise detail sheet's mini
// heatmap — both need to agree, so it's read once here rather than each
// module tracking its own copy. The toggle-pill lives on the Settings
// screen (see index.html) — this query isn't scoped to any one screen,
// so it kept working unchanged when the toggle moved there from the
// Heatmap topbar.
const bodyModelToggle = document.querySelector('[data-toggle="body-model"]');
const bodyModelOptions = bodyModelToggle.querySelectorAll('.toggle-option');

function setBodyModelActiveButton(gender) {
  bodyModelOptions.forEach((button) => {
    button.classList.toggle('active', button.dataset.value === gender);
  });
}

// Reflects the saved preference immediately, without waiting on the rest
// of bootstrap() (which needs the exercise database first) — this is
// just a class toggle, no highlighter dependency.
setBodyModelActiveButton(loadBodyModel());

// Everything downstream needs the exercise database, so it's loaded first
// and passed into each module's init function rather than each module
// fetching it separately.
async function bootstrap() {
  const exercises = await loadExercises();
  const gender = loadBodyModel();

  initExercises(exercises, { onAdd: addExerciseToSession, gender });
  // onQuickAdd reuses the exact same "add to session" action as the
  // Exercise library's detail sheet — tapping a heatmap region's
  // suggestion behaves identically to tapping "Add to session" there.
  await initHeatmap(exercises, { onQuickAdd: addExerciseToSession, gender }); // awaited: it fetches + injects the body SVGs before first paint
  initHistory(exercises, {
    // Deleting a single log changes the data the heatmap is computed
    // from, so it needs the same repaint finishing a session triggers.
    onLogsChanged: paintHeatmap,
  });
  initLog(exercises, {
    switchTab,
    // Finishing a workout changes the data behind both the heatmap and
    // history, so both get told to refresh.
    onFinished: () => {
      paintHeatmap();
      refreshHistory();
    },
  });

  // Wired only after both highlighters exist above — clicking the toggle
  // before that (a narrow but real window during the initial exercises.json
  // fetch) would otherwise call setGender()/setMiniHeatmapGender() while
  // they're still null.
  bodyModelOptions.forEach((button) => {
    button.addEventListener('click', () => {
      const nextGender = button.dataset.value;
      setBodyModelActiveButton(nextGender);
      saveBodyModel(nextGender);
      setGender(nextGender);
      setMiniHeatmapGender(nextGender);
    });
  });
}

bootstrap();
