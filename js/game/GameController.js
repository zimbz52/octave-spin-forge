import { spinSequencer } from "./SpinSequence.js";
import { ReelController } from "../reels/ReelController.js";
import { WinLineController } from "../effects/WinLineController.js";
import { SymbolCelebration } from "../effects/SymbolCelebration.js";
import { WinCounter } from "../effects/WinCounter.js";
import { BigWinWidget } from "../effects/BigWinWidget.js";
import {
  playReelStart,
  playReelStop,
  getTurboStopQuantizeDelay,
  playWinStinger,
  playWinLineDash,
  playSymbolPulse,
  playSmallWinBlink,
  playThemeSmallWin,
  playThemeSymbolWin,
  scheduleBigWinEntry,
  playBigWinIntro,
  stopBigWinRiser,
} from "../audio/audioHooks.js";
import { setRhythmTimeout } from "../audio/rhythmTimers.js";

// Standard mode: staggered stops, with room for the cruise loop and landing bounce
// to actually read — 3rd reel finishes at 900 + 2*280 + 420 = 1880ms.
const NORMAL_TIMING = { spinMs: 900, staggerMs: 280, landingMs: 420 };

// Fast mode: simultaneous stops, total spin-to-landed time is exactly 500ms
// (spinMs + landingMs), and every reel stops together (no stagger).
const FAST_TIMING = { spinMs: 150, staggerMs: 0, landingMs: 350 };

// Exact win-counter roll-up durations, per spec.
const SMALL_ROLLUP_MS = 1500;
const BIG_ROLLUP_MS = 17000;

export class GameController {
  constructor(reelEls, resultEl, winLineEl, celebrationOverlayEl, winCounterEl, winCounterValueEl, bigWinEls) {
    this.reels = reelEls.map((el, i) => new ReelController(el, i));
    this.resultEl = resultEl;
    this.winLine = new WinLineController(winLineEl);
    this.celebration = new SymbolCelebration(celebrationOverlayEl);
    this.winCounter = new WinCounter(winCounterEl, winCounterValueEl);
    this.bigWinWidget = new BigWinWidget(
      bigWinEls.overlayEl,
      bigWinEls.counterEl,
      bigWinEls.counterValueEl,
      bigWinEls.collectBtnEl,
      bigWinEls.fountainEl
    );
    this.fastMode = false;
    this.isSpinning = false;
  }

  setFastMode(enabled) {
    this.fastMode = enabled;
  }

  // Builds the initial resting grid on page load, without spinning.
  showInitial(outcome) {
    this.reels.forEach((reel, i) => reel.setStatic(outcome.reelTargets[i]));
  }

  // Re-measures every reel against however the DOM is *currently* laid out, without
  // touching which symbols are showing. showInitial() runs while the startup terminal
  // still covers the cabinet, before the browser is guaranteed to have settled its
  // first real layout pass for the page's actual final size — occasionally that early
  // measurement locks in a too-small reel height that never self-corrects (each
  // symbol's own aspect-ratio sizing is fine; it's the *container's* pixel height,
  // fixed once via inline style, that goes stale). Call this once, right after the
  // terminal's fade lifts and the cabinet is actually visible for the first time.
  refreshLayout() {
    this.reels.forEach((reel) => reel.measure());
  }

  // Redraws whatever's currently resting on each reel with the newly-active theme's
  // icon art (main.js calls this off the themeconfigloaded event, which fires while
  // the fade-to-black is still up — so the swap itself is never visible). Skipped
  // entirely while a spin is in flight: a reel mid-animation has no stable "currently
  // resting" symbols to redraw, and buildStrip() already reads the active theme's
  // paths fresh on every spin regardless, so the next spin picks up the new art on
  // its own without this — nothing to fix, just nothing safe to touch here yet.
  refreshSymbolArt() {
    if (this.isSpinning) return;
    this.reels.forEach((reel) => reel.redrawIcons());
  }

  // backgroundGuard.js calls these on document visibilitychange — pausing/resuming
  // whatever's actively animating each reel (the spin-up ramp, the cruise loop, or a
  // landing bounce) rather than letting it keep running invisibly (and, for the
  // cruise loop specifically, indefinitely — CSS animations don't stop just because
  // the tab is hidden) while the tab is backgrounded.
  pauseAllReelAnimations() {
    this.reels.forEach((reel) => reel.pauseSpinAnimation());
  }

  resumeAllReelAnimations() {
    this.reels.forEach((reel) => reel.resumeSpinAnimation());
  }

