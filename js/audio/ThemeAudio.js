// Theme-specific Howler instance — a universal template every theme's sound bank
// plugs into. All playback methods here are generic game-mechanic concepts (reel
// start/stop/turbo, small win, symbol win, big win riser); nothing theme-specific
// appears anywhere except the config file path itself, which is derived from the
// active theme's name.

import { dbToGain, parseBpmFromPath, bpmFromSpriteName, DEFAULT_BPM } from "./audioUtils.js";
import { getBusForSprite } from "./busRouting.js";
import { devMixer } from "./DevMixer.js";
import { setRhythmTimeout } from "./rhythmTimers.js";

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

// Explicit, curated BPM per theme — the authoritative source now that theme banks no
// longer embed a BPM in their music sprite names (musicMain_<bpm>/musicIntense_<bpm>
// were reverted back to plain musicMain/musicIntense; see "Storing BPM values instead
// of a sprite-name suffix" in ARCHITECTURE.md). Supplied manually per theme rather
// than parsed — update this when a new/re-baked bank's tempo is confirmed. Falls back
// to bpmFromSpriteName()/parseBpmFromPath()/DEFAULT_BPM (see _playMusicLoop()) for any
// theme not listed here.
const THEME_BPM = {
  arcade: 114,
  egypt: 100,
  football: 130,
  china: 120,
  gangster: 100,
  mexico: 130,
  neondrive: 80,
};

// Big Win quantized entry: both music layers are hard-ducked to silence together the
// instant the entry lands on the next musical 8th-note (see scheduleBigWinEntry()),
// snappy enough (100ms) to read as a hard cut rather than a fade. They're brought
// back over BIG_WIN_UNDUCK_MS once winBigRiserEnd fires (see stopBigWinRiser()) —
// long enough that the riser-end sting's own tail masks the crossfade back in.
const BIG_WIN_DUCK_MS = 100;
const BIG_WIN_UNDUCK_MS = 2000;

// musicMain fades in from silence rather than snapping straight to its target volume —
// see _playMusicLoop().
const MUSIC_FADE_IN_MS = 2000;

// Adaptive vertical layering: a run of small wins keeps the high-energy musicIntense
// layer up for this long past the *most recent* small win, not accumulated across
// several — every new small win resets the countdown back to the full amount rather
// than extending it. Purely wall-clock (setTimeout), so it keeps ticking through reel
// spins/animations rather than pausing for them.
const SMALL_WIN_INTENSITY_COOLDOWN_MS = 20000;

// Overall music trim, independent of the player-facing fader (which stays a full
// 0-100% range) — knocks every actual musicMain gain down 10% on top of whatever the
// fader is set to, rather than changing what the fader itself reports/controls.
const MUSIC_VOLUME_TRIM = 0.9;

class ThemeAudio {
  constructor() {
    this.howl = null;
    this.musicId = null;
    this.musicIntenseId = null;
    // The dedicated Big Win music bed (optional — see _findMusicSpriteName()),
    // started alongside winBigRiser in playBigWinRiser() and stopped alongside it in
    // stopBigWinRiser(), "on beat" with the riser per the same quantized entry point.
    this.musicBigWinId = null;
    this.ambientId = null;
    this.riserId = null;
    this.smallWinDigitsId = null;
    this.ready = false;
    this.currentTheme = null;
    this._loadToken = 0;
    this._spriteNames = new Set();
    // The actual sprite name each music layer resolved to (see _findMusicSpriteName())
    // — may carry a "_<bpm>" suffix (e.g. "musicMain_114") per Arcade's v02 bank, so
    // code that needs the *sprite name* (bus lookups, BPM parsing) can't just assume
    // the bare "musicMain"/"musicIntense"/"musicBigWin" literals anymore.
    this._musicMainSpriteName = null;
    this._musicIntenseSpriteName = null;
    this._musicBigWinSpriteName = null;
    // Persists across theme switches/teardowns — the fader position shouldn't reset
    // itself just because the player changed themes.
    this.musicVolume = 1;
    // 0 = musicMain fully active (resting state), 1 = musicIntense fully active.
    // Themes with no musicIntense sprite simply never leave 0 — see notifySmallWin().
    this.musicIntensityWeight = 0;
    this._smallWinCooldownTimer = null;
    // Wall-clock deadline (Date.now()-based) the active cooldown timer is counting
    // down to — lets _pauseIntensityCooldown() compute exactly how much time was left
    // rather than just clearing the timer and losing that, so _resumeIntensityCooldown()
    // can pick back up with the true remainder instead of a fresh full countdown.
    this._cooldownDeadline = null;
    // Set only while a Big Win's quantized entry has paused the cooldown mid-countdown
    // (null otherwise, including "cooldown wasn't running at all when paused") — see
    // _pauseIntensityCooldown()/_resumeIntensityCooldown().
    this._cooldownPausedRemainingMs = null;
    // True for the duration of an in-flight crossfade (see DevMixer.getCrossfadeMs())
    // so refreshMusicVolume() (fader/mixer changes) doesn't fight Howler's own fade
    // animation mid-flight — it re-applies once the crossfade settles instead.
    this._musicCrossfadeActive = false;
    this._crossfadeSettleTimer = null;
    // Resolved fresh on every _playMusicLoop() — see THEME_BPM/_msToNextEighth().
    this._bpm = DEFAULT_BPM;
    // The active bank's own src path, stashed by loadTheme() so _playMusicLoop() can
    // fall back to parseBpmFromPath() on it once the actual music sprite name is known.
    this._bankSrc = null;
    // Each music layer's actual volume right before a Big Win's hard duck, so
    // _restoreMusicAfterBigWin() can put it back exactly where it was (whatever
    // musicIntensityWeight mix it was actually in) rather than a freshly recomputed
    // target.
    this._musicMainVolumeBeforeBigWinDuck = null;
    this._musicIntenseVolumeBeforeBigWinDuck = null;
    this._bigWinRestoreTimer = null;
  }

