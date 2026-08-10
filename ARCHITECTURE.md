# Octave Spin Forge — Architecture Reference

**What this is:** a browser-based iGaming slot machine prototype whose real purpose is to be a
high-end showcase for custom, theme-swappable game audio built on Howler.js. Visuals are
intentionally simple/placeholder (CSS-shape symbols, CSS-gradient backdrops) — the audio
architecture is the actual product. Vanilla JS ES modules, no build step, no framework, no
dependencies besides Howler (loaded via CDN `<script>` in `index.html`).

Read this file first in any new session on this project. It reflects the state after Step 10
(UI harmonization: the cabinet's "metal plate" chrome was replaced with the startup terminal's
flat dark-panel language, and Master Mute/the music fader moved into a floating dock so Spin sits
above the fold) plus a post-Step-10 pass (rebranded to "Octave Spin Forge", the cabinet frame's
bottom padding increased to actually clear the Spin button's own drop-shadow, and the topbar made
responsive so the longer name doesn't crush the theme select on narrow viewports) — see "Visual
system & layout (Step 10)" below. Earlier: Step 9 (dynamic per-theme background image injection,
with graceful CSS-gradient fallback), and a post-Step-8 bugfix pass (theme dropdown moved to its
own row, celebration symbols fixed to scroll with the page, profiler tag column blanked, initial
reel measurement race that could shrink reels on first load, startup terminal hover/click sfx
added and then fixed against the focus-mute layer silencing them). If something described here
doesn't match the code, trust the code and update this file.

---

## Non-negotiable design rules (violate these only if explicitly asked)

1. **NO RNG anywhere in game logic.** Every spin outcome, every win tier, every big-win symbol
   is picked from a hardcoded, deterministic, cycling sequence (`js/game/SpinSequence.js`).
   `Math.random()` only appears in purely cosmetic code with zero effect on outcomes: coin
   fountain particle trajectories (`CoinFountain.js`) and audio pitch randomization
   (`SystemAudio.js`). If you're ever tempted to add `Math.random()` to decide *what happens*,
   don't — find the deterministic-cycle pattern instead.
2. **Audio hook abstraction.** `js/audio/audioHooks.js` exports generic, theme-agnostic function
   names (`playReelStart`, `playThemeSmallWin`, `startWinRollup`, etc.). No literal theme name
   ("egypt", "mexico") appears anywhere in JS logic except where a theme name is used as a
   *variable* to build a file path (`src/audio/${themeName}Sounds.json`). `ThemeAudio` is a
   single generic engine every theme's sprite sheet plugs into via a shared naming convention
   (see "Theme sprite-sheet contract" below).
3. **5 generic symbols only, across every theme:** `symbol01`, `symbol02`, `symbol03`, `wild`,
   `scatter` (`SYMBOL_META` in `SpinSequence.js`). No "Symbol04" or theme-specific symbol ever.
4. **Provided JSON audio configs are copied byte-for-byte, never reformatted.** They're not
   valid standalone JSON (each file is a bare `"xSounds": {...}` entry, no wrapping braces) —
   don't "fix" that in the file. Instead the loader wraps the raw text at parse time:
   `JSON.parse(\`{${rawText}}\`)`. See both `SystemAudio.js` and `ThemeAudio.js`.

---

## File map

```
index.html                     All markup — single page, no templating.
css/styles.css                 All styles. BEM-ish naming (block__element--modifier).
js/main.js                     Entry point. Wires DOM → controllers. Runs on DOMContentLoaded.
                                Blocks on the startup terminal before loading any theme.

js/game/
  SpinSequence.js               Deterministic outcome generator (the "game logic" core).
  GameController.js             Orchestrates one full spin: reels → win detection → audio
                                 hooks → visual effects, in strict sequence.

js/reels/
  ReelController.js              Owns one reel's DOM/animation: spin-up, cruise loop, landing
                                  bounce, impact detection for audio timing.

js/effects/                     Visual-only effect controllers. None of these import audio —
                                 GameController calls both the effect and the audio hook side
                                 by side; effects and audio are deliberately decoupled.
  WinLineController.js           The gold line that sweeps across the payline on a small win.
  SymbolCelebration.js           Clones a winning symbol into an unclipped overlay so its
                                  scale/glow "pop" isn't cut off by the reel's overflow:hidden.
  WinCounter.js                  Generic rAF-driven roll-up counter (used for both the small
                                  inline counter and the big-win widget's massive counter).
  BigWinWidget.js                The full-screen "GRAND WIN" overlay: dims backdrop, hosts the
                                  massive counter + coin fountain, Collect/dismiss.
  CoinFountain.js                Particle system for the big win widget.

js/theme/
  ThemeManager.js                 Fetches a theme's *visual* config (themes/<name>.json).
                                   Mostly a stub — no real per-theme art exists yet.
  ThemeTransition.js              Orchestrates a theme switch: whoosh hook → fade to black →
                                   load the theme's visual config → apply its real bgImagePath
                                   photo (preloaded/decoded first) or fall back to a CSS-gradient
                                   backdrop → load audio → fade lifts. `swapTo()` for in-game
                                   switches via the theme bar; `enterFromTerminal()` for the
                                   one-time cold start out of the startup terminal (see below) —
                                   same mechanics, plus dismissing the terminal at the moment the
                                   screen is confirmed fully black.
  StartupTerminal.js               The gatekeeper screen (Step 7). Renders a scrollable,
                                   text-only theme list from themeRegistry.js into
                                   #startup-terminal-list, resolves a Promise with the chosen
                                   theme id on click/Enter, and permanently removes itself from
                                   the DOM via dismiss(). Its rows carry the standard
                                   data-sfx-hover/data-sfx-click attributes (generic uiHover/
                                   uiClick via systemAudio) — the *theme* bank stays gated until
                                   selection, but the always-loaded system UI sfx isn't.
  themeRegistry.js                 Single source of truth for which themes exist: `THEMES = [{
                                   id, label }, ...]`. Both the startup terminal's list and the
                                   in-game `#theme-select` dropdown render from this array —
                                   adding a theme is a one-line addition here (plus its
                                   themes/<id>.json, src/audio/<id>Sounds.json, and a
                                   THEME_BACKDROPS entry in ThemeTransition.js).

