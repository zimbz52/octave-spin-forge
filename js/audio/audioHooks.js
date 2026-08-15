// Stub hooks marking where the audio engine plugs into the spin lifecycle — plus the
// welcome screen's engine slider (Step 46), the one thing that fires before any game
// state exists. Left as console.log placeholders until Howler wiring lands for each —
// except the ones now wired to real system/theme sounds. Single source of truth for
// "what's actually implemented vs. still a stub" — check here first in any new session.
import { systemAudio } from "./SystemAudio.js";
import { themeAudio } from "./ThemeAudio.js";

// Fires the instant a theme-switch fade-to-black begins. The systemSounds sprite
// sheet doesn't have a transition-whoosh sound yet — this is purely the firing logic,
// left as a placeholder (no systemAudio.play call) until that sound exists.
export function playTransitionWhoosh() {
  console.log("[audio hook] playTransitionWhoosh()");
}

// Fires the instant the user actually selects a new theme — from the init menu's
// startup terminal or the in-game dropdown alike — not once the fade/reveal finishes.
// Named "outro" for historical reasons (it used to fire at the reveal instead; see
// ThemeTransition._transitionTo()), kept distinct from playTransitionWhoosh() above,
// which is still an unwired placeholder marking the same moment on the visual side.
// "uiTransition", per the systemSounds v1 refresh; randomly pitched per play by
// SystemAudio.play().
export function playTransitionOutro() {
  console.log("[audio hook] playTransitionOutro()");
  systemAudio.play("uiTransition");
}

// isFastMode: turbo mode replaces the standard reel start/stop sound sequence with a
// single turbo cue, so this only plays the theme's slow reel-start when it's off.
export function playReelStart(isFastMode) {
  console.log(`[audio hook] playReelStart(isFastMode=${!!isFastMode})`);
  systemAudio.play("uiReelStart");
  if (isFastMode) {
    themeAudio.playReelTurbo();
  } else {
    themeAudio.playReelStart();
  }
}

// reelIndex: 0-based reel that just landed. symbol: the payline (middle-row) symbol
// it landed on, so the future audio engine can pick a matching stop sound per symbol.
// isFastMode: suppressed for the time being — GameController quantizes Turbo reel
// stops onto the 16th-note grid (see getTurboStopQuantizeDelay() below) so all 3
// reels land in genuine unison, which would make 3 simultaneous reelStop samples read
// as one locked-in hit rather than a phasey overlap... in principle. The existing
// reelStop bank wasn't sound-designed with 3-at-once playback in mind, so this stays
// off until a chime actually meant for that exists. The quantization itself (the
// visual landing) is unaffected — only the audio call here is skipped.
export function playReelStop(reelIndex, symbol, isFastMode) {
  console.log(`[audio hook] playReelStop(reelIndex=${reelIndex}, symbol="${symbol}", isFastMode=${!!isFastMode})`);
  if (!isFastMode) {
    themeAudio.playReelStop();
  }
}

// Milliseconds until the next 16th-note boundary of the currently-playing musicMain,
// per the active theme's BPM — GameController adds this to a Turbo spin's own reel-
// stop timing so the visual landing and the stop chime both snap onto the musical
// grid instead of firing at a fixed, beat-agnostic offset. 0 (fire immediately) if
// there's no music actually playing to measure against.
export function getTurboStopQuantizeDelay() {
  return themeAudio.getTurboStopQuantizeDelay();
}

// tier: the win tier id ("small1"..."small4", "big_blackout"), or omitted for a loss.
export function playWinStinger(tier) {
  console.log(`[audio hook] playWinStinger(tier="${tier}")`);
}

// symbolIds: the winning symbol(s) — a single id, or an array when the line is a
// wild-assisted combo (e.g. ["wild", "symbol01"]), in which case every distinct
// symbol's layer plays together, not just one. Fires the theme's small-win layer and
// all symbol-specific layer(s) at exactly the same time — small wins only, the big
// win blackout uses playThemeSymbolWin below instead (its payline is never mixed).
export function playThemeSmallWin(symbolIds) {
  const ids = Array.isArray(symbolIds) ? symbolIds : [symbolIds];
  console.log(`[audio hook] playThemeSmallWin(symbolIds=${JSON.stringify(ids)})`);
  themeAudio.playSmallWin();
  ids.forEach((symbolId) => themeAudio.playSymbolWin(symbolId));
  // Vertical-layering "winSmalls" event — see ThemeAudio.notifySmallWin(). No-ops
  // quietly on every theme until a bank defines a musicIntense layer.
  themeAudio.notifySmallWin();
}

