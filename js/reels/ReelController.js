import { SYMBOLS, SYMBOL_META } from "../game/SpinSequence.js";
import { themeManager } from "../theme/ThemeManager.js";

// How many times the 5-symbol set repeats as spin filler before the strip lands on
// the target symbols. Purely controls how far the landing animation has to travel —
// kept small so the ease/bounce at the end covers a visible distance instead of
// sprinting most of it instantly. Spin duration is controlled separately by the
// CSS loop + JS delay, not by this.
const FILLER_CYCLES = 2;

// Every reel always shows exactly 3 symbols (top/mid/bottom).
const VISIBLE_COUNT = 3;

// Looks up the active theme's real icon art for a symbol, if any. Returns null
// (rather than throwing) whenever there's no theme loaded yet (page-load resting
// grid, built before the startup terminal selection resolves) or the active theme's
// JSON simply doesn't declare that symbol — same "missing art degrades gracefully"
// contract Step 9 already established for background photos, not a new rule.
function themeIconPath(symbolId) {
  const theme = themeManager.currentTheme;
  return (theme && theme.symbols && theme.symbols[symbolId]) || null;
}

// The old CSS-shape rendering (clip-path + flat color + text label), kept as the
// fallback for whenever there's no themed icon art to show — either no theme loaded
// yet, or the declared image path 404s/fails to decode. `.symbol--01` etc. already
// carry the clip-path/color rules (see css/styles.css); nothing about those rules
// changed, they just moved from `.symbol` itself onto this inner element once
// `.symbol` became the plain icon container (see createSymbolEl below).
function createFallbackEl(symbolId, meta) {
  const fallback = document.createElement("div");
  fallback.className = `symbol__fallback ${meta.className}`;

  const label = document.createElement("span");
  label.className = "symbol__label";
  label.textContent = meta.label;
  fallback.appendChild(label);

  return fallback;
}

// `.symbol` is a plain, visually invisible flexbox container (see css/styles.css) —
// all it does is center whatever's actually representing this symbol, and carry the
// win-state classes (highlightPayline/highlightAll below). The real content is
// either a themed <img> icon (drop-shadow applied in CSS) or, if the active theme has
// no art for this symbol yet, the fallback CSS shape.
function createSymbolEl(symbolId) {
  const meta = SYMBOL_META[symbolId];
  const el = document.createElement("div");
  el.className = "symbol";
  el.dataset.symbol = symbolId;

  const iconPath = themeIconPath(symbolId);
  if (iconPath) {
    const img = document.createElement("img");
    img.className = "symbol__icon";
    img.src = iconPath;
    img.alt = meta.label;
    img.draggable = false;
    // A themed icon that 404s or fails to decode falls back to the CSS shape rather
    // than leaving a broken-image glyph on the reel — swapped in-place, not just
    // logged, so a bad path never regresses the reel to a visibly broken tile.
    img.onerror = () => {
      img.replaceWith(createFallbackEl(symbolId, meta));
    };
    el.appendChild(img);
  } else {
    el.appendChild(createFallbackEl(symbolId, meta));
  }

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

  // Pauses whatever's currently animating the strip — the WAAPI spin-up ramp, the
  // CSS cruise-loop, or a landing bounce — without resetting position, so
  // resumeSpinAnimation() picks up exactly where it left off. getAnimations() covers
  // all three uniformly (WAAPI-created and CSS @keyframes-driven animations alike),
  // so there's no need to track which one is currently active. Used only by
  // backgroundGuard.js's document visibilitychange handler; nothing else needs to
  // interrupt a spin mid-flight.
  pauseSpinAnimation() {
    this.stripEl.getAnimations().forEach((anim) => anim.pause());
  }

  resumeSpinAnimation() {
    this.stripEl.getAnimations().forEach((anim) => anim.play());
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
    if (middleSymbol) this._applyWinClass(middleSymbol);
  }

  // The currently-resting middle-row (payline) symbol element.
  getPaylineSymbolEl() {
    const children = this.stripEl.children;
    return children[children.length - 2] || null;
  }

  // Blackout wins glow all 3 visible symbols (top/mid/bottom), not just the payline.
  highlightAll() {
    this.getVisibleSymbolEls().forEach((el) => this._applyWinClass(el));
  }

  // Wilds stay dormant right up until a win is actually evaluated — no idle glow, no
  // passive animation, nothing distinguishes an on-reel Wild from any other symbol
  // until it's confirmed to be part of the connecting win. At that point a base
  // symbol gets the standard gold highlight (symbol--win, unchanged); a Wild gets its
  // own, more aggressive pulsing-border treatment instead (symbol--wild-win) — the
  // two are mutually exclusive per element, never both on the same symbol.
  _applyWinClass(el) {
    const isWild = el.dataset.symbol === "wild";
    el.classList.add(isWild ? "symbol--wild-win" : "symbol--win");
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
    this.stripEl.querySelectorAll(".symbol--win, .symbol--wild-win").forEach((el) => {
      el.classList.remove("symbol--win", "symbol--wild-win");
    });
  }

  // Redraws the currently-resting symbols in place (no spin, no re-measure of which
  // symbols are showing) so a theme switch's new icon art appears on symbols that
  // were already sitting on the reel before the switch — otherwise they'd silently
  // keep showing the previous theme's art (or the fallback shape) until the next
  // spin happened to rebuild them. No-ops before the very first setStatic()/
  // buildStrip() call (lastSymbols still null), which only matters on cold start
  // before any theme has loaded — nothing to redraw yet in that case anyway.
  redrawIcons() {
    if (!this.lastSymbols) return;
    this.setStatic(this.lastSymbols);
  }
}