js/audio/
  SystemAudio.js                  Global UI sprite sheet (hover/click/etc). One Howl instance,
                                   lives for the whole page session, never torn down.
  ThemeAudio.js                   THE core deliverable. Per-theme Howl instance implementing
                                   the generic sprite-sheet contract (see below). Fully torn
                                   down and rebuilt on every theme switch.
  audioHooks.js                   The abstraction seam. Every game-event → audio call in the
                                   whole app goes through a named function here. Some are still
                                   console.log-only placeholders (no sound designed yet); most
                                   now also call into SystemAudio/ThemeAudio.
  audioUtils.js                   Shared math: `dbToGain(db)` (dB → linear gain for Howler).
  AudioProfiler.js                 Step 8. Passive debug HUD: polls both `systemAudio.howl` and
                                   `themeAudio.howl`'s own `_sounds` arrays (Howler has no "now
                                   playing" API) every 200ms and renders one row per actively-
                                   playing sound into `#audio-profiler-list`. Never calls into any
                                   audio API — read-only.

src/audio/                      Theme + system audio JSON configs (exact copies of provided
                                 files, see rule #4 above).
  systemSounds.json
  egyptSounds.json
  mexicoSounds.json
  arcadeSounds.json
  footballSounds.json

assets/23/sounds/                Actual mp3 files. Path is dictated by each JSON's own "src"
                                  field (`./assets/23/sounds/<name>.mp3`), which is never edited
                                  — so the mp3 MUST live at exactly this path, resolved relative
                                  to the page root (Howler resolves it that way, not relative to
                                  the JSON's own location).

assets/bg_<name>.jpg             Real per-theme background photos (Step 9's bgImagePath target —
                                  see "Theme switching / visual transition"). All 4 themes have
                                  one: bg_egypt.jpg, bg_mexico.jpg, bg_arcade.jpg, bg_football.jpg.

themes/                         Per-theme *visual* config stubs (themeName, bgImagePath — real,
                                 see above — plus background/symbol asset paths that are still
                                 unused-but-wired scaffolding for future art; don't confuse the
                                 two, only bgImagePath is actually read by any code).
  egypt.json, mexico.json, arcade.json, football.json
```

---

## The spin flow, end to end

`main.js` → `wireGame()` builds one `GameController`, which owns 3 `ReelController`s plus one
instance each of `WinLineController`, `SymbolCelebration`, `WinCounter`, `BigWinWidget`.
Clicking `#spin-btn` calls `game.spin()` (button is disabled for its entire duration, including
any win celebration — only re-enabled when `spin()`'s promise resolves).

`GameController.spin()`, in order:

1. Reset visual state (`clearHighlight`, `winLine.reset`, `winCounter.reset`), set status to
   "Spinning…".
2. `spinSequencer.next()` → gets this spin's outcome (deterministic, see below).
3. `reel.buildStrip()` for all 3 reels, then `playReelStart(fastMode)` (audio hook — fires
   `uiReelStart` from SystemAudio + either `themeAudio.playReelStart()` or `.playReelTurbo()`
   depending on fast mode), then `reel.startSpin()` for all 3.
4. `reel.stop(delay, landingMs, onImpact)` per reel, staggered in normal mode / simultaneous in
   fast mode. `onImpact` fires `playReelStop(reelIndex, symbol, fastMode)` **at the moment the
   reel visually reaches its target**, not after the full bounce-settle finishes — see "Reel
   landing & impact detection" below, this was a real bug that got fixed.
5. `await Promise.all(stopPromises)` — waits for all 3 reels' landing bounce to fully settle.
6. If it's a win, branch on `outcome.isBlackout`:
   - **Blackout (big win):** highlight all 9 tiles → `playSymbolPulse()` → `playWinStinger()` →
     `playThemeSymbolWin(payline[0])` → celebrate all 9 tiles → `playBigWinIntro()` (fires
     `winBigT1`, "the exact moment the overlay appears") → `bigWinWidget.show()` (dims
     screen, 8s counter roll-up, coin fountain, waits for Collect) → `stopBigWinRiser()`
     (idempotent — cleans up if the rider wasn't already stopped by natural roll-up completion).
   - **Small win:** highlight payline → `playWinLineDash()` → `winLine.dash()` (line sweep,
     dynamically positioned to the real symbol's on-screen center — see gotchas) →
     `playSymbolPulse()` → `playWinStinger()` → `playThemeSmallWin([...new
     Set(outcome.payline)])` (plays winSmall + **every distinct symbol's own layer**
     simultaneously — matters for the Wild-assist tier, see below) → celebrate payline symbols +
     hide win line → `winCounter.rollUp()` (1.5s).
7. Loss: just set status text.

### Deterministic outcome generation (`SpinSequence.js`)

- **Base cycle** (`SpinSequencer.next()`), loops forever: `Loss, Loss, Small1, Loss, Loss,
  Small2, Loss, Loss, Small3, Loss, Loss, Small4, Loss, Loss, Small1, ...`. Loss paylines cycle
  through 4 hardcoded non-matching patterns. Small win tiers: `small1`/`small2`/`small3` are
  pure 3-of-a-kind (symbol01/02/03), `small4` is a mixed "Wild Assist"
  (`["wild","symbol01","symbol01"]`) standing in for a nonexistent "Symbol04".
- **Big win** only ever happens via the "Force Big Win" debug button
  (`spinSequencer.forceBigWinNext()`), never in the natural cycle. Its symbol is *also*
  deterministic: `Scatter, any, any, Scatter, any, any, ...` — the 1st/4th/7th/... forced big
  win is Scatter, the "any" slots cycle through `symbol01, symbol02, symbol03, wild` in a
  continuously-advancing (not reset-per-group) order. Counters (`_bigWinCount`,
  `_bigWinAnyIndex`) live on `SpinSequencer` and advance on *arm*, not on consumption — clicking
  the debug button twice without spinning burns two cycle slots even though only the second
  outcome is ever played. This is a known, accepted quirk of a debug tool, not a bug.
- `buildReelTargets(payline)` derives the non-payline (top/bottom) symbols deterministically
  from the payline symbol + reel index — specifically designed so that when a win repeats the
  same symbol across all 3 reels (any big win, or `small1`-`small3`), the top/bottom rows don't
  *also* accidentally line up into their own visual "win". Verified exhaustively against all 8
  win-tier + 4 loss patterns at the time it was built (no row is ever uniform or matches a
  defined win pattern).
- `getInitialDisplay()` is a separate, counter-untouched call used only to render the resting
  grid before the first spin — so "Spin 1" always starts the cycle fresh regardless of what's
  shown on page load.

---

## Reel landing & impact detection (the trickiest piece of code in the project)

`ReelController.stop(delay, landingMs, onImpact)`:
- Animation is WAAPI (`Element.animate`), not CSS transitions/keyframes, for precise
  `.finished` promise control.
- The landing motion is a spring/overshoot: travels past the target, rebounds, settles — a
  6-keyframe animation using `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Critical, hard-won fact about that easing curve:** it is extremely front-loaded. Empirically
  measured (via manual `setTimeout`-based position sampling): the strip crosses its final
  target position at roughly **20-25% of `landingMs`**, not at the keyframe offset percentages
  you'd naively expect. Don't assume any fixed percentage of `landingMs` corresponds to a
  particular visual moment — measure live position instead.
- `onImpact` fires at the **first moment the strip's live position reaches/passes the target**
  (i.e., true visual impact, before the overshoot wobble), via a dual-poller: both
  `requestAnimationFrame` *and* an independent `setTimeout(fn, 16)` chain race to detect it, plus
  a **guaranteed fallback** that fires `onImpact` at `landing.finished` no matter what. Why the
  redundancy: this project's specific browser-automation test harness was found to throttle
  `requestAnimationFrame` almost to zero in a backgrounded/inactive tab (measured: 1 rAF
  callback fired in a 500ms window where ~30 were expected) — a `setTimeout`-based backup was
  necessary to get correct behavior even in that harness, and it's *also* correct defensive
  design for a real backgrounded tab (rAF legitimately pauses when a tab is hidden — the
  fallback-at-`finished` still guarantees the sound eventually fires, just a bit late, rather
  than never).
- This whole mechanism exists because `playReelStop()` used to fire only when the *entire*
  landing animation finished (~420ms after impact) — audibly late relative to the actual visual
  stop. Fixed by this impact-detection system. If reel-stop timing ever seems off again, this is
  the first place to check, and the `setTimeout`-based sampling technique (not rAF, not
  screenshots) is the reliable way to verify it in this environment.

---

## Theme sprite-sheet contract

Every `<theme>Sounds.json` is expected to define (not all are required — `ThemeAudio` checks
`_spriteNames.has(...)` before using optional ones):

| Sprite name(s) | Meaning | Played via |
|---|---|---|
| `gameAmbLP` | Ambient loop, starts immediately on theme load, parallel to `gameStart` | `_playAmbientLoop()` — **SFX layer, immune to the music fader, only Master Mute silences it** |
| `gameStart` | One-shot intro | `_startThemeIntro()` — chains to `musicMain` via Howler's `once("end", ...)` on the intro's own sound id, not a guessed timeout |
| `musicMain` | Main background loop | `_playMusicLoop()` — **the only sprite the music fader controls**; ducked -3dB/1s during the riser (see below), on top of whatever the fader is set to |
| `reelStart01`-`05` | Slow-mode reel start | `playReelStart()` — random pick among the 5 |
| `reelStop01`-`05` | Slow-mode reel stop | `playReelStop()` — random pick among the 5 |
| `reelTurbo01`-`05` | Fast-mode reel cue | `playReelTurbo()` — **replaces both start and stop** in fast mode (fires once at spin start; per-reel stop calls are suppressed) |
| `winSmall01`-`04` | Small win layer | `playSmallWin()` — random pick, **played at -2dB by default** |
| `winSymbol01`-`03`, `winSymbolWild`, `winSymbolScatter` | Symbol-specific win layer | `playSymbolWin(symbolId)` |
| `winBigRiser` | Big win climax buildup | `playBigWinRiser()` — ducks `musicMain` -3dB/1s at the same moment |
| `winBigRiserEnd` | Riser payoff sting | Fired from inside `stopBigWinRiser()`'s `once("stop", ...)` callback on the riser's own id — i.e. a direct consequence of the riser stopping, not a separate timed call. Also un-ducks music (1s fade back to its pre-duck volume, not a hardcoded 1.0). |
| `winBigT1` | Big win overlay-appear stinger | `playBigWinIntro()` |

`SYMBOL_SPRITE_MAP` in `ThemeAudio.js` maps our 5 generic symbol ids to the `winSymbol*` names —
this mapping itself is considered part of the abstract template (every theme is expected to
follow it), not theme-specific.

**Wild-combo audio rule:** when a win's payline mixes symbols (currently only `small4`, Wild +
symbol01), `playThemeSmallWin` is called with the *distinct set* of payline symbols
(`[...new Set(outcome.payline)]`), and plays **every** one's `winSymbol*` layer simultaneously —
not just one. `playThemeSmallWin(symbolIds)` accepts either a single id or an array.

**Instance lifecycle:** `ThemeAudio.loadTheme(name)` is strictly singleton — an already-active
theme is a no-op; switching themes fully tears down the previous `Howl` (`.stop()` +
`.unload()`, not just stop) *before* the new one starts loading; an in-flight load that gets
superseded by a newer `loadTheme()` call is discarded silently when it resolves (never starts
playing). `loadTheme()` awaits all the way through the Howl's own `onload`/`onloaderror`, not
just the JSON fetch — this matters because callers (like the fade transition) need genuine
audio-readiness, not just "the config parsed."

---

## Theme switching / visual transition

Both `ThemeTransition.swapTo(themeName)` (in-game dropdown) and `enterFromTerminal(themeName,
startupTerminal)` (cold start) share one private sequence, `_transitionTo()`: fires
`playTransitionWhoosh()` (currently a pure `console.log` placeholder — `systemSounds.json` has no
whoosh sprite yet) → adds `.fade-overlay--active` (CSS opacity transition to black, ~0.4s) →
awaits `transitionend` → (cold start only) dismisses the startup terminal → **awaits
`themeManager.loadTheme(themeName)`** to get the theme's visual config (needed before anything
else, since it's what carries `bgImagePath`) → `Promise.all([this._applyBackdrop(...),
themeAudio.loadTheme(themeName)])` → removes the fade class. The `<select>` is disabled for the
duration in `main.js` (a second switch fired mid-fade would `transitionend`-wait forever, since
the overlay would already be at opacity:1 with no property change to transition).

**Real background photos (Step 9):** each `themes/<name>.json` may declare a top-level
`bgImagePath` (e.g. `"assets/bg_egypt.jpg"`) — separate from, and not to be confused with, the
older unused `background.asset` stub field that's been sitting in these files since before real
art existed (still there, still unused; `bgImagePath` is the field that's actually wired up).
`ThemeTransition._applyBackdrop(themeName, config)` handles it:
- If `config.bgImagePath` is set, it's preloaded via `preloadImage()` — `new Image().decode()` if
  available (waits for actual decode, not just download, so there's no first-paint decode hitch),
  falling back to an `onload`/`onerror` promise otherwise. This never rejects the transition: a
  missing/broken image just falls through to the theme's `THEME_BACKDROPS` CSS gradient (with a
  `console.warn`), same as before Step 9.
- The image is only ever assigned to `document.body.style.backgroundImage` *after* it's confirmed
  loaded, and that assignment happens inside the same `Promise.all` the fade-lift awaits — so by
  the time `.fade-overlay--active` is removed, the photo is already decoded and painted behind
  the fade, not popping in visibly after.
- `body`'s CSS (`css/styles.css`) carries `background-size: cover; background-position: center
  center; background-repeat: no-repeat;` unconditionally — harmless no-ops against a CSS gradient,
  and exactly what auto-crops/centers a real photo of any aspect ratio to fill the container with
  zero manual editing per theme.
- **All 4 themes now have a real image file on disk at their `bgImagePath`** (`assets/bg_egypt.jpg`,
  `bg_mexico.jpg`, `bg_arcade.jpg`, `bg_football.jpg` — top-level `assets/`, not
  `assets/themes/<name>/`), so the gradient fallback in normal play is currently dead-but-ready
  code, only exercised if a file goes missing or fails to decode. Adding a 5th theme with no image
  yet is fine and expected to work (falls through cleanly) — just don't mistake "gradient showing"
  for "the feature is broken," check the file actually exists at the exact path first.

**There is no "medieval" theme anymore** — it was removed (it was always a placeholder with no
audio asset ever provided). Themes now come from `themeRegistry.js`'s `THEMES` array, which both
the `<select>` and the startup terminal render from — see below, this also means there's no
longer a "first option" footgun, since nothing loads audio automatically on page load at all.

---

## Startup terminal (gatekeeper) & the autoplay problem

**The problem:** browsers block audio from playing until the page has a genuine user gesture
(click/keypress/tap). The old flow called `themeAudio.loadTheme()` straight from
`DOMContentLoaded` — on a real cold load with zero prior interaction, that's a silent failure:
Howler queues the sounds but the AudioContext stays suspended, so `gameAmbLP`/`gameStart` never
audibly play until the player happens to click something *else* first (Spin, a mute button),
which unlocks audio but is by then out of sync with the intended intro sequence.

**The fix:** `js/main.js`'s `init()` now blocks on `StartupTerminal.waitForSelection()` before
doing anything thematic. Nothing — no `themeManager.loadTheme()`, no `themeAudio.loadTheme()`, no
`Howl` construction beyond `SystemAudio`'s own sprite — happens until the player clicks (or
Enter/Space-selects) a row in the terminal. That click *is* the guaranteed first gesture, and
`ThemeTransition.enterFromTerminal(themeId, startupTerminal)` runs immediately off the back of it:
same whoosh → fade-to-black → load mechanics as `swapTo()`, except it also calls
`startupTerminal.dismiss()` (removes it from the DOM, permanently) at the exact point the screen
is confirmed fully opaque, so the terminal's removal and the cabinet's first reveal are never
visible as a seam.

The terminal itself (`#startup-terminal` in `index.html`, styled in `css/styles.css` under
"Startup terminal (gatekeeper)") sits at `z-index: 300` — above even the fade-overlay's 200 — so
it covers absolutely everything from the very first frame.

**Its rows do play the generic system UI sfx** (`data-sfx-hover`/`data-sfx-click`, set in
`StartupTerminal.render()`) — added after initial launch, per explicit request, to match the rest
of the app's hover/click feedback. This is a separate concern from the audio *gate* itself:
`wireGlobalUISfx()`'s normal document-wide sweep (`main.js`) runs before the terminal's rows even
exist, so it's called a second time, scoped to just `startupTerminal.listEl`, right after
`startupTerminal.render()` — re-running it unscoped (`document`-wide) would double-bind every
already-wired element (topbar buttons, fader, dropdown) and double-play their sounds. The actual
selection logic (`StartupTerminal.waitForSelection()`, resolving the picked theme id and driving
the fade/load) is a completely separate listener on the same click — one plays a sound, the other
drives the transition; nothing about the sfx wiring touches the gate itself, since `systemAudio`
is a distinct, always-loaded Howl bank from the thematic one (`themeAudio`) that stays gated
until a theme is actually chosen.

`#theme-select` (the in-game dropdown — back inside the topbar itself as of Step 10, in
`.topbar__theme`; see "Visual system & layout (Step 10)" below for why it moved twice) is
populated at runtime from the same `THEMES` registry (`populateThemeSelect()` in `main.js`)
rather than hardcoded `<option>` tags in the HTML — so both the terminal and the dropdown always
agree on what themes exist, from one array.

---

## Global UI audio (`SystemAudio.js`)

One Howl instance for the whole page session (`uiHover`, `uiClick`, `uiReelStart`, plus unused
`uiBet`/`uiMenuOn`/`uiMenuOff`/`uiSlider`), wired generically in `main.js` via
`[data-sfx-hover]`/`[data-sfx-click]` attributes — any element with those attributes
automatically gets the sound, no per-element wiring needed. Whole bank plays at -3dB
(`SYSTEM_VOLUME_DB`). Every trigger gets a randomized playback rate between 0.94-1.06
(`randomizedPitchRate()`, ±1 semitone) so repeated clicks don't sound robotically identical.

---

## Volume/mixing reference (all via `dbToGain()` in `audioUtils.js`)

| What | Amount | Where |
|---|---|---|
| SystemAudio (whole bank) | -3dB | `SystemAudio.js` constructor volume |
| Theme `winSmall*` | -2dB | `ThemeAudio.playSmallWin()`, per-sound-id volume |
| `musicMain` duck during riser | -3dB, 1s fade out/in | `ThemeAudio._duckMusic()`/`_unduckMusic()`, captures actual pre-duck volume rather than assuming 1.0 |
| Pitch randomization | ±1 semitone (rate 0.94-1.06) | `SystemAudio.playUI` only — never applied to ThemeAudio |

**Master Mute + a music volume fader**, both in the floating `#audio-dock` as of Step 10
(`#master-mute-btn`, `#music-fader-wrap` > `#music-fader` — see "Visual system & layout (Step 10)"
for why they left the topbar; state still lives in `main.js`'s `wireAudioControls()`, not
persisted anywhere, and none of the ids/JS wiring changed, only where they sit in the DOM):
- **Master Mute** = `Howler.mute(bool)`, the static/global method — silences *everything*,
  every Howl instance, automatically, no per-instance code needed.
- **Music fader** (Step 8; replaced the old "Music Mute" toggle button) = a `<input type="range"
  min="0" max="1" step="0.01">` bound live to `themeAudio.setMusicVolume(value)` →
  `howl.volume(value, musicId)` on its `input` event — continuously variable, not just on/off.
  Touches *only* the `musicMain` sound id; `gameAmbLP` (ambient) is deliberately never touched by
  this, only Master Mute can silence it. The fader position persists across theme switches
  (`themeAudio.musicVolume`, survives `_teardown()`) so a newly-loaded theme's music starts at
  whatever level the player last set. The fill (`--fader-fill` CSS custom property, updated
  alongside the Howler call) is a plain visual — Firefox's native `::-moz-range-progress` fills
  itself automatically, Chrome/Safari need the CSS var trick since `::-webkit-slider-*` has no
  progress pseudo-element.
- **Master Mute visually overrides the fader** when engaged (`.audio-fader--overridden`, dimmed/
  grayscale, toggled in `syncMasterBtn()`) — functionally this is automatic anyway, since
  `Howler.mute(true)` silences `musicMain` regardless of its own volume; the class just makes
  that fact visible instead of leaving the fader looking "on" while nothing plays. The fader
  itself stays fully interactive while overridden, so the player can still set where they want
  it for when they unmute.

**A third, automatic layer sits on top of Master Mute**, not a separate button: the whole app
auto-mutes whenever the browser tab isn't the frontmost, focused one, and auto-unmutes when it
regains focus — so background tabs never leak audio. Implemented in `wireAudioControls()`
(`main.js`) as `Howler.mute(masterMuted || !windowActive)`, where `windowActive` is recomputed
from `document.hasFocus() && !document.hidden` on `visibilitychange`/`window focus`/`window
blur`. It's a pure OR with `masterMuted` — losing focus never clears the user's manual mute,
and regaining focus never unmutes if they'd muted manually. The music fader's own volume value is
untouched by this layer since it never goes through `Howler.mute()`.

**`windowActive` also gets set on any `pointermove`/`pointerdown` reaching the document**, not
just focus/visibility events. This was added after the startup terminal's hover sfx (added per
explicit request) turned out to be silently muted on a fresh page load: `document.hasFocus()` is
strict *keyboard* focus, and this app's real delivery context (embedded in an outer app/pane, not
a bare standalone tab) can easily have the page visibly frontmost and hovered while the outer app
still holds keyboard focus elsewhere — `hasFocus()` reads false the whole time, so every hover
(and click, though a click typically grants focus as a side effect, masking the bug for click)
before the first focus-granting interaction played silently. A genuinely backgrounded tab never
receives pointer events at all, so any pointer activity reaching the document is itself reliable
evidence the player is actually looking at it — safe to treat as "active" without weakening the
original backgrounded-tab muting (verified: forcing the muted state and then dispatching a
`pointermove` correctly un-mutes; a real backgrounded tab simply never fires that event to begin
with). If hover/click sfx ever seem to silently not play again, check `Howler._muted` and
`document.hasFocus()` together before assuming the `data-sfx-*` wiring itself is broken.

---

## Audio profiler (debug overlay)

`AudioProfiler.js` + `#audio-profiler` in `index.html`, bottom-right corner, `z-index: 250`
(above the fade-overlay's 200 so it's visible straight through theme-swap fades as a persistent
HUD; below the startup terminal's 300 since there's nothing to show before a theme loads).
`pointer-events: none` throughout — it's a pure readout, never intercepts a click.

**How it works:** there's no Howler event for "a sound started/stopped" — it polls. Every 200ms
(`POLL_INTERVAL_MS`), `_tick()` walks `howl._sounds` on both `systemAudio.howl` and
`themeAudio.howl` (passed in as `getHowl()` functions, not direct references, since
`ThemeAudio`'s own `.howl` is swapped out on every theme switch), collects every sound where
`!sound._paused`, and diffs that against the currently-rendered rows (keyed by `"<tag>:<sound
_id>"`, since the same sprite name can be legitimately playing more than once at once — three
reel-stop sounds firing in quick succession each get their own row).

- **New active sound** → a row is created and appended, then `.audio-profiler__row--active` is
  added on the *next* animation frame (not the same tick) — added synchronously it wouldn't
  transition, since there'd be no prior style to animate from on the element's first paint.
- **Still active** → row's name/meter-bar-width/muted-state are refreshed in place every tick
  (the meter reflects `sound._volume`, i.e. the sound's own per-id Howler volume — for
  `musicMain` this directly reflects the fader).
- **No longer active** → `.audio-profiler__row--active` is swapped for `--leaving` (opacity/
  transform transition out), and the row is actually removed from the DOM via `setTimeout` after
  `EXIT_ANIMATION_MS` (260ms) — must stay in sync with the CSS transition duration on
  `.audio-profiler__row--leaving`, they're not otherwise linked.
- **Global silence** → `.audio-profiler--silenced` on the whole panel whenever `Howler._muted` is
  true (Master Mute engaged, or the window-focus auto-mute layer above), dimming the entire
  readout rather than trying to reflect "silenced" per-row.

**The tag column (`.audio-profiler__row-tag`) is deliberately rendered blank.** It originally
showed "SYS"/"THEME" (which bank a sound came from), but that distinction wasn't useful enough
to keep on-screen — removed per explicit feedback. The column itself is still there in the DOM/
grid layout (`grid-template-columns: 38px 1fr 40px` on `.audio-profiler__row`), just with empty
content — reserved for something more useful later, not deleted. The internal `tag` value
(`"SYS"`/`"THEME"`) still exists in `_collectActive()`/the row key (`"<tag>:<sound_id>"`), it's
just never written into the visible span anymore — don't reintroduce it into the DOM without
checking whether the reserved slot has since been repurposed for something else.

---

## Visual system & layout (Step 10)

**The problem this solved:** the cabinet used to have its own distinct visual language — a
"metal plate" chrome (`--cabinet-metal-1/2` gradient, 22px radius, triple bevel/gloss box-shadows,
sans-serif body font) — while the startup terminal, added later, used a completely different one
(flat dark panels, 12px radius, hairline borders, monospace throughout). The two screens the
player actually sees back to back looked like they belonged to different apps. Separately, the
topbar + a full-width theme-select row + the cabinet + the debug panel added up to enough vertical
space that Spin required scrolling to reach on ordinary viewport heights.

**Design tokens, unified in `:root`:** the terminal's palette is now the *only* panel language in
the app — `--panel-bg-1`/`--panel-bg-2` (the `linear-gradient(180deg, ...)` every panel uses),
`--panel-border` (`#343842`, outer panel/window borders), `--control-bg`/`--control-border`
(`#1c1e24` / `#454851`, interactive elements — buttons, selects, inputs). `--cabinet-metal-1`,
`--cabinet-metal-2`, and `--radius-lg` (22px) were removed outright, not just unused — nothing
should reintroduce a second radius/panel scale. `body`'s `font-family` is `"Courier New",
monospace` app-wide now (was `"Segoe UI"` sans-serif) — elements that previously set monospace
explicitly (win counter, result readout, etc.) still do, redundantly but harmlessly.

**`.cabinet__frame`/`.cabinet__glass`** were reskinned onto those same tokens (flat panel gradient,
`var(--panel-border)`, `var(--radius-md)`, one quiet `0 20px 44px` shadow) instead of the old
metal gradient + heavy inset bevels. **The Spin button (and the Big Win collect button) were
deliberately left alone** — still the dimensional radial-gradient/drop-shadow/press-animation
treatment — as an intentional accent against the now-flatter frame, an explicit choice (not an
oversight) made when this was scoped out with the user before implementation.

**Layout — three options were prototyped as ASCII wireframes and reviewed before any code was
written** (a consolidated single-row header; a permanent side rail à la a DAW inspector; a
floating dock). **The floating dock was chosen.** What that means concretely:
- Master Mute + the music fader moved out of the document flow entirely into `#audio-dock`
  (`position: fixed; left: 16px; bottom: 16px`) — a pill mirroring the Signal Monitor panel's
  styling, in the opposite corner. This costs zero vertical layout space, which is what actually
  freed up enough room for Spin — moving controls *within* the flow (a rail, a merged row) saves
  less than removing them from the flow altogether.
- Master Mute's button is icon-only now (no visible "Mute" text label) to stay compact as a
  circular dock pill; the accessible name still comes from its unchanged `aria-label`/`title`.
  Nothing else about it changed — same id, same `.audio-toggle-btn--muted` class toggling, same
  JS in `wireAudioControls()`.
- With the dock gone from the topbar, `#theme-select` moved back *into* the topbar (was
  temporarily its own full-width `.theme-bar` row, see the gotcha below on why that existed) as
  `.topbar__theme` — title and theme select now share one row again, since there's no longer
  anything else competing for width there.
- Spacing was tightened throughout (`.app` gap, `.cabinet__frame`/`.cabinet__glass` padding,
  `.result-readout`/`.win-counter` margins, `.debug-panel` padding, `body` padding: 24px → 14px)
  to close the remaining gap after the dock move alone wasn't quite enough — verified by measuring
  `spinBtn.getBoundingClientRect().bottom <= window.innerHeight` directly, not by eyeballing a
  screenshot. **Reel size, symbol size, and the Spin button's own dimensions were deliberately not
  touched** — the fold-fix came entirely from removing/tightening chrome, not shrinking the game
  itself. The debug panel (a dev tool, explicitly "outside the cabinet's polish") is the one thing
  still allowed to sit below the fold on a short viewport.

**Post-Step-10 follow-ups (same design, two fixes):**
- **Bottom clearance under Spin.** `.cabinet__frame`'s padding went from a uniform `8px` to
  `padding: 8px 8px 34px` (asymmetric, bottom only). The Spin button's own box-shadow (`0 8px 0`
  solid + `0 12px 18px` blur, its "3D press" effect) adds ~25-30px of *visible* weight below the
  button's actual 108px box that a uniform 8px padding never accounted for — the button read as
  sitting flush on the frame's rounded corner. Top/left/right stayed at 8px; only bottom grew, so
  the Spin button's shadow now has room to fully resolve before the frame ends, matching the
  clearance above the reels. If the button's shadow ever changes, re-check this value — it's
  sized to that specific shadow, not derived from anything that updates itself.
- **Rebrand + responsive topbar.** The app is "Octave Spin Forge" now (`<title>`, `.topbar__title`,
  the startup terminal's `.startup-terminal__titlebar-label` all say so — `git grep -i "spin.forge"`
  if a rename ever needs to be found again). The longer name doesn't fit next to the theme select
  at typical desktop widths (verified fine down to ~700px), but crushes the select to ~44px wide —
  arrow only, no visible text — under a `@media (max-width: 480px)` breakpoint added to `.topbar`
  (`flex-wrap: wrap` + `.topbar__theme { flex-basis: 100% }`), which drops the theme select to its
  own full-width line below the title only on narrow viewports. This is deliberately *not* the
  same thing as the old standalone `.theme-bar` row from before Step 10 — it's conditional, and
  only pays the extra-row height cost where there's headroom to spare: verified narrow phone-sized
  viewports (375×812) still keep Spin fully above the fold with the wrap active, since mobile's
  tall aspect ratio means vertical space was never the tight resource there, horizontal was. Don't
  "simplify" this back to a single always-wrapping or never-wrapping rule without re-checking both
  a wide-short desktop viewport and a narrow-tall mobile one — they have opposite constraints.

---

## Known environment gotchas (spend zero time rediscovering these)

1. **Browser HTTP caching during local dev testing is aggressive and misleading.** This
   project has no cache-busting query strings and python's `http.server` doesn't send strong
   cache-control headers, so the Browser-pane tool's Chrome instance will happily keep serving
   a stale cached copy of `index.html`/`.css`/`.js` files across `navigate()` calls, even after
   editing the files on disk — with **no error**, just silently wrong behavior that looks like a
   real bug (missing DOM elements, `null` reference crashes, CSS not applying) until you realize
   it's cache. **Fix:** before testing after any edit, run
   `fetch(path, { cache: 'reload' })` for every touched file (HTML, CSS, and *every* JS module
   that changed — nested `import`s resolve to plain, independently-cacheable URLs, busting the
   entry point alone doesn't cascade), then `navigate()` again.
2. **`requestAnimationFrame` is unreliable for verification in this Browser-pane harness**
   specifically when the tab isn't the frontmost/active one (which happens often after a tool
   round-trip). Measured as low as 1 callback per 500ms. Don't trust rAF-based sampling for
   timing verification here — use `setTimeout`-chain polling instead, and expect that even
   `setTimeout`/`postMessage`-driven UI flows (spin animations, `waitForCond` polling loops) can
   run 10-50x slower in wall-clock time than expected if the tab lost focus. When a test seems to
   hang or a `javascript_exec` call times out, it's very likely this — take a screenshot (brings
   the tab back to front) and re-check state rather than assuming something broke.
