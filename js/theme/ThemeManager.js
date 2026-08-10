// Fetches and stores a theme's JSON config. Applying the config (art swap, stingers,
// crossfades) is out of scope for this step — that lands once themes are implemented.
class ThemeManager {
  constructor() {
    this.currentTheme = null;
  }

  async loadTheme(themeName) {
    const response = await fetch(`themes/${themeName}.json`);
    if (!response.ok) {
      throw new Error(`[ThemeManager] Failed to load theme "${themeName}": ${response.status}`);
    }
    const config = await response.json();
    this.currentTheme = config;
    document.dispatchEvent(new CustomEvent("themeconfigloaded", { detail: config }));
    return config;
  }
}

export const themeManager = new ThemeManager();
