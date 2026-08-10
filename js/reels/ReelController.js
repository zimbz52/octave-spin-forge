import { SYMBOLS, SYMBOL_META } from "../game/SpinSequence.js";

// How many times the 5-symbol set repeats as spin filler before the strip lands on
// the target symbols. Purely controls how far the landing animation has to travel —
// kept small so the ease/bounce at the end covers a visible distance instead of
// sprinting most of it instantly. Spin duration is controlled separately by the
// CSS loop + JS delay, not by this.
const FILLER_CYCLES = 2;

// Every reel always shows exactly 3 symbols (top/mid/bottom).
const VISIBLE_COUNT = 3;

function createSymbolEl(symbolId) {
  const meta = SYMBOL_META[symbolId];
  const el = document.createElement("div");
  el.className = `symbol ${meta.className}`;
  el.dataset.symbol = symbolId;

  const label = document.createElement("span");
  label.className = "symbol__label";
  label.textContent = meta.label;
  el.appendChild(label);

  return el;
}

export class ReelController {
  constructor(reelEl, reelIndex) {
    this.reelEl = reelEl;
    this.stripEl = reelEl.querySelector(".reel__strip");
    this.reelIndex = reelIndex;
    this.step = 0;
    this.rampAnim = null;
    // The 3 symbols currently at rest on screen — becomes the strip's lead-in on the
    // next build, so the very first frame of a new spin still shows what was already
    // there (no pop) before it starts scrolling away.
    this.lastSymbols = null;
  }

  // Rebuilds the strip's DOM for the next spin: the currently-resting symbols (so
  // there's no visible jump the instant the strip rebuilds), then filler, then the
  // 3 target symbols the reel should land on. Resets position/transition to start clean.
  buildStrip(targetSymbols) {
    const lead = this.lastSymbols || targetSymbols;

    const filler = [];
    for (let i = 0; i < FILLER_CYCLES; i++) {
      filler.push(...SYMBOLS);
    }
    const fullSequence = [...lead, ...filler, ...targetSymbols];

    this.stripEl.innerHTML = "";
    fullSequence.forEach((symbolId) => {
      this.stripEl.appendChild(createSymbolEl(symbolId));
    });

    this.stripEl.style.transition = "none";
    this.stripEl.style.animation = "none";
    this.stripEl.style.transform = "translateY(0)"; // shows `lead` — matches what was already visible
    void this.stripEl.offsetHeight; // force reflow before measuring

    this.measure();
    this.lastSymbols = targetSymbols;
  }

  // Sets the reel to a resting position directly, with no filler/spin — used for
  // the initial page-load display, which isn't a spin outcome.
  setStatic(targetSymbols) {
    this.stripEl.innerHTML = "";
    targetSymbols.forEach((symbolId) => {
      this.stripEl.appendChild(createSymbolEl(symbolId));
    });
    this.stripEl.style.transition = "none";
    this.stripEl.style.transform = "translateY(0)";
    void this.stripEl.offsetHeight;
    this.measure();
    this.lastSymbols = targetSymbols;
  }

  measure() {
    const children = this.stripEl.children;
    if (children.length >= 2) {
      this.step = children[1].offsetTop - children[0].offsetTop;
    }
    const gapPx = parseFloat(getComputedStyle(this.stripEl).rowGap) || 0;
    this.reelEl.style.height = `${3 * this.step - gapPx}px`;
    this.stripEl.style.setProperty("--filler-cycle-height", `${this.step * SYMBOLS.length}px`);
    // How far the lead-in (currently-resting symbols) pushes the periodic filler zone
    // down — the spin loop must never reset back to translateY(0), since that shows
    // the (non-repeating) lead, not the filler pattern.
    this.stripEl.style.setProperty("--lead-offset", `${this.step * VISIBLE_COUNT}px`);
  }

  // Spins up from rest instead of jumping straight to full speed: a short ease-in
  // ramp (WAAPI) scrolls past the lead-in symbols and one filler cycle, then hands off
  // to the constant-speed CSS loop. The loop's own reset point (one cycle later, within
  // the repeating filler) looks identical to where the ramp ends — no visible seam.
  startSpin() {
    const leadOffset = this.step * VISIBLE_COUNT;
    const cycleHeight = this.step * SYMBOLS.length;
    this.stripEl.style.transition = "none";
    this.stripEl.style.animation = "none";
    this.stripEl.style.filter = "blur(0px)";
    this.stripEl.style.transform = "translateY(0)"; // still showing the lead-in symbols
    void this.stripEl.offsetHeight;

    const ramp = this.stripEl.animate(
      [
        { transform: "translateY(0px)", filter: "blur(0px)" },
        { filter: "blur(1.5px)", offset: 0.35 },
        { transform: `translateY(${-(leadOffset + cycleHeight)}px)`, filter: "blur(1.5px)", offset: 1 },
      ],
      { duration: 260, easing: "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards" }
    );
    this.rampAnim = ramp;

    ramp.finished
      .then(() => {
        ramp.cancel();
        // Reset to the start of the periodic filler zone (NOT translateY(0) — that
        // would re-show the lead-in symbols and cause a visible jump).
        this.stripEl.style.transform = `translateY(${-leadOffset}px)`;
        this.stripEl.style.filter = "blur(1.5px)";
        this.stripEl.style.animation = ""; // clear the earlier inline "none" so the CSS loop can actually run
        this.stripEl.classList.add("reel__strip--spinning");
        this.rampAnim = null;
      })
      .catch(() => {
        // Aborted because stop() cancelled it before the ramp finished — fine, stop() takes over.
      });
  }

