// Theme-specific Howler instance — a universal template every theme's sound bank
// plugs into. All playback methods here are generic game-mechanic concepts (reel
// start/stop/turbo, small win, symbol win, big win riser); nothing theme-specific
// appears anywhere except the config file path itself, which is derived from the
// active theme's name.

import { dbToGain } from "./audioUtils.js";
import { getBusForSprite } from "./busRouting.js";
import { devMixer } from "./DevMixer.js";

// Our 5 generic symbols map onto the sprite-naming convention every theme's sound
// bank is expected to follow (winSymbol01-04, winSymbolWild) — this mapping is part
// of the abstract template, not tied to any one theme. symbol04 (formerly Scatter,
// see SpinSequence.js) is a special case: egypt/mexico/arcade/football all predate the
// rename and only define winSymbolScatter, not winSymbol04 — playSymbolWin() below
// falls back to it dynamically rather than this map needing two entries. chinaSounds.json
// is the first bank to define winSymbol04 directly, so it never hits that fallback.
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

// Adaptive vertical layering: a run of small wins keeps the high-energy musicIntense
// layer up for this long past the *most recent* small win, not accumulated across
// several — every new small win resets the countdown back to the full amount rather
// than extending it. Purely wall-clock (setTimeout), so it keeps ticking through reel
// spins/animations rather than pausing for them.
const SMALL_WIN_INTENSITY_COOLDOWN_MS = 10000;

// Overall music trim, independent of the player-facing fader (which stays a full
// 0-100% range) — knocks every actual musicMain gain down 10% on top of whatever the
// fader is set to, rather than changing what the fader itself reports/controls.
const MUSIC_VOLUME_TRIM = 0.9;

class ThemeAudio {
  constructor() {
    this.howl = null;
    this.musicId = null;
    this.musicIntenseId = null;
    this.ambientId = null;
    this.riserId = null;
    this.smallWinDigitsId = null;
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
    // 0 = musicMain fully active (resting state), 1 = musicIntense fully active.
    // Themes with no musicIntense sprite simply never leave 0 — see notifySmallWin().
    this.musicIntensityWeight = 0;
    this._smallWinCooldownTimer = null;
    // True for the duration of an in-flight crossfade (see DevMixer.getCrossfadeMs())
    // so refreshMusicVolume() (fader/mixer changes) doesn't fight Howler's own fade
    // animation mid-flight — it re-applies once the crossfade settles instead.
    this._musicCrossfadeActive = false;
    this._crossfadeSettleTimer = null;
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
    this.musicIntenseId = null;
    this.ambientId = null;
    this.riserId = null;
    this.smallWinDigitsId = null;
    this.ready = false;
    this._spriteNames = new Set();
    this._musicVolumeBeforeDuck = null;
    this.musicIntensityWeight = 0;
    clearTimeout(this._smallWinCooldownTimer);
    this._smallWinCooldownTimer = null;
    clearTimeout(this._crossfadeSettleTimer);
    this._crossfadeSettleTimer = null;
    this._musicCrossfadeActive = false;
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
    this.howl.volume(this._busGain("gameAmbLP"), this.ambientId);
  }

  _playMusicLoop() {
    // Strict singleton: never start a second overlapping music-loop instance.
    if (this.musicId !== null && this.howl.playing(this.musicId)) return;
    if (!this._spriteNames.has("musicMain")) return; // bank defines no music track

    // musicIntense (optional — no bank defines it yet) is started in the same
    // synchronous tick as musicMain, both looping, so the two layers stay phase-locked
    // as one loop played twice rather than two independently-timed loops that merely
    // share a tempo. It plays silently from the start; only its *volume* crossfades
    // later (see notifySmallWin()) — starting it later on the first small win would
    // not be phase-aligned with musicMain's already-in-progress loop position.
    const hasIntense = this._spriteNames.has("musicIntense");

    this.musicId = this.howl.play("musicMain");
    this.howl.loop(true, this.musicId);
    if (hasIntense) {
      this.musicIntenseId = this.howl.play("musicIntense");
      this.howl.loop(true, this.musicIntenseId);
      this.howl.volume(0, this.musicIntenseId);
    }
    this.musicIntensityWeight = 0;

    // Fades in from silence up to the fader's current target (0 if the player already
    // muted the music) rather than snapping straight there — musicMain now starts
    // alongside gameStart instead of waiting for it, so this softens the moment they
    // overlap instead of both hitting full volume at once. Howler's fade() sets the
    // starting volume itself; no separate .volume(0, id) call needed first. musicIntense
    // has nothing to fade in to yet (its target is 0 at rest) so it's left as-is.
    this.howl.fade(0, this._musicTargetVolume(), MUSIC_FADE_IN_MS, this.musicId);
  }

