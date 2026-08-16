// Single source of truth for which themes exist. The startup terminal's theme list and
// the in-game theme <select> both render from this array, so adding a theme (of however
// many — this is built to scale to dozens) never means touching those two places by hand.
// Each `id` must match its `themes/<id>.json` and `src/audio/<id>Sounds.json` file names,
// and have a matching entry in ThemeTransition.js's THEME_BACKDROPS.
export const THEMES = [
  { id: "egypt", label: "Desert Mysteries" },
  { id: "mexico", label: "Caramba!" },
  { id: "arcade", label: "Arcade Zap" },
  { id: "football", label: "Mondial Dream" },
  { id: "china", label: "Jade Empire" },
  { id: "neondrive", label: "Neon Drive" },
  { id: "gangster", label: "Bourbon Blues" },
];
