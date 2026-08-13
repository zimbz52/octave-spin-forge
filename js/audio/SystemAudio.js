// Loads the "systemSounds" sprite sheet (Howler.js) from its external JSON config and
// exposes a single play(name) entry point for global UI sounds shared across the whole
// cabinet (hover/click/reel-start/etc). Theme-specific gameplay sounds get their own
// managers later — this one only ever holds the universal system sprite sheet.
import { dbToGain } from "./audioUtils.js";

const CONFIG_URL = "src/audio/systemSounds.json";

const PITCH_RATE_MIN = 0.94;
const PITCH_RATE_MAX = 1.06;

// Bet-selector arrow click pitch-bending: consecutive clicks within this many ms of
// each other nudge uiBet's rate further from center in whichever direction was just
// clicked (up = higher, down = lower), capped at BET_CLICK_RATE_MAX/MIN — a quick
// flurry of clicks audibly "revs" up or down. A gap longer than this resets back to
// exactly 1.0, so an isolated click always sounds neutral. Deliberately not
// randomized like play()'s other sprites — this rate is a controlled, directional
// effect tied to click speed, not jitter.
const BET_CLICK_CONSECUTIVE_MS = 500;
const BET_CLICK_RATE_STEP = 0.05;
const BET_CLICK_RATE_MAX = 1.5;
const BET_CLICK_RATE_MIN = 0.5;

// The whole system UI bank plays a bit hot relative to the theme/SFX layers — pulled
// down a flat -3dB so clicks/hovers sit back in the mix instead of poking out front.
const SYSTEM_VOLUME_DB = -3;

// Reusable utility: a slightly randomized playback rate (+/- ~1 semitone) so repeated
// triggers of the same sound don't sound audibly identical, without detuning enough
// to break sync with the visuals it's tied to.
export function randomizedPitchRate() {
  return PITCH_RATE_MIN + Math.random() * (PITCH_RATE_MAX - PITCH_RATE_MIN);
}

class SystemAudio {
  constructor() {
    this.howl = null;
    this.ready = false;
    this._spriteNames = new Set();
    // Tracks the currently-looping systemic small-win money-counter sound (the
    // fallback half of playSmallWinDigits()/stopSmallWinDigits() below) — mirrors
    // ThemeAudio.smallWinDigitsId exactly, same reason: need the id later to stop it.
    this.smallWinDigitsId = null;
    // Bet-selector pitch-bend state — see playBetClick()/BET_CLICK_* above.
    this._betClickRate = 1.0;
    this._betClickLastAt = 0;
  }

  async init() {
    let bank;
    try {
      const response = await fetch(CONFIG_URL);
      const rawText = await response.text();
      // The source file is a single `"systemSounds": {...}` entry, not a complete
      // JSON document — wrapped (not reformatted) here so it parses as valid JSON,
      // per the requirement to keep the file's own spacing/format untouched.
      bank = JSON.parse(`{${rawText}}`).systemSounds;
    } catch (err) {
      console.warn("[SystemAudio] Failed to load systemSounds.json:", err);
      return;
    }

    const sprite = {};
    const spriteNames = new Set();
    bank.sounds.forEach((sound) => {
      // Howler sprite offsets/durations are in milliseconds; the config gives seconds.
      sprite[sound.name] = [sound.start * 1000, sound.duration * 1000];
      spriteNames.add(sound.name);
    });

    this.howl = new Howl({
      src: [bank.src],
      sprite,
      volume: dbToGain(SYSTEM_VOLUME_DB),
      onload: () => {
        this._spriteNames = spriteNames;
        this.ready = true;
      },
      onloaderror: (id, err) => {
        console.warn("[SystemAudio] Failed to load audio sprite:", err);
      },
    });
  }

  // Plays a named sprite sound with a randomized pitch. No-ops quietly if the sprite
  // hasn't finished loading yet, or `name` isn't in the sprite map — the latter is
  // what lets a hook be wired up ahead of the sprite actually existing (see
  // audioHooks.js's playWinLineDash()/playSmallWinBlink()): safe to call freely,
  // becomes live automatically the moment systemSounds.json defines the name.
  play(name) {
    if (!this.ready || !this.howl || !this._spriteNames.has(name)) return;
    const id = this.howl.play(name);
    this.howl.rate(randomizedPitchRate(), id);
  }

  // Picks a random sprite name matching "<prefix><NN>" from whatever the bank
  // actually defines — same pattern as ThemeAudio._randomAvailableIndexedName().
  // Returns null (caller no-ops) if the bank defines none at all for this prefix.
  _randomAvailableIndexedName(prefix) {
    const pattern = new RegExp(`^${prefix}\\d+$`);
    const matches = [...this._spriteNames].filter((name) => pattern.test(name));
    if (matches.length === 0) return null;
    return matches[Math.floor(Math.random() * matches.length)];
  }

  // --- Small win money counter (systemic fallback) ---
  // Only ever used when the active theme doesn't define its own winSmallDigits/
  // winSmallDigitsEnd pair — audioHooks.js decides which bank to use (see
  // startWinRollup()/stopWinRollup()), not this class. moneyCounter01/02 (randomly
  // picked, for variety across plays) + moneyCounterEnd, per the systemSounds v1
  // refresh — both the loop and the end sting deliberately call this.howl.play()
  // directly rather than the play() wrapper above, so neither gets play()'s
  // randomized pitch: the counter should read as one consistent, in-tune cue across
  // every play, matching the theme-bank version's behavior (ThemeAudio._play() never
  // randomizes pitch either).
  playSmallWinDigits() {
    if (!this.ready || !this.howl) return;
    const name = this._randomAvailableIndexedName("moneyCounter");
    if (!name) return;
    this.smallWinDigitsId = this.howl.play(name);
    this.howl.loop(true, this.smallWinDigitsId);
  }

  stopSmallWinDigits() {
    if (!this.howl || this.smallWinDigitsId === null) return;
    const id = this.smallWinDigitsId;
    this.smallWinDigitsId = null;
    this.howl.once("stop", () => this.howl.play("moneyCounterEnd"), id);
    this.howl.stop(id);
  }

  // Bet-selector arrow click: plays uiBet with a rate that bends further from 1.0 the
  // faster/more consecutively the arrows are clicked — see BET_CLICK_* above.
  // direction: "up" or "down". Deliberately calls this.howl.play() directly, not the
  // play() wrapper — this rate is a controlled effect, not the wrapper's random jitter.
  playBetClick(direction) {
    if (!this.ready || !this.howl || !this._spriteNames.has("uiBet")) return;

    const now = performance.now();
    if (now - this._betClickLastAt > BET_CLICK_CONSECUTIVE_MS) {
      this._betClickRate = 1.0;
    } else if (direction === "up") {
      this._betClickRate = Math.min(BET_CLICK_RATE_MAX, this._betClickRate + BET_CLICK_RATE_STEP);
    } else {
      this._betClickRate = Math.max(BET_CLICK_RATE_MIN, this._betClickRate - BET_CLICK_RATE_STEP);
    }
    this._betClickLastAt = now;

    const id = this.howl.play("uiBet");
    this.howl.rate(this._betClickRate, id);
  }
}

export const systemAudio = new SystemAudio();