// symbolId: the blackout's symbol. Fires just the symbol-specific layer (no small-win
// layer) during the big win's on-reel celebration, before the big win widget appears.
export function playThemeSymbolWin(symbolId) {
  console.log(`[audio hook] playThemeSymbolWin(symbolId="${symbolId}")`);
  themeAudio.playSymbolWin(symbolId);
}

// Fires the instant the win-line starts sweeping across the reels to connect the
// winning symbols — i.e. the small line *before* the small-win celebration pop/blink
// effects begin. Systemic (not per-theme), same as SystemAudio's other UI sounds: a
// tiny tick ("uiDash", per the systemSounds v1 refresh), randomly pitched +/-1
// semitone by SystemAudio.play() itself, so it doesn't read identically every single
// small win.
export function playWinLineDash() {
  console.log("[audio hook] playWinLineDash()");
  systemAudio.play("uiDash");
}

// Fires the instant the winning symbols start their scale/glow/twitch reaction,
// right after the win-line has fully connected them.
export function playSymbolPulse() {
  console.log("[audio hook] playSymbolPulse()");
}

// Fires once per iteration of the .symbol--win blink pulse (3 total per small win —
// see GameController._wireSmallWinPulseAudio(), which drives these 3 calls off the
// actual CSS animation's animationiteration events rather than a guessed delay; see
// the win-pulse keyframes in styles.css for the visual side). Systemic, same shape as
// playWinLineDash() above: a tiny tick ("uiPulse", per the systemSounds v1 refresh),
// randomly pitched per play by SystemAudio.play().
export function playSmallWinBlink() {
  console.log("[audio hook] playSmallWinBlink()");
  systemAudio.play("uiPulse");
}

// Small-win money counter: prefers the active theme's own winSmallDigits/
// winSmallDigitsEnd pair (China defines one; see ThemeAudio.playSmallWinDigits()) and
// only falls back to the generic systemic pair (SystemAudio.playSmallWinDigits(),
// same sprite names, different bank) if the active theme doesn't define one.
// Re-checked on every roll-up rather than cached, so a theme switch mid-session is
// always evaluated fresh. Neither systemSounds.json's winSmallDigits/winSmallDigitsEnd
// exist yet — this is the fallback half left ready to go the moment they're added,
// same as playWinLineDash()/playSmallWinBlink() above.
let smallWinDigitsUsingSystemFallback = false;

function startSmallWinDigits() {
  smallWinDigitsUsingSystemFallback = !themeAudio.hasSmallWinDigits();
  if (smallWinDigitsUsingSystemFallback) {
    systemAudio.playSmallWinDigits();
  } else {
    themeAudio.playSmallWinDigits();
  }
}

function stopSmallWinDigits() {
  if (smallWinDigitsUsingSystemFallback) {
    systemAudio.stopSmallWinDigits();
  } else {
    themeAudio.stopSmallWinDigits();
  }
}

// type: "small" or "big". Fires the instant the counter starts ticking up from 0 —
// the cue to start a looping buildup SFX bed. Big wins additionally start the theme's
// climax riser at exactly this moment.
export function startWinRollup(type) {
  console.log(`[audio hook] startWinRollup(type="${type}")`);
  if (type === "big") themeAudio.playBigWinRiser();
  if (type === "small") startSmallWinDigits();
}

// type: "small" or "big". Fires the instant the counter hits its final amount — the
// cue for the payoff/reward ding, distinct from (and slightly before) the rollup
// formally wrapping up.
export function triggerWinClimax(type) {
  console.log(`[audio hook] triggerWinClimax(type="${type}")`);
}

// type: "small" or "big". Fires once the counter UI has fully settled after the
// climax — the cue to stop/fade the looping buildup SFX bed. Big wins additionally
// stop the riser here, which itself chains straight into the riser-end sting.
export function stopWinRollup(type) {
  console.log(`[audio hook] stopWinRollup(type="${type}")`);
  if (type === "big") themeAudio.stopBigWinRiser();
  if (type === "small") stopSmallWinDigits();
}