  async spin() {
    if (this.isSpinning) return;
    this.isSpinning = true;

    this.reels.forEach((reel) => reel.clearHighlight());
    this.winLine.reset();
    this.winCounter.reset();
    this.setStatus("Spinning…", false);

    const outcome = spinSequencer.next();
    this.reels.forEach((reel, i) => reel.buildStrip(outcome.reelTargets[i]));

    // Audio hook: reel motion begins.
    playReelStart(this.fastMode);
    this.reels.forEach((reel) => reel.startSpin());

    const timing = this.fastMode ? FAST_TIMING : NORMAL_TIMING;
    const stopPromises = this.reels.map((reel, i) => {
      const delay = timing.spinMs + i * timing.staggerMs;
      const landedSymbol = outcome.reelTargets[i][1];
      // Audio hook fires on impact (when the reel first reaches its target), not
      // after the full landingMs bounce-settle — otherwise the stop sound lands
      // noticeably late relative to the 3 reels' actual visual stops.
      const onImpact = () => playReelStop(reel.reelIndex, landedSymbol, this.fastMode);

      if (!this.fastMode) return reel.stop(delay, timing.landingMs, onImpact);

      // Turbo mode: both the reel's visual landing and its stop chime are snapped
      // onto the track's 16th-note grid (see getTurboStopQuantizeDelay()) rather than
      // firing at `delay` unconditionally — since every reel shares the same delay
      // here (FAST_TIMING.staggerMs is 0), they all snap to the identical
      // beat-aligned instant instead of independently drifting. The quantize amount
      // is sampled fresh right when `delay` elapses (not at spin start), so it
      // reflects musicMain's actual position at that moment. Wrapped in
      // setRhythmTimeout (not a raw setTimeout) so backgroundGuard.js can flush it
      // immediately if the tab gets backgrounded mid-wait.
      return new Promise((resolve) => {
        setTimeout(() => {
          const quantizeDelay = getTurboStopQuantizeDelay();
          setRhythmTimeout(() => {
            reel.stop(0, timing.landingMs, onImpact).then(resolve);
          }, quantizeDelay);
        }, delay);
      });
    });

    await Promise.all(stopPromises);

    if (outcome.isWin) {
      this.setStatus(outcome.tier.label, true);

      if (outcome.isBlackout) {
        // Big win: a 9-tile blackout spans all 3 rows, not just the payline, so a
        // single-line dash doesn't represent it (would need 3 lines — future work).
        // For now, skip the dash and celebrate every tile.
        this.reels.forEach((reel) => reel.highlightAll());
        playSymbolPulse();
        playWinStinger(outcome.tier.id);
        // Theme layer: the blackout's symbol-specific sound, fired during the on-reel
        // celebration — i.e. between the reels landing and the big win widget appearing.
        playThemeSymbolWin(outcome.payline[0]);
        const allEls = this.reels.flatMap((reel) => reel.getVisibleSymbolEls());
        await Promise.all(allEls.map((el) => this.celebration.celebrate(el)));

        // Quantized entry: waits for the next musical 8th-note boundary before
        // continuing, hard-ducking the music the instant it resolves — the riser and
        // widget below land on that same beat, not whenever the celebration above
        // happened to finish.
        await scheduleBigWinEntry();

        // One-shot stinger the exact moment the overlay screen appears, distinct from
        // playWinStinger above (which already fired earlier, during the on-reel
        // celebration).
        playBigWinIntro();
        // Big win widget takes over from here: dims the cabinet, rolls the massive
        // counter, runs the coin fountain, and waits for the player to collect.
        await this.bigWinWidget.show(outcome.tier.winAmount, BIG_ROLLUP_MS);
        // Covers collecting early (before the roll-up's own natural stop already
        // handled this) — idempotent, so this is a harmless no-op otherwise.
        stopBigWinRiser();
      } else {
        this.reels.forEach((reel) => reel.highlightPayline());

        // Strict sequence: reels stopped -> dash connects -> symbols pulse -> (future
        // money counter picks up from here).
        const paylineEls = this.reels.map((reel) => reel.getPaylineSymbolEl()).filter(Boolean);
        this._wireSmallWinPulseAudio(paylineEls[0]);
        playWinLineDash();
        await this.winLine.dash(paylineEls[1] || paylineEls[0]);

        playSymbolPulse();
        playWinStinger(outcome.tier.id);
        // Theme layer: small-win + every distinct symbol in the payline fire
        // simultaneously. The 3 uniform tiers reduce to a single symbol; the mixed
        // Wild-assist tier plays both winSymbolWild and winSymbol01 together.
        playThemeSmallWin([...new Set(outcome.payline)]);
        await Promise.all([...paylineEls.map((el) => this.celebration.celebrate(el)), this.winLine.hide()]);

        await this.winCounter.rollUp(outcome.tier.winAmount, SMALL_ROLLUP_MS, "small");
      }
    } else {
      this.setStatus("No win — spin again", false);
    }

    this.isSpinning = false;
  }

  setStatus(text, isWin) {
    if (!this.resultEl) return;
    this.resultEl.textContent = text;
    this.resultEl.classList.toggle("result-readout--win", isWin);
  }

  // Ties playSmallWinBlink() to the actual .symbol--win CSS animation (3 iterations
  // of symbol-win-pulse, see styles.css) instead of guessing at its timing with a
  // fixed delay. Every winning tile gets the class in the same synchronous tick
  // (highlightPayline(), above), so they animate in perfect lockstep — listening on
  // just one reference element drives all 3 pulses without re-triggering per tile.
  // animationiteration fires between iterations only (twice, for 3 total), so pulse 1
  // fires immediately here and the other two ride that event; the listener detaches
  // itself once it's fired its share, since the win class is cleared well before the
  // next spin could add it again.
  _wireSmallWinPulseAudio(el) {
    if (!el) return;
    playSmallWinBlink();
    let firedCount = 1;
    const onIteration = () => {
      playSmallWinBlink();
      firedCount += 1;
      if (firedCount >= 3) el.removeEventListener("animationiteration", onIteration);
    };
    el.addEventListener("animationiteration", onIteration);
  }
}
