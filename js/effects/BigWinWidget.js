import { WinCounter } from "./WinCounter.js";
import { CoinFountain } from "./CoinFountain.js";

// Owns the full-screen big-win overlay: dims/blurs everything behind it, hosts the
// massive roll-up counter and coin fountain, and waits for the player to dismiss it
// (Collect button, or clicking the dimmed backdrop) before handing control back.
export class BigWinWidget {
  constructor(overlayEl, counterEl, counterValueEl, collectBtnEl, fountainEl) {
    this.overlayEl = overlayEl;
    this.counter = new WinCounter(counterEl, counterValueEl);
    this.fountain = new CoinFountain(fountainEl);
    this.collectBtnEl = collectBtnEl;
    this._resolveDismiss = null;

    this.collectBtnEl.addEventListener("click", () => this._dismiss());
    // Only the dimmed backdrop itself dismisses on click, not the widget panel —
    // clicking inside the panel (e.g. near the counter) shouldn't close it.
    this.overlayEl.addEventListener("click", (event) => {
      if (event.target === this.overlayEl) this._dismiss();
    });
  }

  // Shows the widget immediately, starts the coin fountain, and rolls the massive
  // counter from 0 to `amount` over `durationMs`. The fountain's emitter cuts off
  // (stopSpawning, not stop) the instant the counter settles — see WinCounter's
  // onClimaxSettle callback — but coins already in flight keep falling naturally
  // ("gravity bleed") rather than being destroyed; the widget itself stays up until
  // the player dismisses it, at which point _dismiss() below does clear them.
  show(amount, durationMs) {
    return new Promise((resolve) => {
      this._resolveDismiss = resolve;
      this.counter.reset();
      this.overlayEl.classList.add("big-win-overlay--active");
      this.fountain.start();
      this.counter.rollUp(amount, durationMs, "big", () => this.fountain.stopSpawning());
    });
  }

  _dismiss() {
    if (!this._resolveDismiss) return;
    this.overlayEl.classList.remove("big-win-overlay--active");
    this.fountain.stop();
    this.counter.reset();

    const resolve = this._resolveDismiss;
    this._resolveDismiss = null;
    resolve();
  }
}