  // Sets only the music track's volume (0.0-1.0), leaving UI sounds and thematic SFX
  // (including the ambient loop) untouched. Persists across theme switches so a newly-
  // loaded theme's music starts at whatever level the player last set the fader to.
  // Master Mute overrides this at the Howler.mute() level regardless of this value —
  // this only ever controls musicMain's own gain, never whether it's globally audible.
  // Stores the raw fader value (0.0-1.0) — MUSIC_VOLUME_TRIM and the dev mixer's
  // busMusic gain are applied only when this turns into an actual Howler gain, so the
  // fader itself still reports/reaches 100%.
  setMusicVolume(volume) {
    this.musicVolume = volume;
    this.refreshMusicVolume();
  }

  // The fader's raw 0.0-1.0 value, with MUSIC_VOLUME_TRIM applied — everywhere the
  // fader's raw value becomes a real Howler volume should go through this, not
  // this.musicVolume directly.
  _scaledMusicVolume() {
    return this.musicVolume * MUSIC_VOLUME_TRIM;
  }

  // _scaledMusicVolume() layered with the dev mixer's busMusic gain for the active
  // theme — the combined fader/trim/bus-gain multiplier shared by *both* music layers.
  // Each layer's actual Howler volume is this multiplied by that layer's own
  // crossfade weight (musicIntensityWeight), not an independent number per layer —
  // see _crossfadeToIntensity()/refreshMusicVolume().
  _musicTargetVolume() {
    return this._scaledMusicVolume() * this._busGain("musicMain");
  }

  // Re-applies the current target volume to whatever's actually playing on musicId
  // (and musicIntenseId, weighted) — called after either the fader or the dev mixer's
  // busMusic slider changes, so a continuous loop reacts live instead of only picking
  // up the new value next time it starts. No-ops harmlessly if music isn't playing
  // yet, and skips while a crossfade is actively animating (see
  // _musicCrossfadeActive) so it doesn't fight Howler's own fade loop mid-flight —
  // _crossfadeToIntensity()'s settle timer calls this again once the fade completes,
  // which is when any fader/mixer change made during that window actually lands.
  refreshMusicVolume() {
    if (!this.howl || this.musicId === null) return;
    if (this._musicCrossfadeActive) return;
    const multiplier = this._musicTargetVolume();
    this.howl.volume((1 - this.musicIntensityWeight) * multiplier, this.musicId);
    if (this.musicIntenseId !== null) {
      this.howl.volume(this.musicIntensityWeight * multiplier, this.musicIntenseId);
    }
  }

  // Same live-refresh idea as refreshMusicVolume(), for the ambient loop's own bus
  // (busAtmosphere) — the ambient loop is the only continuous sound on that bus;
  // gameStart is a one-shot and just picks up the current gain next time it plays.
  refreshAmbientVolume() {
    if (!this.howl || this.ambientId === null) return;
    this.howl.volume(this._busGain("gameAmbLP"), this.ambientId);
  }

  // Called by the dev mixer panel right after a bus slider changes, so whichever
  // continuous sound (if any) lives on that bus updates immediately rather than
  // waiting for its next natural (re)start.
  refreshBusLive(bus) {
    if (bus === "busMusic") this.refreshMusicVolume();
    if (bus === "busAtmosphere") this.refreshAmbientVolume();
  }

  // The dev mixer's per-theme multiplier for whichever bus this sprite belongs to
  // (see busRouting.js) — 1 (no change) for sprites with no defined bus or a theme
  // that's never been touched in the mixer.
  _busGain(name) {
    const bus = getBusForSprite(name);
    if (!bus) return 1;
    return devMixer.getBusVolume(this.currentTheme, bus);
  }