  // Loads and activates a theme's audio bank by name (e.g. "egypt"). Strictly
  // singleton: an already-active theme is a no-op, switching themes tears down the
  // previous Howl instance completely (stop + unload, not just stop) before the new
  // one loads, and a superseded in-flight load (rapid theme switching) is discarded
  // when it resolves — so the game can never end up with two overlapping instances,
  // music loops, or voice beds.
  //
  // skipMusic: starts gameAmbLP/gameStart but not musicMain/musicIntense — used by the
  // startup terminal's menu ambience (see main.js's init()), which previews a theme's
  // atmosphere without committing to its music track before the player has actually
  // chosen anything. If the player then picks that exact theme for real, the
  // already-loaded branch below starts the music it held back rather than reloading
  // the whole bank from scratch.
  async loadTheme(themeName, { skipMusic = false } = {}) {
    if (this.currentTheme === themeName && this.ready) {
      if (!skipMusic) this._startThemeIntro(false);
      return;
    }

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
    this._bankSrc = bank.src;

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
          this._startThemeIntro(skipMusic);
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
    this.musicBigWinId = null;
    this.ambientId = null;
    this.riserId = null;
    this.smallWinDigitsId = null;
    this.ready = false;
    this._spriteNames = new Set();
    this._musicMainSpriteName = null;
    this._musicIntenseSpriteName = null;
    this._musicBigWinSpriteName = null;
    this.musicIntensityWeight = 0;
    clearTimeout(this._smallWinCooldownTimer);
    this._smallWinCooldownTimer = null;
    this._cooldownDeadline = null;
    this._cooldownPausedRemainingMs = null;
    clearTimeout(this._crossfadeSettleTimer);
    this._crossfadeSettleTimer = null;
    this._musicCrossfadeActive = false;
    this._bpm = DEFAULT_BPM;
    this._bankSrc = null;
    this._musicMainVolumeBeforeBigWinDuck = null;
    this._musicIntenseVolumeBeforeBigWinDuck = null;
    clearTimeout(this._bigWinRestoreTimer);
    this._bigWinRestoreTimer = null;
  }

