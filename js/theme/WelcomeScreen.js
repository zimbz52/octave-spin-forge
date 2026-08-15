import { unlockAudioContext } from "../audio/audioUtils.js";
import { playSliderEngage, playSliderTick, playSliderCancel, playSliderLock, playSliderReveal } from "../audio/audioHooks.js";

// The master audio gate: a full-screen overlay that loads before even the startup
// terminal, so the very first thing a player can do on this page is the one deliberate
// gesture that unlocks the shared AudioContext. Sits above the terminal (z-index 400 vs
// 300) and simply covers it until dismissed — the terminal underneath is already
// rendered and wired, this just blocks it from being reachable a moment longer.
//
// The gate is a drag-to-unlock "engine slider" (a heavy, notched thumb the player has
// to physically pull across, not just click) rather than a plain button — see
// _wireEngineSlider()/_snapAndUnlock() below, ported from the sibling Tactile project's
// identical interaction (D:\DEV\Claude\Tactile\js\main.js).
//
// Audio unlock timing, Step 46: unlockAudioContext() is called from the very first
// pointerdown/touchstart on the thumb — the instant the player grabs it — not once the
// drag succeeds. Browsers only require *one* trusted gesture to unlock audio, and
// grabbing the thumb is as legitimate a gesture as the click that used to do it, so
// there's no reason to make the whole drag silent while waiting for it to finish. This
// is what lets every notch tick/cancel/lock sound below actually play live, in real
// time, instead of only the final reveal being audible. main.js's own
// `await welcomeScreen.waitForStart(); unlockAudioContext();` call is now a redundant
// (harmless — see unlockAudioContext()'s own "safe any number of times" contract)
// safety net for the case _wireEngineSlider() guards out below (missing markup) and
// this whole class never gets a chance to unlock anything itself.
//
// waitForStart() itself is untouched: it still resolves via a real click on a hidden
// #welcome-start-btn proxy the instant the drag crosses its unlock threshold — that's
// just the existing "move on to the next screen" signal now, unrelated to the audio
// unlock, which already happened earlier.
const NOTCH_COUNT = 8;
const UNLOCK_THRESHOLD = 0.94;

export class WelcomeScreen {
  constructor(rootEl, startBtnEl) {
    this.rootEl = rootEl;
    this.startBtnEl = startBtnEl;
    this._wireEngineSlider();
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
      // The actual audio unlock — see the class-level comment above for why this
      // fires here, on grab, rather than waiting for the drag to succeed. Every
      // fresh grab re-fires this (e.g. after a spring-back), not just the first —
      // unlockAudioContext() is a safe no-op once already running.
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
  // threshold is already running in. Audio was already unlocked back on the initial
  // grab (see the class-level comment and onPointerDown above), so nothing here is
  // load-bearing for that anymore — kept synchronous anyway as a matter of not
  // introducing a delay for no reason. The shutter/dismiss() fade that follows is
  // purely cosmetic and runs on its own clock afterward (see styles.css's
  // .welcome-screen--fading transition-delay).
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