  // Reads the strip's live on-screen translateY, regardless of whether the ramp
  // (WAAPI) or the cruise loop (CSS animation) is currently driving it.
  getCurrentY() {
    const transform = getComputedStyle(this.stripEl).transform;
    if (!transform || transform === "none") return 0;
    return new DOMMatrixReadOnly(transform).m42;
  }

  // Stops the reel after `delay` ms, springing into the pre-built target symbols over
  // `landingMs` with a small overshoot-and-settle bounce. Resolves once it's fully at
  // rest. `onImpact`, if given, fires the moment the strip first reaches the target
  // position — before the overshoot/settle wobble — which is when a stop sound should
  // actually play, not after the whole bounce finishes ~landingMs later.
  stop(delay, landingMs = 650, onImpact) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const currentY = this.getCurrentY(); // capture before touching anything — no snap

        if (this.rampAnim) {
          this.rampAnim.cancel();
          this.rampAnim = null;
        }
        this.stripEl.classList.remove("reel__strip--spinning");
        this.stripEl.style.animation = "none";
        this.stripEl.style.transform = `translateY(${currentY}px)`;
        void this.stripEl.offsetHeight; // commit the frozen position before animating from it

        const targetIndex = this.stripEl.children.length - VISIBLE_COUNT;
        const finalOffset = -(targetIndex * this.step);
        const overshoot = Math.max(18, this.step * 0.24);

        // Filter gets its own, earlier keyframe (clears well before the reel is fully
        // at rest) and is explicitly defined at every subsequent offset — WAAPI only
        // holds a property's value within the span it's given keyframes for; leaving
        // it unset after the clear point would let it fall back to the stale
        // pre-landing inline value (still blurred) for the rest of the animation.
        const landing = this.stripEl.animate(
          [
            { transform: `translateY(${currentY}px)`, filter: "blur(1.5px)" },
            { filter: "blur(0px)", offset: 0.3 },
            { transform: `translateY(${finalOffset - overshoot}px)`, filter: "blur(0px)", offset: 0.68 },
            { transform: `translateY(${finalOffset + overshoot * 0.45}px)`, filter: "blur(0px)", offset: 0.85 },
            { transform: `translateY(${finalOffset - overshoot * 0.12}px)`, filter: "blur(0px)", offset: 0.95 },
            { transform: `translateY(${finalOffset}px)`, filter: "blur(0px)", offset: 1 },
          ],
          { duration: landingMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
        );

        let settled = false;
        let impactFired = false;
        const fireImpact = () => {
          if (impactFired || !onImpact) return;
          impactFired = true;
          onImpact();
        };

        if (onImpact) {
          // Poll the strip's live position rather than assuming a fixed fraction of
          // landingMs — the easing is heavily front-loaded, so "impact" (first reaching
          // finalOffset) happens well before any fixed percentage of the duration would
          // suggest. Moving in the negative direction, so "reached" means <= finalOffset.
          const hasReachedTarget = () => this.getCurrentY() <= finalOffset;

          const rafLoop = () => {
            if (settled) return;
            if (hasReachedTarget()) {
              fireImpact();
              return;
            }
            requestAnimationFrame(rafLoop);
          };
          requestAnimationFrame(rafLoop);

          // Backup poller on its own timer, not tied to rAF — rAF can legitimately
          // stop firing for reasons unrelated to "the animation is done" (a
          // backgrounded/inactive tab pauses it, some environments throttle it
          // outright), and in those cases we'd rather catch the impact a little late
          // via this than fall all the way back to waiting for the full settle.
          const timeoutLoop = () => {
            if (settled) return;
            if (hasReachedTarget()) {
              fireImpact();
              return;
            }
            setTimeout(timeoutLoop, 16);
          };
          setTimeout(timeoutLoop, 16);
        }

        landing.finished
          .then(() => {
            settled = true;
            // Guaranteed fallback: if rAF got throttled (e.g. a backgrounded tab) badly
            // enough that checkImpact never got to run before the animation finished,
            // onImpact must still fire — better a hair late than never.
            fireImpact();
            landing.cancel();
            this.stripEl.style.transform = `translateY(${finalOffset}px)`;
            this.stripEl.style.filter = "blur(0px)";
            resolve();
          })
          .catch(() => {
            settled = true;
            fireImpact();
            resolve();
          });
      }, delay);
    });
  }

  highlightPayline() {
    const middleSymbol = this.getPaylineSymbolEl();
    if (middleSymbol) middleSymbol.classList.add("symbol--win");
  }

  // The currently-resting middle-row (payline) symbol element.
  getPaylineSymbolEl() {
    const children = this.stripEl.children;
    return children[children.length - 2] || null;
  }

  // Blackout wins glow all 3 visible symbols (top/mid/bottom), not just the payline.
  highlightAll() {
    this.getVisibleSymbolEls().forEach((el) => el.classList.add("symbol--win"));
  }

  // The 3 currently-resting symbol elements (top/mid/bottom), in that order.
  getVisibleSymbolEls() {
    const children = this.stripEl.children;
    const start = children.length - VISIBLE_COUNT;
    const els = [];
    for (let i = start; i < children.length; i++) {
      if (children[i]) els.push(children[i]);
    }
    return els;
  }

  clearHighlight() {
    this.stripEl.querySelectorAll(".symbol--win").forEach((el) => el.classList.remove("symbol--win"));
  }
}
