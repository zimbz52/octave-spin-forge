import { BUS_NAMES } from "./busRouting.js";

// Baked-in starting point, produced by a finalized mixing pass via the dev mixer's own
// Export Config button and hardcoded here per the tool's intended workflow (see "Dev
// mixer & bus routing (Step 16)" in ARCHITECTURE.md) — not a one-time migration, still
// fully editable live from this baseline via the mixer UI, and still exportable again
// to produce an updated version of this same object.
const DEFAULT_THEME_MIXES = {
  egypt: {
    busMusic: 0.5,
  },
  football: {
    busMusic: 0.75,
    busReelsTurbo: 0.99,
    busWinsSmall: 0.9,
    busWinsSymbol: 0.87,
    // Clamped down from an originally-exported 1.3 — Howler's own volume() setter
    // silently ignores any value outside 0-1 (no error, the sound just keeps whatever
    // gain it already had), so a bus multiplier above 1 never actually did anything.
    // 1 (100%) is the real ceiling; see setBusVolume() below, which now enforces it.
    busWinsBig: 1,
  },
  arcade: {
    busReelsTurbo: 0.9,
    busReelsNormal: 0.9,
    busWinsBig: 0.9,
  },
};

// Pure state for the dev mixer: per-theme bus-gain multipliers, keyed exactly as
// Export Config emits them — themeMixes: { <themeId>: { <busName>: <multiplier> } }.
// In-memory only beyond the baked-in defaults above, by design: this is a tuning tool
// for producing a value set to hardcode elsewhere once mixing is finalized, not a
// player-facing setting, so live edits don't need to survive a reload.
class DevMixer {
  constructor() {
    // Structured-cloned so mutating one theme's bus values (setBusVolume) can never
    // reach back and mutate the shared DEFAULT_THEME_MIXES constant itself.
    this.themeMixes = structuredClone(DEFAULT_THEME_MIXES);
  }

  // Every bus defaults to 1 (no change) until explicitly touched — callers never need
  // to special-case "not set yet".
  getBusVolume(theme, bus) {
    return this.themeMixes[theme]?.[bus] ?? 1;
  }

  // Clamped to 0-1: Howler's own volume() setter silently no-ops for anything outside
  // that range (not an error — the sound just keeps its previous gain), so a bus
  // multiplier above 1 would never actually be audible. 1 (100%, unchanged) is the
  // real ceiling, matching the mixer UI's slider max.
  setBusVolume(theme, bus, value) {
    if (!theme) return;
    if (!this.themeMixes[theme]) this.themeMixes[theme] = {};
    this.themeMixes[theme][bus] = Math.min(1, Math.max(0, value));
  }

  // Every bus for a theme, defaults filled in — what the mixer panel renders sliders
  // from, so a freshly-visited theme still shows a complete, correct set of controls
  // rather than only whichever buses happen to have been touched already.
  getThemeMix(theme) {
    const mix = {};
    BUS_NAMES.forEach((bus) => {
      mix[bus] = this.getBusVolume(theme, bus);
    });
    return mix;
  }

  exportJSON() {
    return JSON.stringify(this.themeMixes, null, 2);
  }
}

export const devMixer = new DevMixer();