  // baseVolume is the sprite's own intended volume before any bus gain (1 for plain
  // one-shots, a dB-derived trim for e.g. winSmall — see playSmallWin()) — the dev
  // mixer's bus multiplier always applies on top of it, never replaces it.
  _play(name, baseVolume = 1) {
    if (!this.ready || !this.howl) return null;
    const id = this.howl.play(name);
    this.howl.volume(baseVolume * this._busGain(name), id);
    return id;
  }

  // Picks a random sprite name matching "<prefix><NN>" from whatever the active bank
  // actually defines, rather than assuming every bank provides a fixed count (reelStart
  // 5, reelTurbo 5, winSmall 4, etc.) — chinaSounds.json only defines 3 reelStart/
  // reelTurbo variants, fewer than every earlier bank, which is exactly the case this
  // guards against: calling Howler with a sprite name the active bank never declared.
  // Returns null (caller no-ops) if the bank defines none at all for this prefix.
  //
  // Naming mismatches (a prefix's words in the wrong order, etc.) are deliberately NOT
  // handled here via a fallback prefix list — see "Reverting the naming fallbacks
  // (Step 19)" in ARCHITECTURE.md. Fix the source JSON directly when that happens.
  _randomAvailableIndexedName(prefix) {
    const pattern = new RegExp(`^${prefix}\\d+$`);
    const matches = [...this._spriteNames].filter((name) => pattern.test(name));
    if (matches.length === 0) return null;
    return matches[Math.floor(Math.random() * matches.length)];
  }

  // --- Reel mechanics ---

  playReelStart() {
    const name = this._randomAvailableIndexedName("reelStart");
    if (name) this._play(name);
  }

  playReelStop() {
    const name = this._randomAvailableIndexedName("reelStop");
    if (name) this._play(name);
  }

  // Fast mode replaces the standard start/stop sequence with a single turbo cue.
  playReelTurbo() {
    const name = this._randomAvailableIndexedName("reelTurbo");
    if (name) this._play(name);
  }

  // --- Adaptive music: vertical layering (musicMain <-> musicIntense) ---

  // Called once per small win (see audioHooks.js's playThemeSmallWin()). No-ops
  // entirely if the active theme never started a musicIntense layer (see
  // _playMusicLoop()) — vertical layering is opt-in per bank, same "silently does
  // nothing until a bank defines the sprite" contract as winSmallDigits/powerBetOn.
  // Each call resets a strict SMALL_WIN_INTENSITY_COOLDOWN_MS countdown back to its
  // full length rather than extending an existing one — a burst of small wins holds
  // the intense layer up for 10s past the *last* one, not 10s per win.
  notifySmallWin() {
    if (this.musicIntenseId === null) return;

    if (this.musicIntensityWeight < 1) this._crossfadeToIntensity(1);

    clearTimeout(this._smallWinCooldownTimer);
    this._smallWinCooldownTimer = setTimeout(() => {
      this._crossfadeToIntensity(0);
    }, SMALL_WIN_INTENSITY_COOLDOWN_MS);
  }

  // Crossfades musicMain and musicIntense to the given intensity weight (1 = intense
  // fully up, 0 = back to musicMain) over the active theme's dev-mixer crossfade
  // duration (see DevMixer.getCrossfadeMs(), customizable live from the Dev Mixer
  // panel, defaults to 1000ms), using Howler's own fade() on each layer's actual
  // current volume — not an assumed starting point, so a crossfade triggered mid-fade
  // (rapid small wins) still animates smoothly from wherever the layers actually are
  // rather than jumping. The duration is read fresh at the start of each crossfade, so
  // a mixer change only affects the *next* crossfade, never distorts one in flight.
  _crossfadeToIntensity(weight) {
    if (!this.howl || this.musicId === null || this.musicIntenseId === null) return;
    this.musicIntensityWeight = weight;
    const multiplier = this._musicTargetVolume();
    const mainTarget = (1 - weight) * multiplier;
    const intenseTarget = weight * multiplier;
    const crossfadeMs = devMixer.getCrossfadeMs(this.currentTheme);

    this._musicCrossfadeActive = true;
    this.howl.fade(this.howl.volume(this.musicId), mainTarget, crossfadeMs, this.musicId);
    this.howl.fade(this.howl.volume(this.musicIntenseId), intenseTarget, crossfadeMs, this.musicIntenseId);

    clearTimeout(this._crossfadeSettleTimer);
    this._crossfadeSettleTimer = setTimeout(() => {
      this._musicCrossfadeActive = false;
      // Picks up any fader/busMusic mixer change that happened during the crossfade.
      this.refreshMusicVolume();
    }, crossfadeMs);
  }

