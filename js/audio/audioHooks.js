// Stub hooks marking where the audio engine will plug into the spin lifecycle.
// Left as console.log placeholders until Howler wiring lands for each — except the
// ones now wired to real system/theme sounds.
import { systemAudio } from "./SystemAudio.js";
import { themeAudio } from "./ThemeAudio.js";

// Fires the instant a theme-switch fade-to-black begins. The systemSounds sprite
// sheet doesn't have a transition-whoosh sound yet — this is purely the firing logic,
// left as a placeholder (no systemAudio.play call) until that sound exists.
export function playTransitionWhoosh() {
  console.log("[audio hook] playTransitionWhoosh()");
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
// isFastMode: turbo's single start cue already covers the stop beat, so this is
// suppressed in fast mode rather than firing 3 overlapping stop sounds.
export function playReelStop(reelIndex, symbol, isFastMode) {
  console.log(`[audio hook] playReelStop(reelIndex=${reelIndex}, symbol="${symbol}", isFastMode=${!!isFastMode})`);
  if (!isFastMode) {
    themeAudio.playReelStop();
  }
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
// effects begin. Systemic (not per-theme), same as SystemAudio's other UI sounds:
// a tiny tick, randomly pitched +/-1 semitone by SystemAudio.play() itself, so it
// doesn't read identically every single small win. "smallWinLineTick" doesn't exist
// in systemSounds.json yet — safe to call freely, becomes live automatically the
// moment it's added (see SystemAudio.play()'s own guard).
export function playWinLineDash() {
  console.log("[audio hook] playWinLineDash()");
  systemAudio.play("smallWinLineTick");
}

// Fires the instant the winning symbols start their scale/glow/twitch reaction,
// right after the win-line has fully connected them.
export function playSymbolPulse() {
  console.log("[audio hook] playSymbolPulse()");
}

// Fires once the small-win celebration (SymbolCelebration's pop/glow overlay) has
// fully finished — the audio accent for the 3-iteration .symbol--win blink pulse
// that's still running on the payline tiles at that point (see the win-pulse
// keyframes in styles.css). Systemic, same shape as playWinLineDash() above: a tiny
// tick, randomly pitched per play by SystemAudio.play(), safe to call before
// "smallWinBlinkTick" exists in systemSounds.json.
export function playSmallWinBlink() {
  console.log("[audio hook] playSmallWinBlink()");
  systemAudio.play("smallWinBlinkTick");
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