  // gameAmbLP (the ambient SFX bed), gameStart (if the bank has one), and musicMain
  // all start together — musicMain no longer waits for gameStart to finish before
  // entering; it fades in underneath it instead (see _playMusicLoop()). skipMusic:
  // see loadTheme()'s own comment — used by the startup terminal's menu ambience.
  _startThemeIntro(skipMusic = false) {
    this._playAmbientLoop();
    if (this._spriteNames.has("gameStart")) {
      this._play("gameStart");
    }
    if (!skipMusic) this._playMusicLoop();
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

  // Finds a music-family sprite by its base name ("musicMain", "musicIntense",
  // "musicBigWin"), tolerating an optional "_<bpm>" suffix (e.g. "musicMain_114") —
  // the BPM-embedding convention Arcade's v02 bank introduced (see
  // audioUtils.bpmFromSpriteName()). Returns the sprite's exact name as it appears in
  // the bank, or null if neither form is defined.
  _findMusicSpriteName(baseName) {
    if (this._spriteNames.has(baseName)) return baseName;
    const pattern = new RegExp(`^${baseName}_\\d{2,3}$`);
    return [...this._spriteNames].find((name) => pattern.test(name)) ?? null;
  }

  _playMusicLoop() {
    // Strict singleton: never start a second overlapping music-loop instance.
    if (this.musicId !== null && this.howl.playing(this.musicId)) return;

    const mainName = this._findMusicSpriteName("musicMain");
    if (!mainName) return; // bank defines no music track

    // musicIntense (optional) is started in the same synchronous tick as musicMain,
    // both looping, so the two layers stay phase-locked as one loop played twice
    // rather than two independently-timed loops that merely share a tempo. It plays
    // silently from the start; only its *volume* crossfades later (see
    // notifySmallWin()) — starting it later on the first small win would not be
    // phase-aligned with musicMain's already-in-progress loop position.
    const intenseName = this._findMusicSpriteName("musicIntense");
    this._musicMainSpriteName = mainName;
    this._musicIntenseSpriteName = intenseName;
    this._musicBigWinSpriteName = this._findMusicSpriteName("musicBigWin");

    // BPM priority: the curated THEME_BPM entry for this theme (authoritative, kept
    // up to date manually) first; a BPM embedded in the sprite name itself (mainName's
    // own "_<bpm>" suffix, if a bank ever uses that convention again) second; the
    // file-path-based parse of the bank's own src third; DEFAULT_BPM last.
    this._bpm = THEME_BPM[this.currentTheme] ?? bpmFromSpriteName(mainName) ?? parseBpmFromPath(this._bankSrc);

    this.musicId = this.howl.play(mainName);
    this.howl.loop(true, this.musicId);
    if (intenseName) {
      this.musicIntenseId = this.howl.play(intenseName);
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
    return this._scaledMusicVolume() * this._busGain(this._musicMainSpriteName ?? "musicMain");
  }

  // Re-applies the current target volume to whatever's actually playing on musicId
  // (and musicIntenseId, weighted; and musicBigWinId, unweighted — it's an on/off
  // third layer, not part of the vertical-layering crossfade) — called after either
  // the fader or the dev mixer's busMusic slider changes, so a continuous loop reacts
  // live instead of only picking up the new value next time it starts. No-ops
  // harmlessly if music isn't playing yet, and skips while a crossfade is actively
  // animating (see _musicCrossfadeActive) so it doesn't fight Howler's own fade loop
  // mid-flight — _crossfadeToIntensity()'s settle timer calls this again once the
  // fade completes, which is when any fader/mixer change made during that window
  // actually lands.
  refreshMusicVolume() {
    if (!this.howl || this.musicId === null) return;
    if (this._musicCrossfadeActive) return;
    const multiplier = this._musicTargetVolume();
    this.howl.volume((1 - this.musicIntensityWeight) * multiplier, this.musicId);
    if (this.musicIntenseId !== null) {
      this.howl.volume(this.musicIntensityWeight * multiplier, this.musicIntenseId);
    }
    if (this.musicBigWinId !== null) {
      this.howl.volume(multiplier, this.musicBigWinId);
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

  // Returns the Howl playback id (or null if the bank has no reelStart sprite) so a
  // caller can explicitly stop this instance later — see audioHooks.js's turbo-mode
  // reel-start cutoff, the only current use of the returned id.
  playReelStart() {
    const name = this._randomAvailableIndexedName("reelStart");
    if (!name) return null;
    return this._play(name);
  }

  // Cuts off a still-playing reelStart instance precisely on cue — hard stop, no
  // fade, same "stop exactly on the beat" convention as stopBigWinRiser()/
  // stopSmallWinDigits() below, not a fade-out.
  stopReelStart(id) {
    if (!this.ready || !this.howl || id == null) return;
    this.howl.stop(id);
  }

  // pitchSemitones: optional pitch shift (e.g. -3, +2) applied on top of the sprite's
  // own recorded pitch, via Howler's playback-rate control — used by turbo mode to
  // spread its 3 simultaneous reelStop drops into a small chord instead of one flat,
  // phasey unison hit (see audioHooks.js's TURBO_REEL_STOP_SEMITONES).
  playReelStop(pitchSemitones = 0) {
    const name = this._randomAvailableIndexedName("reelStop");
    if (!name) return;
    const id = this._play(name);
    if (pitchSemitones && id !== null) {
      this.howl.rate(Math.pow(2, pitchSemitones / 12), id);
    }
  }

  // Muted (Step 51): turbo mode now reuses the normal reel-start cue instead of this
  // dedicated one — see audioHooks.js's playReelStart(). Left defined/unused rather
  // than removed, same "leave the sprite and its plumbing alone, just stop calling it"
  // treatment as other muted-but-intact hooks in this file.
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

    this._armIntensityCooldown(SMALL_WIN_INTENSITY_COOLDOWN_MS);
  }

  // Arms (or re-arms) the idle-fade-down timer for `remainingMs`, tracking its
  // wall-clock deadline (Date.now()-based, not just the timer handle) so
  // _pauseIntensityCooldown() can later compute exactly how much time was actually
  // left rather than losing that the moment the timer's cleared.
  _armIntensityCooldown(remainingMs) {
    clearTimeout(this._smallWinCooldownTimer);
    this._cooldownDeadline = Date.now() + remainingMs;
    this._smallWinCooldownTimer = setTimeout(() => {
      this._smallWinCooldownTimer = null;
      this._cooldownDeadline = null;
      this._crossfadeToIntensity(0);
    }, remainingMs);
  }

  // Freezes the idle-fade-down countdown mid-flight — used while a Big Win's
  // quantized entry has the music hard-ducked (see scheduleBigWinEntry()), so the
  // idle timer can't independently fire a crossfade-to-0 that fights the duck/restore
  // fades over the same Howler ids. Records the true remaining time (not just "was
  // running") so _resumeIntensityCooldown() can continue rather than restart the
  // countdown. A no-op capture (remaining = null) if nothing was actually counting
  // down when this was called — resume then correctly does nothing either.
  _pauseIntensityCooldown() {
    if (this._smallWinCooldownTimer === null) {
      this._cooldownPausedRemainingMs = null;
      return;
    }
    clearTimeout(this._smallWinCooldownTimer);
    this._smallWinCooldownTimer = null;
    this._cooldownPausedRemainingMs = Math.max(0, this._cooldownDeadline - Date.now());
    this._cooldownDeadline = null;
  }

  // Continues a countdown _pauseIntensityCooldown() froze, picking up with whatever
  // time was actually left rather than a fresh SMALL_WIN_INTENSITY_COOLDOWN_MS.
  _resumeIntensityCooldown() {
    if (this._cooldownPausedRemainingMs === null) return;
    const remaining = this._cooldownPausedRemainingMs;
    this._cooldownPausedRemainingMs = null;
    this._armIntensityCooldown(remaining);
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

  // --- Big Win quantized entry (BPM-synced anticipation + duck) ---

  // Milliseconds from musicMain's *current* playback position to the next grid point
  // `divisor` subdivisions per beat (2 = 8th note, 4 = 16th note), per the active
  // theme's BPM (_bpm — see THEME_BPM/parseBpmFromPath()/bpmFromSpriteName()). 0 if
  // there's no music actually playing to measure against — callers then fire
  // immediately rather than waiting on a position that doesn't exist.
  _msToNextGridPoint(divisor) {
    if (!this.howl || this.musicId === null) return 0;
    const seekSeconds = this.howl.seek(this.musicId);
    if (typeof seekSeconds !== "number") return 0;
    const msPerUnit = 60000 / this._bpm / divisor;
    return msPerUnit - ((seekSeconds * 1000) % msPerUnit);
  }

  _msToNextEighth() {
    return this._msToNextGridPoint(2);
  }

  _msToNextSixteenth() {
    return this._msToNextGridPoint(4);
  }

  // Public entry point for GameController's Turbo reel-stop quantization (see
  // "Reel Turbos 16th-Note Quantization" in ARCHITECTURE.md) — snaps a reel's stop
  // (both its visual landing and its chime) onto the track's 16th-note grid the same
  // way scheduleBigWinEntry() snaps the Big Win climax onto the 8th-note grid.
  getTurboStopQuantizeDelay() {
    return this._msToNextSixteenth();
  }

  // Hard-ducks both music layers to silence together — not the old dB-based partial
  // duck this replaced, a full cut, and snappy (BIG_WIN_DUCK_MS) rather than gradual,
  // timed to land exactly on the quantized entry point scheduleBigWinEntry() computed.
  // Captures each layer's actual current volume first (whatever musicIntensityWeight
  // mix it was actually in) so _restoreMusicAfterBigWin() can put it back exactly.
  _duckMusicForBigWin() {
    if (!this.howl || this.musicId === null) return;
    this._musicMainVolumeBeforeBigWinDuck = this.howl.volume(this.musicId);
    this.howl.fade(this._musicMainVolumeBeforeBigWinDuck, 0, BIG_WIN_DUCK_MS, this.musicId);
    if (this.musicIntenseId !== null) {
      this._musicIntenseVolumeBeforeBigWinDuck = this.howl.volume(this.musicIntenseId);
      this.howl.fade(this._musicIntenseVolumeBeforeBigWinDuck, 0, BIG_WIN_DUCK_MS, this.musicIntenseId);
    }
  }

  // The "curtained exit" — fades both layers back up from silence over
  // BIG_WIN_UNDUCK_MS, called the instant winBigRiserEnd fires (see
  // stopBigWinRiser()) so that sting's own tail masks the crossfade back in.
  // Restores each layer to exactly the volume _duckMusicForBigWin() captured, not a
  // freshly recomputed target — the mix might genuinely have been mid-crossfade when
  // the duck hit. Once the fade's full duration has elapsed, resumes whatever
  // intensity cooldown scheduleBigWinEntry() paused for the win.
  _restoreMusicAfterBigWin() {
    if (!this.howl || this.musicId === null) return;
    const mainTarget = this._musicMainVolumeBeforeBigWinDuck ?? this._musicTargetVolume();
    this._musicMainVolumeBeforeBigWinDuck = null;
    this.howl.fade(this.howl.volume(this.musicId), mainTarget, BIG_WIN_UNDUCK_MS, this.musicId);

    if (this.musicIntenseId !== null) {
      const intenseTarget = this._musicIntenseVolumeBeforeBigWinDuck ?? 0;
      this._musicIntenseVolumeBeforeBigWinDuck = null;
      this.howl.fade(this.howl.volume(this.musicIntenseId), intenseTarget, BIG_WIN_UNDUCK_MS, this.musicIntenseId);
    }

    clearTimeout(this._bigWinRestoreTimer);
    this._bigWinRestoreTimer = setTimeout(() => {
      this._bigWinRestoreTimer = null;
      this._resumeIntensityCooldown();
    }, BIG_WIN_UNDUCK_MS);
  }

  // Schedules a Big Win's entry to land on the next 8th-note boundary of the
  // currently-playing musicMain, rather than firing the instant the on-reel
  // celebration happens to finish — the anticipation beat this creates is deliberate.
  // Pauses the small-win intensity cooldown immediately (before the delay, not after)
  // so it can't fire mid-anticipation or mid-duck and fight the duck/restore fades
  // over the same Howler ids. Resolves once the duck has actually started — i.e.
  // right when the caller should fire the riser and reveal the widget, not after the
  // duck's own fade finishes, so both land on the same beat.
  scheduleBigWinEntry() {
    this._pauseIntensityCooldown();
    const delay = this._msToNextEighth();
    return new Promise((resolve) => {
      // setRhythmTimeout (not a raw setTimeout) so backgroundGuard.js can flush this
      // immediately if the tab gets backgrounded mid-delay, rather than let a
      // throttled background tab delay the Big Win's entry indefinitely.
      setRhythmTimeout(() => {
        this._duckMusicForBigWin();
        resolve();
      }, delay);
    });
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

  // No longer ducks Main/Intense itself — scheduleBigWinEntry()'s
  // _duckMusicForBigWin() already hard-ducked both to silence right before this is
  // called (both fire from the same quantized-entry moment; see GameController's
  // blackout branch). Also starts musicBigWin (optional — see _findMusicSpriteName())
  // in the same breath as the riser, so the dedicated Big Win music bed and the riser
  // land "on beat" together, not independently timed. musicBigWin is scaled like the
  // other music layers (fader/trim/busMusic — see _musicTargetVolume()), not treated
  // as a plain one-shot SFX, since it's still "the music" for volume-control purposes.
  playBigWinRiser() {
    this.riserId = this._play("winBigRiser");
    if (this._musicBigWinSpriteName) {
      this.musicBigWinId = this._play(this._musicBigWinSpriteName, this._scaledMusicVolume());
    }
  }

  // Stops the riser and, from its own stop callback, immediately fires the riser-end
  // sting and the curtained-exit music restore — so both are a direct consequence of
  // winBigRiser stopping, not a sequential call, and the sting's tail masks the
  // restore fade coming back in (see _restoreMusicAfterBigWin()). musicBigWin (if it
  // was started) is cut off in the same synchronous moment the riser's own stop is
  // issued — it stopped "on beat" with the riser starting, so it stops with it too,
  // rather than being faded out separately.
  stopBigWinRiser() {
    if (!this.ready || !this.howl || this.riserId === null) return;
    const id = this.riserId;
    this.riserId = null;
    this.howl.once(
      "stop",
      () => {
        this._play("winBigRiserEnd");
        this._restoreMusicAfterBigWin();
      },
      id
    );
    this.howl.stop(id);

    if (this.musicBigWinId !== null) {
      this.howl.stop(this.musicBigWinId);
      this.musicBigWinId = null;
    }
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