// Fires as soon as a Big Win is confirmed (blackout), before its entry — computes and
// waits out the delay to the next musical 8th-note boundary of the currently-playing
// musicMain (see ThemeAudio.scheduleBigWinEntry()), pausing the adaptive-music idle
// cooldown for the duration and hard-ducking both music layers to silence the instant
// it resolves. Callers should await this, then fire the riser/reveal the widget right
// after — both land on the same beat the duck does.
export function scheduleBigWinEntry() {
  console.log("[audio hook] scheduleBigWinEntry()");
  return themeAudio.scheduleBigWinEntry();
}

// Fires the exact moment the big win overlay screen appears — a one-shot stinger
// distinct from playWinStinger (which already fired earlier, during the on-reel
// celebration that precedes the widget showing up).
export function playBigWinIntro() {
  console.log("[audio hook] playBigWinIntro()");
  themeAudio.playBigWinIntro();
}

// Fires when the big win widget is dismissed (Collect, or clicking the backdrop).
// themeAudio.stopBigWinRiser() is idempotent — if the roll-up already finished
// naturally, stopWinRollup already stopped the riser and this is a harmless no-op;
// if the player collected early, this is what actually stops it and chains straight
// into winBigRiserEnd instead of leaving the riser playing out its full length.
export function stopBigWinRiser() {
  console.log("[audio hook] stopBigWinRiser()");
  themeAudio.stopBigWinRiser();
}

// Fires the instant the Powerbet toggle turns on/off (main.js). Deliberately routed
// through ThemeAudio rather than the generic data-sfx-click pattern — themeAudio
// already no-ops safely if powerBetOn/powerBetOff aren't defined in the active bank,
// which no theme currently provides.
export function playPowerBetOn() {
  console.log("[audio hook] playPowerBetOn()");
  themeAudio.playPowerBetOn();
}

export function playPowerBetOff() {
  console.log("[audio hook] playPowerBetOff()");
  themeAudio.playPowerBetOff();
}

// Fires on every enabled bet-selector arrow click (main.js). direction: "up" or
// "down" — see SystemAudio.playBetClick() for the consecutive-click pitch-bend.
export function playBetClick(direction) {
  console.log(`[audio hook] playBetClick(direction="${direction}")`);
  systemAudio.playBetClick(direction);
}

// --- Welcome-screen engine slider (Step 46) ---
// The drag-to-unlock gate's own tactile feedback — see WelcomeScreen.js's
// _wireEngineSlider()/_snapAndUnlock(). Imported there directly (not through
// GameController) since these fire before any game state exists — the gate is its own
// short lifecycle, not a spin event.

// Fires the instant the player first grabs the thumb — the same call site
// WelcomeScreen.js calls unlockAudioContext() from, so this is the earliest sound the
// page is capable of playing (see WelcomeScreen.js for why the unlock moved here).
export function playSliderEngage() {
  console.log("[audio hook] playSliderEngage()");
  systemAudio.play("uiMenuOn");
}

// Fires once per gear notch crossed during the drag. progress: 0-1, how far through
// the drag this notch sits — see SystemAudio.playSliderTick() for the pitch climb.
export function playSliderTick(progress) {
  console.log(`[audio hook] playSliderTick(progress=${progress.toFixed(2)})`);
  systemAudio.playSliderTick(progress);
}

// Fires when a drag is released before the unlock threshold and the thumb springs
// back to 0 — the audio side of "the gear didn't fully turn."
export function playSliderCancel() {
  console.log("[audio hook] playSliderCancel()");
  systemAudio.play("uiMenuOff");
}

// Fires the instant the drag crosses the unlock threshold — the heavy mechanical
// "locks home" moment, meant to be the single most weighty sound in this sequence.
// The systemSounds sprite sheet doesn't have a dedicated sound for this yet — left as
// a placeholder (no systemAudio.play call) until one exists, same shape as
// playTransitionWhoosh() above.
export function playSliderLock() {
  console.log("[audio hook] playSliderLock()");
}

// Fires alongside the camera-shutter sweep that follows a successful unlock — reuses
// the same "uiTransition" cue as a real theme reveal (playTransitionOutro() above), so
// every "screen wipes to reveal something new" moment in the app shares one motif.
export function playSliderReveal() {
  console.log("[audio hook] playSliderReveal()");
  systemAudio.play("uiTransition");
}
