// Theme-specific Howler instance — a universal template every theme's sound bank
// plugs into. All playback methods here are generic game-mechanic concepts (reel
// start/stop/turbo, small win, symbol win, big win riser); nothing theme-specific
// appears anywhere except the config file path itself, which is derived from the
// active theme's name.

import { dbToGain } from "./audioUtils.js";

// Our 5 generic symbols map onto the sprite-naming convention every theme's sound
// bank is expected to follow (winSymbol01-04, winSymbolWild) — this mapping is part
// of the abstract template, not tied to any one theme. symbol04 (formerly Scatter,
// see SpinSequence.js) is a special case: every theme bank provided so far still only
// defines winSymbolScatter, not winSymbol04 — playSymbolWin() below falls back to it
// dynamically rather than this map needing two entries.
const SYMBOL_SPRITE_MAP = {
  symbol01: "winSymbol01",
  symbol02: "winSymbol02",
  symbol03: "winSymbol03",
  symbol04: "winSymbol04",
  wild: "winSymbolWild",
};

// winSmall sits a bit hot relative to everything else across every theme's bank —
// pulled down by default, same rationale/mechanism as SystemAudio's -3dB UI trim.
const SMALL_WIN_VOLUME_DB = -2;

// Ducks musicMain out of the way while the big win riser plays, so the riser reads
// clearly instead of fighting the music bed for space.
const MUSIC_DUCK_DB = -3;
const MUSIC_DUCK_MS = 1000;

// musicMain fades in from silence rather than snapping straight to its target volume —
// see _playMusicLoop().
const MUSIC_FADE_IN_MS = 2000;