3. **Howler's `Howl.prototype.play` gets called recursively/internally** with a bare numeric
   sound-id argument (not just externally with sprite-name strings) — if you monkey-patch
   `.play()` for instrumentation, expect to see extra log entries with numeric `name` values.
   That's Howler's own internal implementation detail (part of how it sets up a new Sound
   object for playback), not a bug in this code.
4. **CSS `align-items: center` + content taller than viewport = content becomes inaccessible.**
   `body` uses `align-items: safe center` (not plain `center`) specifically because plain
   `center` will center-and-clip content taller than the viewport symmetrically — the top
   overflow lands at negative scroll position, which is *unreachable* by normal page scrolling
   (scroll only ever reveals overflow below the fold). This bit us once already (the topbar with
   the mute buttons became invisible after the page grew taller across several steps) — don't
   revert this to plain `center`.
5. **Multiple Browser-pane tabs / stray blank tabs spawn unpredictably** during long tool-call
   sessions in this environment. If `navigate()` or `javascript_exec` suddenly reports "No site
   is open in this tab" or similar, run `tabs_context()`, close stray blank tabs, `tabs_select()`
   the real one, and retry — it's tooling flakiness, not an app bug.
6. **Flex children don't shrink below their content's intrinsic width by default**
   (`min-width: auto`), so a `<select>` sized to fit its longest `<option>` text can push a flex
   row wider than its container and overflow a parent's border — happened with `.theme-select`
   once "Vintage Arcade" became the longest option. Fix pattern: `min-width: 0` on the shrinkable
   flex containers (`.topbar__controls`, `.theme-select-wrap`) plus a `max-width` +
   `text-overflow: ellipsis; white-space: nowrap; overflow: hidden;` on the element itself so it
   truncates instead of overflowing. **This is a per-level gotcha, not a one-time fix** — giving
   a flex *container* `min-width: 0` only lets that container itself shrink; its own children
   (flex items one level deeper) still each need their own `min-width: 0` too, or they'll refuse
   to shrink and silently overflow straight out of the container that just fixed itself. Bit us
   again in Step 8: `.theme-select-wrap` had `min-width: 0` from the original fix, but `.theme-select`
   (the wrap's own child) didn't — invisible while the topbar had spare room, then the Step 8
   music fader widened `.audio-controls` enough to expose it again (`select.right` overshooting
   `theme-select-wrap.right` by 32px, wrap itself sized correctly). Fixed by adding `min-width: 0`
   to `.theme-select` itself (plus `flex-shrink: 0` on `.theme-select-label` so the short "Theme"
   label never truncates instead). When diagnosing this class of overflow, measure every level in
   the chain (`getBoundingClientRect()` on the overflowing element *and* each ancestor up to the
   bordered container) — the level that's actually too wide is often one deeper than the level
   that visibly has the border. **Resolved differently than either fix above, in the same
   session:** rather than chase a third level of `min-width: 0` (the `<select>` was still
   truncating down to a single visible letter — technically not overflowing, but useless), the
   select was moved out of the topbar entirely into its own full-width `.theme-bar` row below
   it. It no longer competes with the audio controls for space at all, so this whole class of
   bug is currently moot for it — worth remembering if anything else ever gets crammed into the
   topbar next to the audio controls. **Update, Step 10:** the select is back inside the topbar
   again (`.topbar__theme`, `.theme-bar` no longer exists) — safe this time because the audio
   controls it used to compete with moved out to the floating `#audio-dock` instead, not because
   this class of bug stopped being real. If controls ever move back into the topbar alongside the
   select, re-check for this exact overflow before assuming it's fine.
7. **A user-reported "no audio" bug for a specific theme may not be reproducible via this
   tool's testing.** Mexico and Vintage Arcade were once reported as silent beyond system UI
   sounds; direct testing (switching themes, inspecting live Howler `_sounds` state for
   `_paused: false`, running real spins and confirming sprite names fired, a rapid-switch race
   test) found no code-level bug — the ambient/music/reel chains all fired correctly. Root cause
   was never found; most likely explanations are the stale-cache gotcha above (on the user's
   real browser, not reproducible here) or a genuine content issue in the provided mp3 that
   can't be verified without listening to it. **Don't assume "couldn't reproduce" means "fixed"**
   — if this resurfaces, ask the reporter to hard-refresh and check the console for
   `[ThemeAudio]` warnings (both failure paths log via `console.warn`, see `ThemeAudio.js`)
   before re-investigating from scratch.
8. **`position: fixed` + `getBoundingClientRect()` = an element that detaches from the page the
   instant it scrolls.** `getBoundingClientRect()` is always viewport-relative, and `fixed`
   positioning is viewport-relative too — so using one to set the other *looks* correct at the
   instant you write it (the element lands exactly on target), but it's silently wrong the
   moment the page scrolls afterward: the real content moves with the scroll, the fixed element
   doesn't, and they visibly drift apart. Bit us with `SymbolCelebration.js`'s cloned winning
   symbol, cloned at `position: fixed` with raw `rect.left`/`rect.top` — looked perfect until you
   scrolled mid-celebration, then it floated in place while the reel scrolled out from under it.
   Fixed by switching both the clone and `.celebration-overlay` to `position: absolute` (whose
   containing block, with no positioned ancestor in between, is the document — scrolls with the
   page) and adding `window.scrollX`/`window.scrollY` into the stored coordinates, since
   `getBoundingClientRect()` itself never changes meaning (still viewport-relative) — only what
   you do with the number does. **The general rule:** viewport-relative measurement
   (`getBoundingClientRect()`) pairs with viewport-relative positioning (`fixed`) only for
   effects that are genuinely meant to stay pinned regardless of scroll (the big-win overlay, the
   startup terminal — true full-screen modals). Anything meant to visually track a piece of page
   content (a clone standing in for a specific element) needs document-relative positioning
   (`absolute` + scroll offsets) instead, or it'll only be correct at the exact instant it's
   created.
9. **A reel's pixel height is measured once, via JS, from real DOM layout — and if that
   measurement happens before the browser's first layout pass is fully settled for the page's
   actual final size, it locks in a too-small value that never self-corrects on its own.**
   `ReelController.measure()` sets `.reel`'s inline `height` from the currently-rendered symbol
   size (`.symbol` uses `aspect-ratio: 1/1`, so its size depends on the live grid column width);
   `GameController.showInitial()` — which calls this for the very first time — runs synchronously
   during `wireGame()` in `main.js`'s `init()`, while the startup terminal still visually covers
   the cabinet. That's *usually* fine, but was observed (not reliably reproducible on demand —
   came and went across otherwise-identical reloads in this same Browser-pane tool) to
   occasionally measure against a not-yet-fully-settled layout, locking in a reel height a few
   times smaller than the symbols actually rendered at — the reel container clips to the stale
   small height while its content renders at full (correct) size, reading as "the reels are
   shrunk." Fixed with `GameController.refreshLayout()` (re-runs `measure()` on every reel against
   whatever's currently in the DOM, without touching which symbols are showing), called once from
   `main.js`'s `init()` right after `themeTransition.enterFromTerminal()` resolves — i.e. the
   first moment the cabinet is actually visible to the player, guaranteed post-first-paint. Don't
   remove this call assuming `showInitial()`'s own measurement is sufficient; that's exactly the
   assumption that broke. (Every *spin* is safe already — `buildStrip()` re-measures every time —
   this only ever affected the very first static reveal.)

