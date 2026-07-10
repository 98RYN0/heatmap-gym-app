// The anatomical muscle taxonomy — the one place that knows (a) which 6
// broad categories exercises get filed under for browsing, and (b) how a
// real muscle name in an exercise's `bias` list rolls up to the
// body-highlighter library's paintable SVG regions for the heatmap.
//
// Naming principle (see docs/decisions.md "Exercise database — muscleGroup
// + bias schema"): one bias entry per commonly-named muscle a lifter would
// recognize, not per muscle head — except deltoids (anterior/lateral/
// posterior) and glutes (maximus/medius), which are standard,
// commonly-programmed-for distinctions.

// The 6 categories used for exercise-library browsing/filtering
// (exercise.muscleGroup). Independent of the heatmap taxonomy below.
export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs'];

// Real muscle name -> body-highlighter region id(s) it paints. An array
// because a few muscles cover more than one region (e.g. Soleus is
// rendered as distinct left/right regions). Multiple muscles can point at
// the same region — heat.js sums their contributions into it, the same
// way it already sums multiple exercises' contributions into one muscle.
export const MUSCLE_TO_REGIONS = {
  'Pectoralis Major': ['chest'],

  'Latissimus Dorsi': ['upper-back'],
  Trapezius: ['trapezius'],
  Rhomboids: ['upper-back'],
  'Teres Major': ['upper-back'],
  'Erector Spinae': ['lower-back'],

  'Anterior Deltoid': ['front-deltoids'],
  'Lateral Deltoid': ['front-deltoids'],
  'Posterior Deltoid': ['back-deltoids'],
  Neck: ['neck'],

  'Biceps Brachii': ['biceps'],
  Brachialis: ['biceps'],
  Brachioradialis: ['forearm'],
  'Triceps Brachii': ['triceps'],
  Forearms: ['forearm'],

  'Rectus Abdominis': ['abs'],
  Obliques: ['obliques'],

  Quadriceps: ['quadriceps'],
  Hamstrings: ['hamstring'],
  'Gluteus Maximus': ['gluteal'],
  'Gluteus Medius': ['gluteal'],
  Adductors: ['adductor'],
  Abductors: ['abductors'],
  Gastrocnemius: ['calves'],
  Soleus: ['left-soleus', 'right-soleus'],
};
