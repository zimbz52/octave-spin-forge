// Loads the "systemSounds" sprite sheet (Howler.js) from its external JSON config and
// exposes a single play(name) entry point for global UI sounds shared across the whole
// cabinet (hover/click/reel-start/etc). Theme-specific gameplay sounds get their own
// managers later — this one only ever holds the universal system sprite sheet.
import { dbToGain } from "./audioUtils.js";

const CONFIG_URL = "src/audio/systemSounds.json";

const PITCH_RATE_MIN = 0.94;
const PITCH_RATE_MAX = 1.06;

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

  // --- Small win money counter (systemic fallback) ---
  // Only ever used when the active theme doesn't define its own winSmallDigits/
  // winSmallDigitsEnd pair — audioHooks.js decides which bank to use (see
  // startWinRollup()/stopWinRollup()), not this class. Same guarded/chained shape as
  // ThemeAudio.playSmallWinDigits()/stopSmallWinDigits(), and deliberately calls
  // this.howl.play() directly rather than the play() wrapper above — the money
  // counter loop shouldn't get play()'s randomized pitch, matching the theme-bank
  // version's behavior (ThemeAudio never pitch-randomizes anything), so which bank
  // ends up serving a given theme sounds consistent either way.
  playSmallWinDigits() {
    if (!this.ready || !this.howl || !this._spriteNames.has("winSmallDigits")) return;
    this.smallWinDigitsId = this.howl.play("winSmallDigits");
    this.howl.loop(true, this.smallWinDigitsId);
  }

  stopSmallWinDigits() {
    if (!this.howl || this.smallWinDigitsId === null) return;
    const id = this.smallWinDigitsId;
    this.smallWinDigitsId = null;
    const hasEndSting = this._spriteNames.has("winSmallDigitsEnd");
    this.howl.once(
      "stop",
      () => {
        if (hasEndSting) this.howl.play("winSmallDigitsEnd");
      },
      id
    );
    this.howl.stop(id);
  }
}

export const systemAudio = new SystemAudio();
