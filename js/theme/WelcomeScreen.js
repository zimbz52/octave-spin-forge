import { unlockAudioContext } from "../audio/audioUtils.js";
import { playSliderEngage, playSliderTick, playSliderCancel, playSliderLock, playSliderReveal } from "../audio/audioHooks.js";

// The master audio gate: a full-screen overlay that loads before even the startup
// terminal, so the very first thing a player can do on this page is unlock the shared
// AudioContext. Sits above the terminal (z-index 400 vs 300) and simply covers it
// until dismissed — the terminal underneath is already rendered and wired, this just
// blocks it from being reachable a moment longer.
//
// Two-stage gate, Step 49: Step 46 unlocked audio from the engine slider's own grab
// (pointerdown/touchstart) so the whole drag could make sound, not just the final
// reveal — but on mobile (confirmed on real devices, not just this project's
// Browser-pane emulation), that unlock was unreliable: some mobile browsers only
// validate a synchronous AudioContext.resume() call against a *completed* tap
// (touchend/click), not a bare touchstart/pointerdown that goes straight into a
// continuous drag with no discrete tap ever completing. A plain button's click event
// is the one gesture every browser, mobile included, reliably honors this against.
//
// So: stage 1 is _wireStartButton() below, a plain tap/click "Start" button — the main
// welcome text sits above it, per the request this shipped under. Tapping it is the
// *real* unlock now. Stage 2 is the same engine slider as before (see
// _wireEngineSlider()/_snapAndUnlock(), ported from the sibling Tactile project's
// identical interaction, D:\DEV\Claude\Tactile\js\main.js) — hidden until stage 1
// completes, at which point it's purely a tactile flourish gate on top of audio that's
// already unlocked, not the sole point of failure for it anymore. Its own
// pointerdown-triggered unlockAudioContext() call stays as a harmless, idempotent
// safety net (see unlockAudioContext()'s own "safe any number of times" contract), not
// because it's still load-bearing.
//
// waitForStart() itself is untouched: it still resolves via a real click on a hidden
// #welcome-start-btn proxy the instant the *slider's* drag crosses its unlock
// threshold — that's the existing "move on to the next screen" signal, unrelated to
// either audio unlock (both already happened well before this by the time it fires).
const NOTCH_COUNT = 8;
const UNLOCK_THRESHOLD = 0.94;

export class WelcomeScreen {
  constructor(rootEl, startBtnEl) {
    this.rootEl = rootEl;
    this.startBtnEl = startBtnEl;
    this._wireStartButton();
    this._wireEngineSlider();
  }

  // Stage 1 of the gate — see the class-level comment above for why this exists
  // alongside the slider. Guarded (no-ops if the markup is missing) for the same
  // single-point-of-failure reason _wireEngineSlider() below is.
  _wireStartButton() {
    const startBtn = this.rootEl.querySelector(".welcome-screen__start-btn");
    const slider = this.rootEl.querySelector(".engine-slider");
    if (!startBtn || !slider) return;

    startBtn.addEventListener("click", () => {
      // The reliable unlock — a plain click, not a mid-drag gesture. See the
      // class-level comment for why this specifically is what fixes the mobile bug.
      unlockAudioContext();
      startBtn.hidden = true;
      slider.hidden = false;
    });
  }

  // Resolves once the player clicks (or Enter/Space-activates) the start button — or,
  // now, once the engine slider's _snapAndUnlock() dispatches a synthetic click on the
  // hidden proxy button in its place. Unchanged from the plain-button version.
  waitForStart() {
    return new Promise((resolve) => {
      const settle = () => {
        this.startBtnEl.removeEventListener("click", onClick);
        resolve();
      };
      const onClick = () => settle();
      this.startBtnEl.addEventListener("click", onClick);
    });
  }

  // Fades out over the CSS transition, then permanently removes itself — never comes
  // back for the rest of the session, same as the terminal. Unchanged: the engine
  // slider's camera-shutter sweep plays first, and this fade's own CSS
  // (.welcome-screen--fading's transition-delay in styles.css) waits for that sweep to
  // finish before it even starts, so the two never visibly overlap — no JS-level
  // sequencing needed here, it's handled entirely by that delay.
  dismiss() {
    return new Promise((resolve) => {
      const onEnd = (event) => {
        if (event.propertyName !== "opacity") return;
        this.rootEl.removeEventListener("transitionend", onEnd);
        this.rootEl.remove();
        resolve();
      };
      this.rootEl.addEventListener("transitionend", onEnd);
      this.rootEl.classList.add("welcome-screen--fading");
    });
  }

