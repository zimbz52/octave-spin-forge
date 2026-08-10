import { startWinRollup, triggerWinClimax, stopWinRollup } from "../audio/audioHooks.js";

// Small brief hold on the final number after it's hit, before formally wrapping up —
// keeps the climax and stop hooks as two distinct, audibly-separable beats instead of
// firing back to back.
const CLIMAX_HOLD_MS = { small: 200, big: 550 };

// Drives the digital win counter: rolls the displayed number from 0 up to a target
// amount over an exact duration, driven by requestAnimationFrame so the duration is
// precise regardless of frame rate.
export class WinCounter {
  constructor(counterEl, valueEl) {
    this.counterEl = counterEl;
    this.valueEl = valueEl;
    this.rafId = null;
  }

  // Instantly resets to 0 with no animation — used when a new spin starts.
  reset() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.counterEl.classList.remove("win-counter--rolling", "win-counter--big");
    this.valueEl.textContent = "0";
    this.valueEl.style.setProperty("--climax-scale", "1");
  }

  // Rolls from 0 to `amount` over exactly `durationMs`. `type` is "small" or "big" —
  // passed through to the audio hooks, and used to pick the easing/climax-scale feel.
  rollUp(amount, durationMs, type) {
    return new Promise((resolve) => {
      const isBig = type === "big";

      this.counterEl.classList.add("win-counter--rolling");
      if (isBig) this.counterEl.classList.add("win-counter--big");
      startWinRollup(type);

      const start = performance.now();

      const tick = (now) => {
        const t = Math.min(1, (now - start) / durationMs);
        // Small: brisk, fairly linear tick. Big: a longer, more dramatic build that
        // really decelerates into the final stretch for suspense.
        const eased = 1 - Math.pow(1 - t, isBig ? 4 : 2);
        const current = Math.round(amount * eased);
        this.valueEl.textContent = current.toLocaleString();

        if (isBig) {
          // Numbers grow as the count nears its climax.
          this.valueEl.style.setProperty("--climax-scale", (1 + 0.55 * eased).toFixed(3));
        }

        if (t < 1) {
          this.rafId = requestAnimationFrame(tick);
          return;
        }

        this.valueEl.textContent = amount.toLocaleString();
        this.rafId = null;
        triggerWinClimax(type);

        setTimeout(() => {
          this.counterEl.classList.remove("win-counter--rolling");
          stopWinRollup(type);
          resolve();
        }, CLIMAX_HOLD_MS[type] ?? 200);
      };

      this.rafId = requestAnimationFrame(tick);
    });
  }
}