---

## What's deliberately NOT implemented yet

- Real per-theme symbol art. Symbols are still CSS shapes (`themes/*.json`'s `symbols` paths point
  at files that don't exist; intentional scaffolding). Backgrounds, by contrast, are fully real now
  (Step 9 mechanism + actual photos for all 4 themes as of the Football addition) — see "Theme
  switching / visual transition" above.
- Several `audioHooks.js` functions remain pure `console.log` placeholders with no real sound
  wired in yet: `playWinStinger`, `playWinLineDash`, `playSymbolPulse`, `triggerWinClimax`,
  `playTransitionWhoosh` (no whoosh sprite exists in `systemSounds.json` yet). Check
  `audioHooks.js` directly for the current authoritative list — it changes as more sound design
  lands.
- 4 themes exist (Egypt, Mexico, Vintage Arcade — `id: "arcade"` — and Football). The system
  generalizes cleanly to dozens more: drop a new `<theme>Sounds.json`/`.mp3` at the established
  paths, add a `themes/<name>.json` stub, add one `{ id, label }` entry to `THEMES` in
  `themeRegistry.js` (this alone updates both the startup terminal's list and the in-game
  dropdown), and add a `THEME_BACKDROPS[themeName]` gradient in `ThemeTransition.js` (falls back
  to the default dark gradient if omitted). No other code changes needed — `ThemeAudio` is fully
  generic and just reads whatever sprites the new bank declares. Football (added post-Step-10) is
  the cleanest real-world proof of this: zero code changes beyond the registry entry and the
  fallback gradient — same `_startThemeIntro()`/`measure()`/`refreshLayout()` etc. all just worked.
- The win-line dash (small win) is a single horizontal line; a big win's 9-tile blackout has no
  equivalent multi-line dash effect (explicitly deferred — see comment in `GameController.js`).

---

## If you're picking this up fresh

1. Read this file fully before touching code.
2. To run it locally: `python3 -m http.server 8934` from the project root, then open
   `http://localhost:8934/index.html`. No build step.
3. Check `audioHooks.js` first to see exactly which game events have real audio wired vs. are
   still placeholders — it's the single source of truth for "what's implemented."
4. When testing audio/timing in the Browser-pane tool, read the "Known environment gotchas"
   section above before spending time debugging what looks like an app bug.
