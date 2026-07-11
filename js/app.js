// Orchestrator — nav/tab switching, kicks off the other modules.
//
// This is the only file that knows about all the other modules. Each of
// exercises.js/log.js/heatmap.js/history.js owns one screen and exposes an
// init function; app.js wires them together and hands out `switchTab` so
// any module can navigate (e.g. Finish workout jumping back to Heatmap).

import { loadExercises, requestPersistentStorage } from './data.js';
import { initExercises } from './exercises.js';
import { initLog, addExerciseToSession } from './log.js';
import { initHeatmap, paintHeatmap } from './heatmap.js';
import { initHistory, refreshHistory } from './history.js';

const navButtons = document.querySelectorAll('.nav-item');
const screens = document.querySelectorAll('.screen');

// Shows the screen whose data-screen matches targetName and hides the rest,
// keeping the bottom-nav highlight in sync. Every module that needs to
// navigate (e.g. "Add exercise" -> Exercises tab) is handed this function
// rather than importing it, so there's a single source of truth for nav state.
function switchTab(targetName) {
  screens.forEach((screen) => {
    screen.classList.toggle('active', screen.dataset.screen === targetName);
  });
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === targetName);
  });
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.target));
});

// The Heatmap screen's own CTA — a shortcut to the same Log tab the bottom
// nav already reaches, so it just needs the same switchTab call.
document.getElementById('log-workout-cta').addEventListener('click', () => switchTab('log'));

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

// Everything downstream needs the exercise database, so it's loaded first
// and passed into each module's init function rather than each module
// fetching it separately.
async function bootstrap() {
  const exercises = await loadExercises();

  initExercises(exercises, { onAdd: addExerciseToSession });
  // onQuickAdd reuses the exact same "add to session" action as the
  // Exercise library's detail sheet — tapping a heatmap region's
  // suggestion behaves identically to tapping "Add to session" there.
  await initHeatmap(exercises, { onQuickAdd: addExerciseToSession }); // awaited: it fetches + injects the body SVGs before first paint
  initHistory(exercises, {
    // Importing a backup replaces the logs the heatmap is computed from —
    // it needs the same repaint the Log screen's "Finish" triggers.
    onDataImported: paintHeatmap,
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
}

bootstrap();