  // --- Win mechanics ---

  playSmallWin() {
    const name = this._randomAvailableIndexedName("winSmall");
    if (name) this._play(name, dbToGain(SMALL_WIN_VOLUME_DB));
  }

  // Whether the active theme defines its own small-win money-counter sound —
  // audioHooks.js checks this to decide between this theme-specific pair and the
  // generic systemic fallback (SystemAudio.playSmallWinDigits()) before calling
  // either; see startWinRollup()/stopWinRollup() there.
  hasSmallWinDigits() {
    return this._spriteNames.has("winSmallDigits");
  }

  // Starts the (typically looping) sound bed under the small-win counter's roll-up —
  // the small-win equivalent of playBigWinRiser(). No-ops quietly if the active bank
  // doesn't define winSmallDigits (only chinaSounds.json does so far); same guarded
  // shape as playPowerBetOn/Off below, becomes live automatically the moment a bank
  // defines it.
  playSmallWinDigits() {
    if (!this._spriteNames.has("winSmallDigits")) return;
    this.smallWinDigitsId = this._play("winSmallDigits");
    if (this.smallWinDigitsId !== null) this.howl.loop(true, this.smallWinDigitsId);
  }

  // Stops the digit-roll bed and, from its own stop callback, immediately fires the
  // completion sting — the small-win equivalent of stopBigWinRiser()/winBigRiserEnd's
  // "stop chains straight into the payoff cue" pattern above.
  stopSmallWinDigits() {
    if (!this.howl || this.smallWinDigitsId === null) return;
    const id = this.smallWinDigitsId;
    this.smallWinDigitsId = null;
    const hasEndSting = this._spriteNames.has("winSmallDigitsEnd");
    this.howl.once(
      "stop",
      () => {
        if (hasEndSting) this._play("winSmallDigitsEnd");
      },
      id
    );
    this.howl.stop(id);
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
    const restoreTo = this._musicVolumeBeforeDuck ?? this._musicTargetVolume();
    this._musicVolumeBeforeDuck = null;
    this.howl.fade(this.howl.volume(this.musicId), restoreTo, MUSIC_DUCK_MS, this.musicId);
  }

  // One-shot stinger the instant the big win overlay screen appears.
  playBigWinIntro() {
    this._play("winBigT1");
  }

  // --- Powerbet (displayed as "Super Bet" in the UI as of its rename — see index.html) ---

  // The button reads "Super Bet" now, but every shipped bank's JSON still uses the
  // original powerBetOn/powerBetOff sprite names ("don't change the JSON" was explicit
  // — no bank was touched for this rename). superBetOn is preferred when a bank
  // defines it (none do yet), falling back to powerBetOn otherwise — this is a
  // deliberate, ongoing two-name transition (old banks keep working unmodified while
  // new banks can adopt the new name whenever they're ready), not a naming mistake to
  // fix at the source the way Step 19's policy covers; both names are intentionally
  // supported at once. Not every bank defines either — no-ops quietly if neither is
  // present, same guarded shape as before. Safe to call freely on any theme; becomes
  // live automatically the moment a bank defines either name.
  playPowerBetOn() {
    if (this._spriteNames.has("superBetOn")) {
      this._play("superBetOn");
    } else if (this._spriteNames.has("powerBetOn")) {
      this._play("powerBetOn");
    }
  }

  playPowerBetOff() {
    if (this._spriteNames.has("superBetOff")) {
      this._play("superBetOff");
    } else if (this._spriteNames.has("powerBetOff")) {
      this._play("powerBetOff");
    }
  }
}

export const themeAudio = new ThemeAudio();