function randomIndexedName(prefix, count) {
  const n = Math.floor(Math.random() * count) + 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

class ThemeAudio {
  constructor() {
    this.howl = null;
    this.musicId = null;
    this.ambientId = null;
    this.riserId = null;
    this.ready = false;
    this.currentTheme = null;
    this._loadToken = 0;
    this._spriteNames = new Set();
    // Persists across theme switches/teardowns — the fader position shouldn't reset
    // itself just because the player changed themes.
    this.musicVolume = 1;
    // musicMain's volume right before a duck, so the fade-in on winBigRiserEnd
    // restores exactly where it left off rather than assuming a hardcoded 1.0.
    this._musicVolumeBeforeDuck = null;
  }

  // Loads and activates a theme's audio bank by name (e.g. "egypt"). Strictly
  // singleton: an already-active theme is a no-op, switching themes tears down the
  // previous Howl instance completely (stop + unload, not just stop) before the new
  // one loads, and a superseded in-flight load (rapid theme switching) is discarded
  // when it resolves — so the game can never end up with two overlapping instances,
  // music loops, or voice beds.
  async loadTheme(themeName) {
    if (this.currentTheme === themeName && this.ready) return;

    const token = ++this._loadToken;
    this._teardown();
    this.currentTheme = themeName;

    let bank;
    try {
      const response = await fetch(`src/audio/${themeName}Sounds.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rawText = await response.text();
      // Each config file is a single `"<theme>Sounds": {...}` entry, not a complete
      // JSON document — wrapped (not reformatted) so it parses as valid JSON, per the
      // requirement to keep the file's own spacing/format untouched.
      bank = JSON.parse(`{${rawText}}`)[`${themeName}Sounds`];
    } catch (err) {
      console.warn(`[ThemeAudio] Failed to load theme audio config for "${themeName}":`, err);
      return;
    }

    if (token !== this._loadToken) return; // a newer loadTheme() call superseded this one

    const sprite = {};
    const spriteNames = new Set();
    bank.sounds.forEach((sound) => {
      sprite[sound.name] = [sound.start * 1000, sound.duration * 1000];
      spriteNames.add(sound.name);
    });

    // Awaited all the way to onload/onloaderror (not just the JSON parse above) — a
    // caller gating a visual reveal on this (the fade lift) needs the audio to
    // actually be ready to play, not just configured, or gameStart/the ambient loop
    // would start audibly *after* the reveal instead of right at it.
    await new Promise((resolve) => {
      const howl = new Howl({
        src: [bank.src],
        sprite,
        onload: () => {
          if (token !== this._loadToken) {
            howl.unload(); // superseded while loading — don't let it start playing
            resolve();
            return;
          }
          this.howl = howl;
          this._spriteNames = spriteNames;
          this.ready = true;
          this._startThemeIntro();
          resolve();
        },
        onloaderror: (id, err) => {
          console.warn(`[ThemeAudio] Failed to load audio sprite for "${themeName}":`, err);
          resolve(); // don't hang a caller (e.g. the fade lift) forever on a load error
        },
      });
    });
  }

  _teardown() {
    if (this.howl) {
      this.howl.stop();
      this.howl.unload();
    }
    this.howl = null;
    this.musicId = null;
    this.ambientId = null;
    this.riserId = null;
    this.ready = false;
    this._spriteNames = new Set();
    this._musicVolumeBeforeDuck = null;
  }

  // gameAmbLP (the ambient SFX bed), gameStart (if the bank has one), and musicMain
  // all start together — musicMain no longer waits for gameStart to finish before
  // entering; it fades in underneath it instead (see _playMusicLoop()).
  _startThemeIntro() {
    this._playAmbientLoop();
    if (this._spriteNames.has("gameStart")) {
      this._play("gameStart");
    }
    this._playMusicLoop();
  }

  // SFX layer, not music — deliberately never touched by setMusicVolume(). Only
  // Master Mute (global Howler.mute()) should ever silence this.
  _playAmbientLoop() {
    if (!this._spriteNames.has("gameAmbLP")) return;
    if (this.ambientId !== null && this.howl.playing(this.ambientId)) return; // singleton
    this.ambientId = this.howl.play("gameAmbLP");
    this.howl.loop(true, this.ambientId);
  }

  _playMusicLoop() {
    // Strict singleton: never start a second overlapping music-loop instance.
    if (this.musicId !== null && this.howl.playing(this.musicId)) return;
    this.musicId = this.howl.play("musicMain");
    this.howl.loop(true, this.musicId);
    // Fades in from silence up to the fader's current target (0 if the player already
    // muted the music) rather than snapping straight there — musicMain now starts
    // alongside gameStart instead of waiting for it, so this softens the moment they
    // overlap instead of both hitting full volume at once. Howler's fade() sets the
    // starting volume itself; no separate .volume(0, id) call needed first.
    this.howl.fade(0, this.musicVolume, MUSIC_FADE_IN_MS, this.musicId);
  }

  // Sets only the music track's volume (0.0-1.0), leaving UI sounds and thematic SFX
  // (including the ambient loop) untouched. Persists across theme switches so a newly-
  // loaded theme's music starts at whatever level the player last set the fader to.
  // Master Mute overrides this at the Howler.mute() level regardless of this value —
  // this only ever controls musicMain's own gain, never whether it's globally audible.
  setMusicVolume(volume) {
    this.musicVolume = volume;
    if (this.howl && this.musicId !== null) {
      this.howl.volume(volume, this.musicId);
    }
  }

  _play(name) {
    if (!this.ready || !this.howl) return null;
    return this.howl.play(name);
  }

  // --- Reel mechanics ---

  playReelStart() {
    this._play(randomIndexedName("reelStart", 5));
  }

  playReelStop() {
    this._play(randomIndexedName("reelStop", 5));
  }

  // Fast mode replaces the standard start/stop sequence with a single turbo cue.
  playReelTurbo() {
    this._play(randomIndexedName("reelTurbo", 5));
  }

  // --- Win mechanics ---

  playSmallWin() {
    const id = this._play(randomIndexedName("winSmall", 4));
    if (id !== null) this.howl.volume(dbToGain(SMALL_WIN_VOLUME_DB), id);
  }

  // Dynamically checks the active bank for the symbol's own sprite first; symbol04
  // specifically falls back to winSymbolScatter if winSymbol04 isn't defined — every
  // theme bank provided so far predates the Scatter -> Symbol04 rename (see
  // SpinSequence.js) and still only has the old Scatter-named sprite.
  playSymbolWin(symbolId) {
    const spriteName = SYMBOL_SPRITE_MAP[symbolId];
    if (!spriteName) return;
    if (this._spriteNames.has(spriteName)) {
      this._play(spriteName);
      return;
    }
    if (symbolId === "symbol04" && this._spriteNames.has("winSymbolScatter")) {
      this._play("winSymbolScatter");
    }
  }

  // --- Big win climax ---

  playBigWinRiser() {
    this.riserId = this._play("winBigRiser");
    this._duckMusic();
  }

  // Stops the riser and, from its own stop callback, immediately fires the riser-end
  // sting — so winBigRiserEnd is a direct consequence of winBigRiser stopping, not
  // just a sequential call. Music comes back up (fade-in) at the same moment.
  stopBigWinRiser() {
    if (!this.ready || !this.howl || this.riserId === null) return;
    const id = this.riserId;
    this.riserId = null;
    this.howl.once(
      "stop",
      () => {
        this._play("winBigRiserEnd");
        this._unduckMusic();
      },
      id
    );
    this.howl.stop(id);
  }

  // -3dB / 1s fade-out on musicMain while the riser plays, so it doesn't fight the
  // riser for space. Captures the current volume rather than assuming 1.0, so it
  // restores to wherever the music actually was.
  _duckMusic() {
    if (!this.howl || this.musicId === null || !this.howl.playing(this.musicId)) return;
    const currentVolume = this.howl.volume(this.musicId);
    this._musicVolumeBeforeDuck = currentVolume;
    this.howl.fade(currentVolume, currentVolume * dbToGain(MUSIC_DUCK_DB), MUSIC_DUCK_MS, this.musicId);
  }

  _unduckMusic() {
    if (!this.howl || this.musicId === null) return;
    const restoreTo = this._musicVolumeBeforeDuck ?? 1;
    this._musicVolumeBeforeDuck = null;
    this.howl.fade(this.howl.volume(this.musicId), restoreTo, MUSIC_DUCK_MS, this.musicId);
  }

  // One-shot stinger the instant the big win overlay screen appears.
  playBigWinIntro() {
    this._play("winBigT1");
  }

  // --- Powerbet ---

  // powerBetOn/powerBetOff don't exist in any theme bank yet (expected soon per
  // product) — unlike playSymbolWin()'s Scatter fallback, there's no substitute sprite
  // to fall back to here, so this just checks _spriteNames and no-ops quietly if
  // missing rather than risking an undefined-sprite call into Howler. Safe to call
  // freely; becomes live automatically the moment a bank actually defines these.
  playPowerBetOn() {
    if (this._spriteNames.has("powerBetOn")) this._play("powerBetOn");
  }

  playPowerBetOff() {
    if (this._spriteNames.has("powerBetOff")) this._play("powerBetOff");
  }
}

export const themeAudio = new ThemeAudio();