  // Drag-to-unlock slider: physical resistance (a per-notch tick + haptic), a
  // spring-back on an incomplete drag, and a camera-shutter wipe on success. Guarded
  // (no-ops if the markup is missing) rather than throwing — this runs inside init()'s
  // synchronous path in main.js, same class of single-point-of-failure risk as
  // wireBetSelector() once was (see ARCHITECTURE.md's "Known environment gotchas" item
  // 13): a missing element here should degrade, not silently kill the rest of init().
  _wireEngineSlider() {
    const slider = this.rootEl.querySelector(".engine-slider");
    const track = this.rootEl.querySelector(".engine-slider__track");
    const thumb = this.rootEl.querySelector(".engine-slider__thumb");
    const fill = this.rootEl.querySelector(".engine-slider__fill");
    const label = this.rootEl.querySelector(".engine-slider__label");
    if (!slider || !track || !thumb || !fill || !label) return;

    let dragging = false;
    let lastNotch = -1;
    let unlocked = false;

    const thumbTravel = () => track.clientWidth - thumb.offsetWidth - 8; // 4px inset each side

    const setPosition = (px) => {
      const max = thumbTravel();
      const clamped = Math.max(0, Math.min(px, max));
      thumb.style.left = `${clamped + 4}px`;
      const pct = max === 0 ? 0 : clamped / max;
      fill.style.width = `${clamped + thumb.offsetWidth}px`;

      const notch = Math.floor(pct * NOTCH_COUNT);
      if (notch !== lastNotch) {
        lastNotch = notch;
        thumb.classList.add("engine-slider__thumb--tick");
        playSliderTick(notch / NOTCH_COUNT);
        if (navigator.vibrate) navigator.vibrate(8);
        setTimeout(() => thumb.classList.remove("engine-slider__thumb--tick"), 90);
      }

      slider.classList.toggle("engine-slider--armed", pct > 0.15);

      if (pct >= UNLOCK_THRESHOLD && !unlocked) {
        unlocked = true;
        this._snapAndUnlock(thumbTravel(), label, setPosition);
      }
    };

    const pointerX = (event) => (event.touches ? event.touches[0].clientX : event.clientX);

    const onPointerDown = (event) => {
      if (unlocked) return;
      dragging = true;
      // A harmless safety-net unlock call, not the real one anymore — see the
      // class-level comment (Step 49) for why the actual unlock moved to the plain
      // Start button, stage 1 of the gate. unlockAudioContext() is a safe no-op once
      // already running, so this costs nothing even though it's redundant by now.
      unlockAudioContext();
      playSliderEngage();
      // Can throw NotFoundError if the browser doesn't consider event.pointerId an
      // active pointer at this exact instant (a real but narrow edge case even with
      // genuine input, not just synthetic events) — capture is a nicety (keeps the
      // drag tracking the thumb if the pointer leaves the track), not required for
      // the slider to work, so a failure here shouldn't be fatal.
      if (thumb.setPointerCapture && event.pointerId != null) {
        try {
          thumb.setPointerCapture(event.pointerId);
        } catch {
          /* no-op — see comment above */
        }
      }
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (!dragging || unlocked) return;
      const rect = track.getBoundingClientRect();
      setPosition(pointerX(event) - rect.left - thumb.offsetWidth / 2);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      if (!unlocked) {
        // Resistant spring-back — the gear didn't fully turn. setPosition(0) below
        // still fires its own notch tick as the thumb crosses back through 0 (not
        // suppressed) — layered with the cancel cue, it reads as the gear unwinding
        // back through its teeth, not just a flat "nope."
        playSliderCancel();
        setPosition(0);
        lastNotch = -1;
        slider.classList.remove("engine-slider--armed");
      }
    };

    thumb.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    thumb.addEventListener("touchstart", onPointerDown, { passive: false });
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
  }

  // Snaps the thumb fully home, fires the lock/reveal sounds and the shutter-wipe, and
  // dispatches the synthetic click that resolves waitForStart() — all synchronously,
  // inside the same pointerup/touchend call stack the drag that just crossed the
  // threshold is already running in. Audio was already unlocked back at stage 1 (the
  // Start button, well before the slider was even visible — see the class-level
  // comment), so nothing here is load-bearing for that anymore — kept synchronous
  // anyway as a matter of not introducing a delay for no reason. The shutter/dismiss()
  // fade that follows is purely cosmetic and runs on its own clock afterward (see
  // styles.css's .welcome-screen--fading transition-delay).
  _snapAndUnlock(travel, label, setPosition) {
    setPosition(travel);
    label.textContent = "ENGINE ONLINE";
    this.rootEl.classList.add("welcome-screen--snapping");
    playSliderLock();
    playSliderReveal();
    if (navigator.vibrate) navigator.vibrate([15, 30, 40]);
    this.startBtnEl.click();
  }
}
