// Single source of truth for which themes exist. The startup terminal's theme list and
// the in-game theme <select> both render from this array, so adding a theme (of however
// many — this is built to scale to dozens) never means touching those two places by hand.
// Each `id` must match its `themes/<id>.json` and `src/audio/<id>Sounds.json` file names,
// and have a matching entry in ThemeTransition.js's THEME_BACKDROPS.
export const THEMES = [
  { id: "egypt", label: "Egypt" },
  { id: "mexico", label: "Mexico" },
  { id: "arcade", label: "Vintage Arcade" },
  { id: "football", label: "Football" },
  { id: "china", label: "China" },
  { id: "neondrive", label: "Neon Drive" },
];
