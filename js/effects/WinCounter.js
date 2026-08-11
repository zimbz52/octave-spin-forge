import { startWinRollup, triggerWinClimax, stopWinRollup } from "../audio/audioHooks.js";

// Small win only: a brief hold on the final number after it's hit, before formally
// wrapping up — keeps the climax and stop hooks as two distinct, audibly-separable
// beats instead of firing back to back. Big wins used to have their own 550ms hold
// here too, but that's gone — see rollUp()'s isBig branch, which fires everything
// the instant the target is reached instead.
const CLIMAX_HOLD_MS = { small: 200 };

// Big win counter easing: races through the vast majority of the value at a fast,
// non-decelerating pace, then brakes sharply only across a short final slice of the
// value itself. Replaces a single continuous ease-out curve (1 - (1-t)^4) that
// decelerated smoothly across the *entire* roll-up — which read fine for a while, but
// visibly dragged through the last several thousand points of a large win (24k -> 25k
// crawling by) since a huge fraction of the total time was spent easing into a huge
// fraction of the value.
const BIG_WIN_BRAKE_TIME_FRACTION = 0.08; // last 8% of the duration is the brake phase
const BIG_WIN_BRAKE_VALUE_FRACTION_MAX = 0.02; // brake zone is at most 2% of the target value
const BIG_WIN_BRAKE_VALUE_CAP = 1000; // ...and never more than this many points, however large the win

// Returns eased progress (0-1) for a given time progress `t` (0-1) and the win's
// target `amount` — the brake zone's value width is computed per-call since it
// depends on `amount`, not a fixed fraction of time the way the old curve was.
function bigWinEasedProgress(t, amount) {
  const brakeValueWidth = amount > 0 ? Math.min(amount * BIG_WIN_BRAKE_VALUE_FRACTION_MAX, BIG_WIN_BRAKE_VALUE_CAP) : 0;
  const brakeStartProgress = amount > 0 ? 1 - brakeValueWidth / amount : 1;
  const climbTimeEnd = 1 - BIG_WIN_BRAKE_TIME_FRACTION;

  if (t < climbTimeEnd) {
    // Aggressive climb: linear, not decelerating, through everything before the
    // brake zone — this is the fix for "decelerating too early."
    return brakeStartProgress * (t / climbTimeEnd);
  }
  // Sharp brake: a steep ease-out compressed into a short time window covering only
  // the last slice of value — reads as a snap-to-stop, not a long drift.
  const localT = (t - climbTimeEnd) / BIG_WIN_BRAKE_TIME_FRACTION;
  const decel = 1 - Math.pow(1 - localT, 4);
  return brakeStartProgress + (1 - brakeStartProgress) * decel;
}

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
    this.valueEl.classList.remove("win-counter__value--climax-pulse");
    this.valueEl.textContent = "0";
    this.valueEl.style.setProperty("--climax-scale", "1");
  }

  // Rolls from 0 to `amount` over exactly `durationMs`. `type` is "small" or "big" —
  // passed through to the audio hooks, and used to pick the easing/climax-scale feel.
  // `onClimaxSettle` (big wins only) fires in the exact same synchronous block as
  // stopWinRollup() below — see there for why that matters.
  rollUp(amount, durationMs, type, onClimaxSettle) {
    return new Promise((resolve) => {
      const isBig = type === "big";

      this.counterEl.classList.add("win-counter--rolling");
      if (isBig) this.counterEl.classList.add("win-counter--big");
      startWinRollup(type);

      const start = performance.now();

      const tick = (now) => {
        const t = Math.min(1, (now - start) / durationMs);
        // Small: brisk, fairly linear tick, unchanged. Big: the two-phase
        // aggressive-climb/sharp-brake curve above, not a continuous ease-out.
        const eased = isBig ? bigWinEasedProgress(t, amount) : 1 - Math.pow(1 - t, 2);
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

        if (isBig) {
          // Zero-latency climax: every effect fires in this exact frame, the
          // instant the target value is reached — no setTimeout, no artificial
          // hold (big wins no longer use CLIMAX_HOLD_MS at all). The digit punch,
          // the particle-emitter cutoff (onClimaxSettle), and stopWinRollup()
          // (which queues the busWinsBig outro stinger via
          // ThemeAudio.stopBigWinRiser()) are one tightly-bound, synchronous
          // event, not three separately-timed ones. Reset --climax-scale to 1
          // first so the pulse's own scale(1) end state (not the roll-up's last
          // grown value, ~1.55) is what's left showing once it completes.
          this.counterEl.classList.remove("win-counter--rolling");
          triggerWinClimax(type);
          this.valueEl.style.setProperty("--climax-scale", "1");
          this.valueEl.classList.add("win-counter__value--climax-pulse");
          onClimaxSettle?.();
          stopWinRollup(type);
          resolve();
          return;
        }

        // Small win keeps its original brief hold between the climax cue and the
        // stop hook (CLIMAX_HOLD_MS.small) — this task is scoped to the Big Win
        // counter only.
        triggerWinClimax(type);
        setTimeout(() => {
          this.counterEl.classList.remove("win-counter--rolling");
          stopWinRollup(type);
          resolve();
        }, CLIMAX_HOLD_MS.small);
      };

      this.rafId = requestAnimationFrame(tick);
    });
  }
}
