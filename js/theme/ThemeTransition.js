import { playTransitionWhoosh } from "../audio/audioHooks.js";
import { themeManager } from "./ThemeManager.js";
import { themeAudio } from "../audio/ThemeAudio.js";

// Fallback CSS-gradient backdrops, used when a theme has no `bgImagePath` (or its
// image fails to load) — still genuine `background-image` values, so the swap
// mechanism is the same either way; only the visual content differs.
const DEFAULT_BACKDROP = "radial-gradient(circle at 50% 20%, #1c1e24 0%, #0b0c10 70%)";

const THEME_BACKDROPS = {
  egypt: "radial-gradient(circle at 30% 15%, #4a3a14 0%, #1a1206 70%)",
  mexico: "radial-gradient(circle at 30% 15%, #5c1f3a 0%, #200a14 70%)",
  arcade: "radial-gradient(circle at 30% 15%, #241a4a 0%, #0a0620 70%)",
  football: "radial-gradient(circle at 30% 15%, #1a4a2e 0%, #061a10 70%)",
  china: "radial-gradient(circle at 30% 15%, #6a1418 0%, #1c0506 70%)",
  neondrive: "radial-gradient(circle at 30% 15%, #3a0a4a 0%, #0a0620 70%)",
};

function gradientBackdropFor(themeName) {
  return THEME_BACKDROPS[themeName] || DEFAULT_BACKDROP;
}

// Resolves once `url` is fully decoded and ready to paint — not just "bytes
// downloaded" (onload alone can still leave a decode hitch on the image's first
// paint, especially for a large photo). Never rejects: a missing/broken image
// shouldn't hang the whole transition, it should just fall back to the theme's CSS
// backdrop instead.
function preloadImage(url) {
  const img = new Image();
  img.src = url;
  const ready = img.decode
    ? img.decode()
    : new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
  return ready.catch(() => null);
}

// Orchestrates a theme switch: fade to black (with a whoosh hook fired the instant it
// starts) -> swap the backdrop and load the new theme's visual/audio config while the
// screen is black -> lift the fade.
export class ThemeTransition {
  constructor(fadeOverlayEl) {
    this.fadeOverlayEl = fadeOverlayEl;
  }

  async swapTo(themeName) {
    await this._transitionTo(themeName);
  }

  // Cold-start variant of swapTo(), used exactly once: when the startup terminal's
  // gatekeeper selection resolves. Identical fade/load/reveal mechanics, plus dismissing
  // the terminal at the one moment it's safe to — once the screen is confirmed fully
  // black — so the terminal's removal and the cabinet's first reveal are never visible
  // as a seam. This is also the first place any theme audio is ever loaded, since the
  // terminal's click is the page's guaranteed first user gesture.
  async enterFromTerminal(themeName, startupTerminal) {
    await this._transitionTo(themeName, startupTerminal);
  }

  async _transitionTo(themeName, startupTerminal) {
    playTransitionWhoosh();
    this.fadeOverlayEl.classList.add("fade-overlay--active");
    await this._waitForOpacityTransition();

    // Screen is fully black now — safe to dismiss/swap without any of it being visible.
    if (startupTerminal) startupTerminal.dismiss();

    // The visual config has to resolve first — it's what tells us the theme's real
    // bgImagePath, if any — before the image (or the gradient fallback) can be applied.
    // The ensuing image preload and the fully independent theme audio load then run
    // side by side; the fade only lifts once both are done, so the background is
    // already fully loaded and centered the instant it becomes visible.
    const config = await themeManager.loadTheme(themeName).catch((err) => {
      console.error(err);
      return null;
    });

    await Promise.all([this._applyBackdrop(themeName, config), themeAudio.loadTheme(themeName)]);

    this.fadeOverlayEl.classList.remove("fade-overlay--active");
  }

  async _applyBackdrop(themeName, config) {
    const imagePath = config && config.bgImagePath;
    if (imagePath) {
      const decoded = await preloadImage(imagePath);
      if (decoded !== null) {
        document.body.style.backgroundImage = `url("${imagePath}")`;
        return;
      }
      console.warn(`[ThemeTransition] Failed to load background image "${imagePath}", falling back to gradient.`);
    }
    document.body.style.backgroundImage = gradientBackdropFor(themeName);
  }

  _waitForOpacityTransition() {
    return new Promise((resolve) => {
      const onEnd = (event) => {
        if (event.propertyName !== "opacity") return;
        this.fadeOverlayEl.removeEventListener("transitionend", onEnd);
        resolve();
      };
      this.fadeOverlayEl.addEventListener("transitionend", onEnd);
    });
  }
}
