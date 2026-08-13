import { spinSequencer } from "./SpinSequence.js";
import { ReelController } from "../reels/ReelController.js";
import { WinLineController } from "../effects/WinLineController.js";
import { SymbolCelebration } from "../effects/SymbolCelebration.js";
import { WinCounter } from "../effects/WinCounter.js";
import { BigWinWidget } from "../effects/BigWinWidget.js";
import {
  playReelStart,
  playReelStop,
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
      return reel.stop(delay, timing.landingMs, () => {
        playReelStop(reel.reelIndex, landedSymbol, this.fastMode);
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
        playWinLineDash();
        await this.winLine.dash(paylineEls[1] || paylineEls[0]);

        playSymbolPulse();
        playWinStinger(outcome.tier.id);
        // Theme layer: small-win + every distinct symbol in the payline fire
        // simultaneously. The 3 uniform tiers reduce to a single symbol; the mixed
        // Wild-assist tier plays both winSymbolWild and winSymbol01 together.
        playThemeSmallWin([...new Set(outcome.payline)]);
        await Promise.all([...paylineEls.map((el) => this.celebration.celebrate(el)), this.winLine.hide()]);

        // Post-celebration: the payline tiles are still mid-blink (.symbol--win's
        // 3-iteration pulse, see styles.css) at this point — this is the audio accent
        // for that, fired once the celebration pop itself has finished.
        playSmallWinBlink();

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
}
