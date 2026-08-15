# Octave Spin Forge — Architecture Reference

**What this is:** a browser-based iGaming slot machine prototype whose real purpose is to be a
high-end showcase for custom, theme-swappable game audio built on Howler.js. Visuals are
intentionally simple/placeholder (CSS-shape symbols, CSS-gradient backdrops) — the audio
architecture is the actual product. Vanilla JS ES modules, no build step, no framework, no
dependencies besides Howler (loaded via CDN `<script>` in `index.html`).

Read this file first in any new session on this project. It reflects the state after Step 45
(fixed a real bug the user reported: the drag-to-unlock slider visibly resized right as it reached
the end. Root cause was a Step 43 CSS comment containing a literal `*/` mid-sentence
(`--metal-*/--cabinet-accent`), which silently closed the comment early and dropped the entire
`.engine-slider { width: 100%; display: flex; ... }` rule from the parsed stylesheet — no console
error, since CSS parse errors are silent. Without it the slider shrank to fit its own label text
width for its *entire resting state*, not just at unlock; it only became visible as a bug at the
one moment the label text itself changes (shrinking the already-wrong parent further, live, right
as the thumb snaps to a position computed pre-shrink). Fix was purely the comment wording — see
"Engine slider width bug: a self-inflicted CSS comment broke `.engine-slider` entirely (Step 45)"
below).
Before that: Step 44
(the JetBrains Mono + Space Grotesk font pairing ported from the sibling Tactile project — new
`--font-mono`/`--font-display` tokens, every hardcoded `"Courier New", monospace` routed through
`--font-mono`, and exactly 4 display-scale/brand selectors — the cabinet wordmark, the welcome
screen's opening line, the small WIN number, and the jackpot number — opted into `--font-display`.
Also fixed a pre-existing, previously-invisible bug this surfaced: every `<button>`/`<select>`/
`<input>` was silently rendering in the browser's default Arial, not the intended mono, for form
controls not inheriting `font-family` by default — fixed with a global `button, select, input,
textarea { font-family: inherit; }` reset. See "Font tokens: JetBrains Mono + Space Grotesk, ported
from Tactile (Step 44)" below).
Before that: Step 43
(the welcome screen's plain "Initialize Engine" button replaced with a physical drag-to-unlock
engine slider — an 8-notch track, a brushed-metal thumb, spring-back on an incomplete drag, and a
4-blade camera-shutter wipe on success — ported from the sibling Tactile project and adapted to
this project's `WelcomeScreen.js` lifecycle without changing `waitForStart()`/`dismiss()`'s own
code. See "Drag-to-unlock engine slider, ported from Tactile (Step 43)" below).
Before that: Step 42
(Neon Drive's audio bank refreshed to the current convention — `musicIntense`/`musicBigWin` added,
a `smallWin01-04`→`winSmall01-04` naming slip fixed at the sync-drive source before copying in,
and a new `THEME_BPM.neondrive = 80` entry so the adaptive-layer timing quantizes correctly. See
"Refreshing Neon Drive to the current bank convention (Step 42)" below).
Before that: Step 41
(kickplate control rework, done without pushing per the user's request — still local-only: the
bet-selector is now a proper dark bordered pill, matching every other readout's monospace font,
centered on its own row directly below Spin with equal literal clearance from Spin's border above
and the frame's edge below; the Fast-spin toggle is rebuilt as a `<button>` matching
`.powerbet-toggle`'s exact 74×48px shape/position (a track-and-thumb SVG glyph keeps it reading as
a switch), labeled "Fast Spin"; `systemSounds` refreshed to v2 — the money-counter loop now
randomizes across 5 named variants, renamed same-session to a `counter*` family
(`counterMain`/`Bubbles`/`Digital`/`Wood`/`Zap`, no longer `moneyCounter*`/a numbered `01/02`
pair) via a new `SystemAudio._randomMoneyCounterName()`, always still capped off by the fixed
`counterEnd` sting; and the Signal Monitor's always-blank tag column (SYS/THEME) was removed,
reclaiming 22px for the sprite-name column so full names (suffix included) render without an
`ellipsis` cutting them off. See "Kickplate control rework: bet-selector pill, a matched Fast-spin
button, and systemSounds v2 (Step 41)" below).
Before that: Step 40
(three independent audio-timing fixes: `uiTransition` now fires the instant a theme is selected —
init-menu terminal or in-game dropdown — instead of once the reveal finishes;
`playSmallWinBlink()` ("uiPulse") now fires 3 times per small win, synced to the actual
3-iteration `.symbol--win` CSS animation's peak-brightness instants (its `animationiteration`
event as the per-iteration anchor, offset by half an iteration to land on the 50% keyframe rather
than the darkest iteration boundary — a same-session correction after the first version's
boundary-timed cues read as unsynced); and `moneyCounter`'s pitch randomization was removed
entirely —
`moneyCounterEnd` now calls `howl.play()` directly instead of routing through `SystemAudio.play()`'s
randomized-rate wrapper, matching the loop itself, which never randomized to begin with. See
"Theme-select audio timing, synced small-win pulses, and an in-tune money counter (Step 40)"
below).
Before that: Step 39
(`systemSounds` refreshed to v1 — `moneyCounter01/02/End`, `uiDash`, `uiPulse`, `uiTransition` —
with `playWinLineDash()`/`playSmallWinBlink()`/the systemic small-win-counter fallback repointed
at real sprites for the first time, and a new `playTransitionOutro()` hook. A new minimal
`.bet-selector` (two bare `<button>` carets flanking a `"$ X.XX"` value, no button chrome) sits
directly under the Fast toggle, stepping through a fixed `BET_STEPS` array (clamped, not wrapped)
— not yet wired into actual payout math. Locks (grayed + `pointer-events:none`) for the exact
duration of a spin, same lifecycle as `spinBtn`/`powerbetBtn`. Each click plays `uiBet` via a new
`SystemAudio.playBetClick(direction)`, whose rate bends further from 1.0 the faster/more
consecutively the arrows are clicked (capped 0.5-1.5, resets past a 500ms gap) — verified against
the task's own worked example exactly. See "systemSounds v1 refresh, an elegant bet-size UI, a
spin lock, and pitch-bending audio (Step 39)" below).
Before that: Step 38
(Turbo reel stops now snap their *visual* landing onto the track's 16th-note grid via
`ThemeAudio.getTurboStopQuantizeDelay()`, generalized from Step 34's 8th-note helper — the stop
chime itself was briefly un-suppressed in fast mode too, then reverted same-session at the user's
request, since the existing `reelStop` bank wasn't sound-designed for 3-at-once playback; it stays
silent in Turbo mode for now. A new `js/audio/rhythmTimers.js` tracks every such musically-quantized `setTimeout`
(Turbo stops, Big Win anticipation) so a new `js/backgroundGuard.js` can flush them immediately —
not silently drop them — the instant `document.visibilitychange` reports the tab hidden, alongside
pausing/resuming reel spin animations via `ReelController.pauseSpinAnimation()`/
`resumeSpinAnimation()`. Deliberately does not touch `Howler.mute()` — `main.js`'s pre-existing
`wireAudioControls()` already handles that correctly, layered under the player's manual Master
Mute. See "Reel Turbo 16th-note quantization + a background-tab throttling guard (Step 38)" below).
Before that: Step 37
(three independent tweaks: (1) the `musicMain_<bpm>`/`musicIntense_<bpm>` sprite-name-suffix
convention from Steps 35-36 was reverted back to plain `musicMain`/`musicIntense` in all 6
refreshed banks' JSON — BPM is now a manually-curated `THEME_BPM` constant in `ThemeAudio.js`
instead, supplied per theme rather than parsed from a suffix; (2) `SMALL_WIN_INTENSITY_COOLDOWN_MS`
raised 10s → 20s; (3) `BIG_ROLLUP_MS` raised 8s → 17s, verified duration-exact
(`WinCounter.rollUp()` timed directly: 17004.7ms elapsed) with the gradual rise/climax-scale
growth/brake-zone deceleration all confirmed unchanged, since `WinCounter.js`'s easing is
parameterized on time *fraction* and win amount, never the raw duration. See "Storing BPM per
theme instead of a sprite-name suffix; longer intensity cooldown; a 17s Big Win roll-up (Step 37)"
below).
Before that: Step 36
(Egypt, Football, China, Gangster, and Mexico all refreshed to the same `musicMain_<bpm>`/
`musicIntense_<bpm>`/`musicBigWin` convention Arcade's v02 bank introduced in Step 35 — Egypt and
Gangster 100 BPM, Football/Mexico 130 BPM, China 120 BPM. Every theme with a real audio bank is
now on this convention except Neon Drive (no refreshed bank provided for it yet). Football needed
a naming fix (`musicMain` → `musicMain_130`, to match its own `musicIntense_130`); Mexico went
through several reverts first on a suspected bad export, before the real cause turned out to be a
stale mp3 HTTP cache in this project's own testing (see "Known environment gotchas" item 11) —
once both the JSON *and* the mp3 were properly cache-busted together, and a new
`howl.duration()` cross-check confirmed the right buffer was loaded, Mexico verified cleanly with
the exact same bytes already tried before. See "Refreshing Egypt, Football, China, Gangster, and
(eventually) Mexico to the Step 35 convention (Step 36)" below).
Before that: Step 35
(Arcade's bank refreshed again to `arcadeSounds_v02` — `musicMain`/`musicIntense` are now
`musicMain_114`/`musicIntense_114` (BPM embedded in the sprite name itself, the confirmed
go-forward convention for Step 34's dynamic BPM parsing), and a new `musicBigWin` sprite plays
alongside `winBigRiser` as a dedicated Big Win music bed. `ThemeAudio._findMusicSpriteName()`
now resolves music sprites dynamically (bare name or `"_<bpm>"`-suffixed) instead of the old
hardcoded `"musicMain"`/`"musicIntense"` literals; `busRouting.js`'s `busMusic` rule became a
regex to match either form, now including `musicBigWin`. See "BPM-in-sprite-name + musicBigWin:
refreshing Arcade to v02 (Step 35)" below).
Before that: Step 34
(a Big Win's entry now waits for the next musical 8th-note of the currently-playing `musicMain`
before firing — `audioUtils.js`'s new `parseBpmFromPath()` regex-parses a BPM from the theme's
audio source filename (falling back to 120), `ThemeAudio._msToNextEighth()` computes the delay
via `Howler.seek()`, and `scheduleBigWinEntry()` pauses the Step 30 intensity cooldown, waits out
the delay, then hard-ducks both music layers to silence (100ms) right as the riser/widget fire.
`stopBigWinRiser()` now fades both layers back from silence over 2000ms — masked by
`winBigRiserEnd`'s own tail — once that completes, resuming the paused cooldown. See
"BPM-quantized Big Win entry with a hard duck/curtained-exit restore (Step 34)" below).
Before that: Step 33
(the black screen between a theme's fade-to-black and fade-in — previously as short as ~333ms or
as long as ~800ms depending on how large that theme's assets were — is now unified to a 1000ms
floor via `ThemeTransition`'s `BLACK_HOLD_MIN_MS`, run concurrently with the actual load work
rather than added after it, so it never doubles up. See "Unifying the theme-transition
black-screen hold to 1000ms (Step 33)" below).
Before that: Step 32
(the musicMain<->musicIntense crossfade duration from Step 30 is now a live, per-theme Dev Mixer
setting — a new "Music Crossfade" slider/row (0-5s in 0.5s steps, default 1s) stored as
`crossfadeMs` alongside each theme's bus multipliers in `DevMixer.js`, so it rides along with
Export Config the same way bus gains do. `ThemeAudio._crossfadeToIntensity()` reads it fresh at
the start of each transition. See
"Customizable crossfade duration (Step 32)" below).
Before that: Step 31
(Arcade's bank was refreshed from the sync drive's `arcadeSounds_v01` — the first bank to actually
define `musicIntense`, used to verify Step 30 end-to-end with real audio rather than a mocked
layer; one casing regression, `powerbetOn`/`powerbetOff`, was fixed to `powerBetOn`/`powerBetOff`
at the source, both in the Drive original and the project copy, per the Step 19 policy. See
"Refreshing arcadeSounds.json with musicIntense (Step 31)" below).
Before that: Step 30
(adaptive music — vertical layering: every theme's Howl instance can now carry a second,
optional `musicIntense` sprite alongside `musicMain`. When present, both are started in the same
synchronous tick so they stay phase-locked as two layers of one loop; each small win crossfades
the mix toward `musicIntense` over 1s and holds it there for a strict, wall-clock 10s cooldown
that resets on every new small win, then crossfades back to `musicMain`. Opt-in scaffolding, same
"silently does nothing until a bank defines the sprite" contract as `winSmallDigits`/`powerBetOn`
— Arcade is the first (and, as of Step 30 itself, only) bank to define `musicIntense` (see Step
31). See "Adaptive music: vertical layering (Step 30)" below).
Before that: Step 29
(two small UI/UX changes: the Powerbet toggle is now labeled "Super Bet" to the player — internal
ids/classes/audio-hook names deliberately still say "powerbet" — with `ThemeAudio.playPowerBetOn/
Off()` now preferring `superBetOn`/`superBetOff` and falling back to the existing `powerBetOn`/
`powerBetOff` (no theme JSON was touched); and Space now triggers a spin from anywhere on the page
once the cabinet is actually playable — an *exclusive* Spin shortcut, unconditionally
`preventDefault()`-ed so nothing else focused (Fast, Super Bet, the theme select) can intercept
it, after an initial defer-to-native-focus version turned out to let exactly that happen. See
"Super Bet rename + dual sprite names, and Space-to-spin (Step 29)" below).
Before that: Step 28
(a 7th theme, Gangster, was added via the standard pipeline — `assets/themes/gangster/`,
`gangster-01-blue-revolver.svg`/`02-green-poker-hand`/`03-coral-grand-piano`/`04-purple-explosion`/
`wild-gold-reload`, `bg_gangster.jpg`, registry entry, backdrop gradient. Its bank had two naming
issues, both confirmed with the user before touching anything (per the Step 19 policy):
`smallWin01-04` → `winSmall01-04` (same mistake-shape as Neon Drive originally had), and a
genuinely new one — `startAnimationBigWin`/`startAnimationBigWinEnd`, a completely different name
(not just reordered/miscased) for what turned out to be this bank's `winBigRiser`/`winBigRiserEnd`.
Both fixed directly in the JSON, both file locations, same as every prior naming fix. See "Adding
Gangster: a completely-renamed riser (Step 28)" below). Before that: Step 27
(icon *files* now follow an explicit naming convention —
`assets/themes/<theme>/<theme>-<slot>-<color>-<keyword>.svg`, e.g.
`assets/themes/egypt/egypt-01-blue-horus.svg` — replacing the old generic `symbol01.svg`/`wild.svg`
names; every `themes/<id>.json` was updated to match, and the old-named files were deleted, not
left alongside the new ones. All 6 `wild` icons also gained actual "WILD" text baked into the SVG,
which Step 26's fresh icon set hadn't included. See "Icon file naming convention + WILD text
(Step 27)" below). Before that: Step 26
(every theme's 5 symbol icons were replaced with a new, explicit per-theme icon concept — e.g.
Egypt's symbol01 is now specifically "ibis bird / Horus" rather than the looser "cobra" guess
Step 24 shipped with. **This concept table is the canonical, persistent naming convention for
these icons going forward — see "The per-theme symbol icon convention (Step 26)" below and treat
it as binding, not a one-time description; it's since been kept current** (Step 27 filled Arcade's
symbol03 gap with "rocket" and changed Football's symbol01 from "trophy cup" to "gloves"; the
table below already reflects both)). Before that: Step 25
(3 small-win audio hooks were prepared — wired, guarded, and structurally complete — but left
deliberately inert, since none of their sprite names exist in any bank yet: `playWinLineDash()`
and a new `playSmallWinBlink()` (both systemic, tiny randomized-pitch ticks around the win-line
dash and the post-celebration blink), and the small-win money counter's start/stop, which now
prefers a theme's own `winSmallDigits`/`winSmallDigitsEnd` (China has one) and falls back to a
generic systemic pair of the same name otherwise — all three become live automatically the
moment their sprites are added, no code changes needed. See "Preparing 3 small-win audio hooks,
left inert (Step 25)" below). Before that: Step 24
(symbols got real per-theme icon art — a 2D SVG icon set per theme, 5 icons each, pulled
dynamically from that theme's JSON `symbols` map, with a graceful fallback to the old CSS-shape
rendering for any symbol a theme doesn't (yet) provide art for. `.symbol` itself became a plain
invisible flexbox container; the Wild's win highlight was also split into its own, more aggressive
class, distinct from the standard gold pulse other symbols get — see "Real per-theme symbol icons
(Step 24)" below). Before that: Step 23
(the Big Win counter's easing curve was reworked — a fast, non-decelerating climb through ~98% of
the value, with a sharp brake confined to a short final slice, replacing a continuous ease-out
that visibly dragged through the last several thousand points of a large win. Step 22's 550ms
`CLIMAX_HOLD_MS.big` hold before the climax effects is also gone — they now all fire in the exact
frame the target value is reached, zero setTimeout. See "Reworking the Big Win counter's pacing:
aggressive climb, zero-latency climax (Step 23)" below — Step 22's own section is kept as
historical record of the synchronization mechanism itself, which is unchanged, just no longer
delayed). Before that: Step 22
(the exact instant the Big Win counter settles now gets a synchronized 3-part payoff: a one-shot
digit "punch" — scale to 1.2x, flash white, settle to gold at scale 1.0 — the coin fountain's
emitter cutting off (existing coins keep falling naturally, not destroyed), and the `busWinsBig`
outro stinger being queued, all from the exact same synchronous block in `WinCounter.rollUp()`.
See "Synchronizing the Big Win counter's settle moment (Step 22)" below). Before that: Step 21
(arcadeSounds.json was refreshed from the source, same as Egypt — this time with `mainMusic`
instead of `musicMain` again, plus a new naming variant: `powerbetOn`/`powerbetOff`, lowercase
"b", instead of `powerBetOn`/`powerBetOff`. Per the Step 19 policy, asked before touching
anything; both were confirmed as oversights and renamed directly in the JSON (both the project
copy and the Drive source file), same treatment as every prior naming fix. See "Refreshing
arcadeSounds.json (Step 21)" below). Before that: Step 20
(egyptSounds.json was refreshed from the source — Egypt now defines `powerBetOn`/`powerBetOff`
and `winSymbol04` directly like China/Neon Drive, no longer needs the legacy `winSymbolScatter`
fallback. The new file also briefly had 4 big-win-intro takes — `winBigT1`, `winBigT12`,
`winBigT2`, `winBigT4` — where only one existed before; per explicit direction, 3 were deleted
and the kept one (`winBigT4`'s audio) was renamed to the expected `winBigT1`, not wired up as a
4th random-pick pool. See "Refreshing egyptSounds.json (Step 20)" below). Before that: Step 19
(the naming-fallback mechanisms built in Steps 17-18 — `_musicSpriteName()`'s musicMain/mainMusic
fallback, and `_randomAvailableIndexedName()`'s priority-ordered-prefix-list form for
winSmall/smallWin — were both **removed**, and the two JSON files that motivated them were
corrected at the source instead (`neondriveSounds.json`'s `smallWin01-04` → `winSmall01-04`,
mirroring the earlier `mainMusic` → `musicMain` fix in `chinaSounds.json`). **This is now the
default going forward: when a bank's naming looks like a one-off authoring slip, fix it in the
JSON — ask first if it's not clearly a mistake — rather than writing fallback code for it.** See
"Reverting the naming fallbacks: fix JSON at the source instead (Step 19)" below; Steps 17-18's
sections are kept as historical record of what was tried and why it changed, not as current
behavior. Before that: Step 18
(a 6th theme, Neon Drive, was added — its bank originally named the small-win flavor layer
`smallWin01-04` instead of every earlier bank's `winSmall01-04`, the same "words swapped"
mistake-shape as China's `mainMusic`/`musicMain` — see Step 19 above for how this was ultimately
resolved). Before that: Step 17
(a 5th theme, China, was added — the first bank to break two previously-unstated assumptions:
fewer reel/win sprite variants than every earlier bank provided, and its music track named
`mainMusic` instead of `musicMain`. Both are now handled generically rather than patched for
China specifically — see "Adding China: variant-count and music-name fallbacks (Step 17)"
below — plus a new `winSmallDigits`/`winSmallDigitsEnd` pair wired to the small-win counter's
roll-up start/end, the small-win equivalent of the big win riser/riserEnd pattern). Before that:
Step 16
(a hidden developer tool — triple-click the Signal Monitor's header to reveal a per-theme
bus-gain mixing console, with sliders for every bus covering every sprite in the game and an
Export Config button that stringifies the adjusted multipliers to the clipboard; see "Dev mixer
& bus routing (Step 16)" below). Before that: Step 15
(the standalone `.topbar` panel is gone entirely — the "OCTAVE SPIN FORGE" title moved into
`.cabinet__frame` as `.cabinet__title`, centered above the reels, and the theme `<select>` moved
into the floating `#audio-dock` alongside Master Mute and the music fader, as a third dock pill;
see "Title relocation & theme select → dock (Step 15)" below). Before that: Step 14 (Spin,
Powerbet, and Fast/Slow all now share one "brushed anodized aluminum" material —
directional metallic gradients, a brush-stroke texture layer, real inset bevels, and shadows that
physically compress on `:active` — replacing Spin's old glossy radial-gradient "candy button" look
and Powerbet/Fast's flat panel styling; see "Brushed aluminum material (Step 14)" below). Before
that: Step 13 (the debug "Force Big Win" button is gone — forcing a blackout is now a real,
prominent "Powerbet" toggle on the cabinet itself, with a persistent high-energy glow while armed
and an auto-reset once the win is fully collected — see "Powerbet (Step 13)" below). Before that: Step 11
(landed chronologically *after* Step 12 below — the user numbered it that way, it's not a doc
error): `musicMain` now starts alongside `gameStart` with a 2000ms fade-in instead of waiting for
it to finish, and Scatter was stripped of all special behavior and folded into the standard
symbol set as `symbol04` — see "Music fade-in (Step 11)" and "Scatter removal (Step 11)" below.
Before that: Step 12 (a "Welcome Screen" master audio gate now loads *before* the startup
terminal — see "Welcome screen (Step 12) & the audio-gate chain" below). Earlier: Step 10 (UI
harmonization: the cabinet's
"metal plate" chrome was replaced with the startup terminal's flat dark-panel language, and Master
Mute/the music fader moved into a floating dock so Spin sits above the fold) plus a post-Step-10
pass (rebranded to "Octave Spin Forge", the cabinet frame's bottom padding increased to actually
clear the Spin button's own drop-shadow, and the topbar made responsive so the longer name doesn't
crush the theme select on narrow viewports) — see "Visual system & layout (Step 10)". Earlier
still: Step 9 (dynamic per-theme background image injection, with graceful CSS-gradient
fallback — all 4 themes now have real photos), and a post-Step-8 bugfix pass (theme dropdown moved
to its own row, celebration symbols fixed to scroll with the page, profiler tag column blanked,
initial reel measurement race that could shrink reels on first load, startup terminal hover/click
sfx added and then fixed against the focus-mute layer silencing them). A 4th theme (Football) was
added after Step 10 with zero code changes beyond the registry entry, proving out the "add a
theme" pipeline. The project is also now deployed (a public-but-unlisted GitHub Pages site;
`robots.txt` + `noindex` meta tag, not real access control — anyone with the direct link can still
open it, see the repo's own deploy history for the URL) and lives in a git repo, unlike earlier in
this file's history. If something described here doesn't match the code, trust the code and update
this file.

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
3. **5 generic symbols only, across every theme:** `symbol01`, `symbol02`, `symbol03`, `symbol04`,
   `wild` (`SYMBOL_META` in `SpinSequence.js`). No theme-specific symbol ever. (As of Step 11,
   `symbol04` — previously "scatter" — is a plain figure with no special behavior; see "Scatter
   removal (Step 11)" below for what changed and why the rule text itself changed with it.)
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
  WelcomeScreen.js                 Step 12. The master audio gate, loads *before* the terminal.
                                   waitForStart() resolves on the "Initialize Engine" click;
                                   dismiss() fades (CSS opacity transition) then permanently
                                   removes itself, same pattern as StartupTerminal's dismiss().
                                   Owns none of the actual unlock/sfx logic itself — main.js's
                                   init() orchestrates that part, same separation of concerns as
                                   the terminal (screen handles its own DOM/interaction only).

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
                                   Also `unlockAudioContext()` (Step 12) — explicitly resumes
                                   `Howler.ctx` if suspended; safe/no-op if Howler hasn't
                                   constructed a context yet or it's already running.
  AudioProfiler.js                 Step 8. Passive debug HUD: polls both `systemAudio.howl` and
                                   `themeAudio.howl`'s own `_sounds` arrays (Howler has no "now
                                   playing" API) every 200ms and renders one row per actively-
                                   playing sound into `#audio-profiler-list`. Never calls into any
                                   audio API — read-only.
  busRouting.js                    Step 16. Single source of truth mapping a sprite name (prefix-
                                   matched) to its dev-mixer bus — busReelsNormal/busReelsTurbo/
                                   busMusic/busAtmosphere/busWinsSmall/busWinsSymbol/busWinsBig.
                                   `getBusForSprite(name)` + the `BUS_NAMES` list both the mixer
                                   panel and ThemeAudio import from here.
  DevMixer.js                      Step 16. Pure state: `themeMixes` (per-theme bus-gain
                                   multipliers, in-memory only), `getBusVolume`/`setBusVolume`/
                                   `getThemeMix`/`exportJSON()`. No DOM, no Howler — see "Dev
                                   mixer & bus routing (Step 16)" below.
  DevMixerPanel.js                 Step 16. The hidden mixer's DOM/UI: builds one slider per bus,
                                   the triple-click reveal on the Signal Monitor's header, and the
                                   Export Config button (clipboard write + textarea fallback).

src/audio/                      Theme + system audio JSON configs (exact copies of provided
                                 files, see rule #4 above).
  systemSounds.json
  egyptSounds.json
  mexicoSounds.json
  arcadeSounds.json
  footballSounds.json
  chinaSounds.json
  neondriveSounds.json

assets/23/sounds/                Actual mp3 files. Path is dictated by each JSON's own "src"
                                  field (`./assets/23/sounds/<name>.mp3`), which is never edited
                                  — so the mp3 MUST live at exactly this path, resolved relative
                                  to the page root (Howler resolves it that way, not relative to
                                  the JSON's own location).

assets/bg_<name>.jpg             Real per-theme background photos (Step 9's bgImagePath target —
                                  see "Theme switching / visual transition"). All 6 themes have
                                  one: bg_egypt.jpg, bg_mexico.jpg, bg_arcade.jpg, bg_football.jpg,
                                  bg_china.jpg, bg_neondrive.jpg.

assets/themes/<name>/            Real per-theme symbol icon art (Step 24's `symbols` target — see
                                  "Real per-theme symbol icons (Step 24)"). 5 SVGs per theme:
                                  symbol01-04.svg, wild.svg. Same slot colors across every theme
                                  (--symbol-01/02/03/04/wild) — the shapes are theme-specific, the
                                  color-per-slot is not, so a symbol's *role* stays visually
                                  recognizable even after a theme switch.

themes/                         Per-theme *visual* config stubs (themeName, bgImagePath — real,
                                 see above; symbols — also real as of Step 24, see above — plus a
                                 `background.asset` stub field that's still unused-but-wired
                                 scaffolding for a possible future full-background-art pass; don't
                                 confuse the two, only bgImagePath and symbols are actually read).
  egypt.json, mexico.json, arcade.json, football.json, china.json, neondrive.json
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
  Small2, Loss, Loss, Small3, Loss, Loss, Small4, Loss, Loss, Small5, Loss, Loss, Small1, ...`
  (5 small-win tiers as of Step 11, was 4). Loss paylines cycle through 4 hardcoded non-matching
  patterns. Small win tiers: `small1`/`small2`/`small3`/`small5` are pure 3-of-a-kind
  (symbol01/02/03/04 respectively), `small4` is a mixed "Wild Assist" (`["wild","symbol01",
  "symbol01"]`) — kept as its own distinct tier even though `symbol04` now exists, since it
  showcases a different *kind* of win (mixed-symbol combo), not a stand-in for a missing symbol
  anymore (see "Scatter removal (Step 11)" below for why that reasoning changed).
- **Big win** only ever happens via `spinSequencer.forceBigWinNext()`, never in the natural
  cycle — as of Step 13 this is armed by the player-facing Powerbet toggle, not a hidden debug
  button (see "Powerbet (Step 13)" below). Its symbol is *also* deterministic: a plain
  round-robin across all 5 symbols with equal weight — `symbol01, symbol02, symbol03, wild,
  symbol04, symbol01, ...` (`BIG_WIN_SYMBOLS`, cycled by `_bigWinIndex`). Before Step 11 this had
  a special "Scatter every 3rd" cadence; that's gone, see below. The counter lives on
  `SpinSequencer` and advances on *arm*, not on consumption — toggling Powerbet on/off/on again
  without spinning burns two cycle slots even though only the second armed outcome is ever
  played. This is a known, accepted quirk (inherited unchanged from the old debug button), not a
  bug worth "fixing."
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
| `gameAmbLP` | Ambient loop, starts immediately on theme load, parallel to `gameStart`/`musicMain` | `_playAmbientLoop()` — **SFX layer, immune to the music fader, only Master Mute silences it** |
| `gameStart` | One-shot intro | `_startThemeIntro()` — as of Step 11 fires *alongside* `musicMain`, not before it (see "Music fade-in" below) |
| `musicMain` | Main background loop | `_playMusicLoop()` — **the only sprite the music fader controls**; fades in 0→target over 2000ms every time it starts (Step 11), and is ducked -3dB/1s during the riser (see below) on top of whatever the fader is set to |
| `reelStart01`-`05` | Slow-mode reel start | `playReelStart()` — random pick among the 5 |
| `reelStop01`-`05` | Slow-mode reel stop | `playReelStop()` — random pick among the 5 |
| `reelTurbo01`-`05` | Fast-mode reel cue | `playReelTurbo()` — **replaces both start and stop** in fast mode (fires once at spin start; per-reel stop calls are suppressed) |
| `winSmall01`-`04` | Small win layer | `playSmallWin()` — random pick, **played at -2dB by default** |
| `winSymbol01`-`04`, `winSymbolWild` | Symbol-specific win layer | `playSymbolWin(symbolId)` — **`winSymbol04` falls back to `winSymbolScatter` if the active bank doesn't define it** (every bank provided so far doesn't — see "Scatter removal (Step 11)" below) |
| `winBigRiser` | Big win climax buildup | `playBigWinRiser()` — ducks `musicMain` -3dB/1s at the same moment |
| `winBigRiserEnd` | Riser payoff sting | Fired from inside `stopBigWinRiser()`'s `once("stop", ...)` callback on the riser's own id — i.e. a direct consequence of the riser stopping, not a separate timed call. Also un-ducks music (1s fade back to its pre-duck volume, not a hardcoded 1.0). |
| `winBigT1` | Big win overlay-appear stinger | `playBigWinIntro()` |

`SYMBOL_SPRITE_MAP` in `ThemeAudio.js` maps our 5 generic symbol ids to the `winSymbol*` names —
this mapping itself is considered part of the abstract template (every theme is expected to
follow it), not theme-specific. `symbol04` is the one exception with a hardcoded fallback rather
than a second map entry — see below.

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

## Music fade-in (Step 11)

Before Step 11, `musicMain` waited for `gameStart` to finish (chained via Howler's `once("end",
...)` on the intro's own sound id) before starting, then snapped straight to its target volume.
As of Step 11, `_startThemeIntro()` fires `gameAmbLP`, `gameStart` (if present), and `musicMain`
all in the same synchronous pass — no chaining, no waiting. `_playMusicLoop()` then calls
`this.howl.fade(0, this.musicVolume, MUSIC_FADE_IN_MS, this.musicId)` (`MUSIC_FADE_IN_MS = 2000`)
immediately after `.play()`, so it enters from silence over 2 seconds rather than colliding at
full volume with `gameStart`'s intro stinger. Howler's `.fade()` sets the starting volume itself —
no separate `.volume(0, id)` call needed first, and this matches the exact style already used by
`_duckMusic()`/`_unduckMusic()` elsewhere in this file.

This fade-in runs on *every* `_playMusicLoop()` call, not just the very first theme load —
switching themes re-triggers it each time, by design (it's "how music enters," not a one-time
intro special case). If `musicVolume` is 0 (player has the fader all the way down), the fade
still runs, just fades in to silence — harmless, no special-casing needed.

**Interaction with ducking:** `_duckMusic()`/`_unduckMusic()` read `this.howl.volume(this.musicId)`
to capture "wherever the music actually is right now" rather than assuming a static target — this
already handles a big win landing mid-fade-in gracefully (vanishingly unlikely in practice, since
Force Big Win requires two clicks, but correct by construction either way, not by special-casing).
**Interaction with the fader:** dragging the music fader while the 2s fade-in is still running
calls `.volume()` directly, which the fade's own animation loop will simply overwrite on its next
tick — the fade "wins" until it completes. Not addressed further; matches how the fader already
interacts with ducking, and hasn't been reported as an issue.

---

## Scatter removal (Step 11)

**What changed:** the "Scatter" symbol no longer exists as a distinct concept anywhere in game
logic. It's `symbol04` now — visually identical (still the purple hexagon, `--symbol-04` /
`.symbol--04` in `css/styles.css`, renamed 1:1 from `--symbol-scatter` / `.symbol--scatter`), but
treated exactly like `symbol01`-`03`: a plain figure with no special behavior. Every non-negotiable
design rule and file-map description elsewhere in this doc that used to say "scatter" has been
updated to say `symbol04` — if you find one that still says "scatter" outside of history/rationale
comments, that's a doc bug, fix it.

**What specifically was stripped:**
- The small-win cycle gained a 5th tier, `small5` (`Symbol04 x3`, 150), appended after `small4` —
  `symbol04` now gets a plain-triple small win just like `symbol01`-`03`, instead of never
  appearing in a small win at all.
- The big-win symbol cycle (`BIG_WIN_SYMBOLS` in `SpinSequence.js`) used to give Scatter
  guaranteed priority — the 1st/4th/7th/... forced big win was *always* Scatter, with the other
  4 symbols cycling through the remaining slots. That's gone: it's now a flat round-robin across
  all 5 symbols with equal weight, in array order (`symbol01, symbol02, symbol03, wild,
  symbol04, ...`), no symbol favored. Verified live: 5 consecutive Force Big Win clicks produced
  exactly that order with no repeats, and a 6th wrapped back to `symbol01`.
- `LOSS_PATTERNS` had two entries referencing `"scatter"` — both now say `"symbol04"`. Purely a
  rename; the patterns themselves (which reels show which non-matching symbols) are unchanged.

**The audio-routing consequence (why the fallback in the contract table above exists):** every
theme sprite bank provided so far (`egyptSounds.json`, `mexicoSounds.json`, `arcadeSounds.json`,
`footballSounds.json`) predates this rename and only defines `winSymbolScatter`, not
`winSymbol04`. Rather than block the rename on re-recording/renaming sprites in 4 audio banks,
`ThemeAudio.playSymbolWin()` checks `_spriteNames.has("winSymbol04")` first and falls back to
`winSymbolScatter` if it's missing — dynamically, per theme, not a one-time migration. **If a
future theme bank ships with a real `winSymbol04` sprite, it'll be picked up automatically and
the fallback simply won't trigger for that theme** — no code change needed either way, this is
exactly the kind of thing the dynamic check exists to handle. Don't "clean up" the fallback
assuming all banks have been migrated without actually checking `_spriteNames` first. **This
already happened once:** `chinaSounds.json` (Step 17) is the first bank to define `winSymbol04`
directly — it never touches the `winSymbolScatter` fallback path, no code change was needed to
support it.

---

## Powerbet (Step 13)

**What changed:** the "Force Big Win" debug button (`#force-big-win-btn`, `.debug-panel`) is
gone — both the element and its CSS (`.debug-panel*`, `.debug-btn*`, `@keyframes
debug-armed-pulse`) were deleted outright, not just hidden. The exact same underlying mechanic
(`spinSequencer.forceBigWinNext()` / `isForceArmed()`) is now armed by a real, permanent,
player-facing control: the Powerbet toggle (`#powerbet-toggle-btn`, `.powerbet-toggle`) in the
kickplate row, replacing what used to be an empty `.kickplate__spacer` in the same 74px column
(Fast toggle and Spin stay exactly where they were).

**State machine, in `main.js`'s `wireGame()`:**
- Click while unarmed → `spinSequencer.forceBigWinNext()` (arms it, advances `_bigWinIndex` —
  see "Deterministic outcome generation" above) → `playPowerBetOn()`.
- Click while armed → `spinSequencer.disarmForcedBigWin()` (new method on `SpinSequencer`,
  just clears `forcedOutcome` — deliberately does *not* roll back `_bigWinIndex`, same "arms on
  arm" accounting the old debug button already had) → `playPowerBetOff()`.
- There's no separate local boolean tracking "is Powerbet on" — the toggle/glow are driven
  directly off `spinSequencer.isForceArmed()` every time `syncPowerbetUI()` runs, so there's
  nothing to desync.

**The auto-reset timing is the one subtle part.** `syncPowerbetUI()` is *not* called the instant
`spinSequencer.next()` consumes the forced outcome (which happens immediately at the start of
`GameController.spin()`, before the reels even move) — it's called only in `main.js`'s
`spinBtn` click handler, *after* `await game.spin()` resolves. `game.spin()` doesn't resolve
until the *entire* win presentation finishes (reels land, celebration plays, the big win overlay
appears, the 8s counter rolls up, and the player clicks Collect — see `BigWinWidget.show()`,
"The spin flow, end to end" above). So the toggle button and the cabinet's glow both stay fully
lit for the whole Powerbet spin, not just until the outcome is decided, and only clear once the
player has actually collected — that's what makes this a real *auto-reset tied to completion*,
not an instant reset tied to consumption. If this ever gets refactored, preserve that gap; syncing
too early is the obvious-looking bug to accidentally reintroduce.

**No sound on auto-reset, by design:** unlike the manual toggle, the auto-reset path does not
call `playPowerBetOff()` — the spec ties the on/off cues to the toggle action itself (requirement
3), while auto-reset is described purely in state/visual terms (requirement 5, no audio
mentioned). Also avoids stacking another cue on top of an already sound-dense moment (riser-end,
big win stinger, roll-up climax all already fire around Collect).

**Visuals:** `.cabinet__frame--powerbet` adds a pulsing colored box-shadow/border on top of the
frame's existing base shadow (never replaces it) via `--powerbet-accent` (`#ff5c3d`) — a new,
deliberately non-gold accent color so "Powerbet armed" reads as a distinct mode at a glance
instead of blending into the app's existing gold "win" highlighting everywhere else. The toggle
button pulses with the same color/rhythm so the button and the cabinet read as one state.

**Audio safety (requirement 3):** `powerBetOn`/`powerBetOff` don't exist in any theme bank yet.
`ThemeAudio.playPowerBetOn()`/`playPowerBetOff()` check `_spriteNames.has(...)` before calling
`_play()`, exactly the same defensive pattern as Step 11's Scatter fallback (see above) — silent
no-op today, picked up automatically the moment a bank actually defines these, no code change
needed either way.

**Incidental fix while wiring this up:** the Powerbet toggle sits in the kickplate's bottom-right
74px column — which turned out to already geometrically overlap the Signal Monitor panel
(`.audio-profiler`, fixed bottom-right) at the app's standard ~846px-wide test viewport. This
overlap existed before Step 13 too (the column was just an empty spacer, so it was invisible);
it became a real visual bug the moment a real button with real content landed there.
`.audio-profiler`'s width was reduced 220px → 168px (and its row's `grid-template-columns`
tightened to match) specifically to clear the cabinet's right edge at that viewport width — see
the gotcha below if this regresses.

---

## Brushed aluminum material (Step 14)

Spin (`.spin-btn`), Powerbet (`.powerbet-toggle`), and the Fast/Slow toggle's thumb
(`.fast-toggle__thumb`) now share one physical-hardware material — "brushed anodized aluminum" —
instead of each having its own ad hoc styling (Spin's old glossy radial-gradient "candy button"
look, Powerbet's flat single-color panel, Fast's flat circle thumb). The goal was heavy cast/
machined metal, explicitly *not* plastic.

**The technique, identical across all three (just re-scaled per control):**
```css
background:
  repeating-linear-gradient(95deg, rgba(255,255,255,X) 0px, rgba(255,255,255,X) 1px,
    rgba(0,0,0,X) 1px, rgba(0,0,0,X) 2px),   /* brush-stroke texture, ~1-2px stripes */
  linear-gradient(160-165deg, <light> 0%, <mid> ~35-50%, <dark> ~70%, <shadow> 100%);
                                              /* directional metallic sheen, lit from
                                                 upper-left, cast toward lower-right */
box-shadow:
  0 Npx 0 <shadow-color>,                    /* solid "thickness" — the button's own
                                                 physical depth, not a blur */
  0 Mpx Xpx rgba(0,0,0,0.5),                 /* soft ambient lift off the panel behind it */
  inset 0 1-2px 1px rgba(255,255,255,0.3-0.8),  /* top bevel highlight */
  inset 0 -2 to -4px 4-8px rgba(0,0,0,0.35-0.45); /* bottom bevel shadow */
```
Two independent palettes reuse this same structure: `--metal-hi/light/mid/dark/shadow` (neutral
silver — `:root`, Step 14) for Powerbet and the Fast toggle; gold stops built from
`--cabinet-accent` (`#fdeeb0 → #e8c766 → --cabinet-accent → #a67f1b → #7a5e12`) for Spin, so it
stays the visually dominant control through size (108px) and shadow weight, not by being a
different material — "same DNA, different scale," per the brief.

**The `:active` "physical depress" pattern — the part that actually sells the mechanical feel:**
the solid `0 Npx 0 <shadow-color>` shadow layer is shrunk in lockstep with the `translateY()`
(e.g. Spin: `translateY(6px)` pairs with `0 8px 0` → `0 2px 0`), so the button visually sinks into
its own socket by exactly the distance it moved, instead of just translating while a shadow stays
put underneath it (which reads as the button floating, not pressing). The soft ambient shadow's
blur/spread shrinks too, and the top bevel highlight dims slightly (light has less of an edge to
catch once the button is recessed). Fast's thumb gets the same treatment scaled down (its own
mini shadow flattens on `:active`) in addition to the existing whole-track `scale(0.96)`.

**Powerbet's armed state (`.powerbet-toggle--active`, pulsing `--powerbet-accent` glow) keeps the
full metal shadow stack present in *every* keyframe of `@keyframes powerbet-toggle-pulse`** — only
the outer glow ring's spread animates (`0 0 0 0` ↔ `0 0 0 8px`), layered on top of, never
replacing, the base material's shadows. The first version of this (Step 13) used a keyframe that
only declared the glow ring, which would have gone through the base `box-shadow` property and
wiped out the metal shadows for half of every pulse cycle the moment Step 14's real shadow stack
landed — worth remembering if any other pulsing/glowing state ever gets added to a metal control:
**animated `box-shadow` keyframes must restate every layer that should stay visible, not just the
one that's actually animating.**

Fast's track (`.fast-toggle__track`) is deliberately *not* part of the raised-metal family — it's
styled as a recessed groove (`inset` shadow only, dark gradient) that the aluminum thumb slides
inside, giving the kickplate a mix of raised (Spin, Powerbet, the thumb) and recessed (the track
itself) elements, same as a real hardware panel would have.

`.big-win-collect-btn` still uses the old pre-Step-14 gold radial-gradient styling — out of scope
for this pass (the brief named Spin/Powerbet/Fast-Slow specifically), so it now looks visually
inconsistent with `.spin-btn` if you look closely. Worth unifying in a future pass, not done here.

---

## Title relocation & theme select → dock (Step 15)

**What changed:** `<header class="topbar">` — the last surviving piece of the pre-Step-10 header
concept — is gone from `index.html` entirely, along with all its CSS (`.topbar`, `.topbar__title`,
`.topbar__theme*`, and the `@media (max-width: 480px)` wrap rule described in "Visual system &
layout (Step 10)" above). Two things it used to hold moved to new homes:
- **The title** is now `<h1 class="cabinet__title">OCTAVE&nbsp;SPIN&nbsp;FORGE</h1>`, the first
  child of `.cabinet__frame`, centered above `.cabinet__glass` (the reels). It's inside the
  cabinet panel now, not a separate panel of its own above it.
- **The theme `<select>`** moved into `#audio-dock` as `.audio-dock__theme`, on its own row below
  Master Mute and the music fader, preceded by a visible `THEME:` text label
  (`.audio-dock__theme-label`, monospace, same uppercase/letter-spaced treatment as
  `.win-counter__label`) rather than an icon — a follow-up refinement after the first pass put it
  inline as a third icon-only pill; the label needed more horizontal room than that shape gave it.
  Nothing about its JS wiring changed either time: it's still `#theme-select`, still populated by
  `populateThemeSelect()` and driven by `wireThemeSelect()` in `main.js`, both of which look it up
  by id, not by DOM position.

**Why this is safe:** every piece of JS that touches these two elements does so by `id`
(`#theme-select`) or by creating the title fresh — nothing in `main.js` queried `.topbar` or a
child selector scoped to it, so moving both elements required zero JS changes, confirmed by
`grep`.

**`#audio-dock` is now a 2-row column** (`display: flex; flex-direction: column`), not a single
row: `.audio-dock__row` wraps Master Mute + the fader as row 1, `.audio-dock__theme` is row 2.
This replaced an earlier single-row `flex-wrap: wrap` attempt that looked right on wide desktop
viewports but broke on mobile — worth understanding why, since it's a real flexbox trap:

**The `flex-wrap` trap (found and fixed in this same step):** with all 3 controls as direct
children of a single wrapping flex row, `.audio-dock`'s own shrink-to-fit width was computed as if
*all three sat on one unwrapped line* — a real CSS flexbox intrinsic-sizing rule, not a bug in this
code — even though the theme control (with its longer label + wider select) was actually wrapping
onto its own line beneath the other two. The container ended up as wide as "mute + fader + theme"
side by side, with the wrapped theme row then centered inside all that leftover horizontal space.
At the ~846px desktop test width there was enough clearance that this went unnoticed; at 375px
mobile the resulting ~350px-wide dock genuinely overlapped `.audio-profiler` (bottom-right, ~30px
of real intersection measured via `getBoundingClientRect()` on both). **Fixed by giving row 1 its
own explicit flex container** (`.audio-dock__row`) and making `.audio-dock` itself
`flex-direction: column` — a column container's shrink-to-fit width is just the widest *row*,
each measured independently, with no cross-row summing quirk to trigger. If another control ever
gets added to this dock, keep it inside a `.audio-dock__row` (new or existing) rather than adding
a 4th direct child expecting a wrapping row to lay it out — this exact trap will resurface
otherwise.

**`.audio-dock__theme-select` still truncates long labels** — `max-width: 140px` normally, dropped
to `70px` under a `@media (max-width: 600px)` rule (matching the breakpoint gotcha #10 already
uses) so the now-narrower mobile dock doesn't get pulled wide again by the select alone. Same
`text-overflow: ellipsis; white-space: nowrap; overflow: hidden;` truncation pattern as gotcha #6
— "Vintage Arcade" reads in full on desktop, truncates to "Vintag…" on narrow viewports.

---

## Dev mixer & bus routing (Step 16)

**What this is:** a hidden, undocumented-in-the-UI developer tool for tuning per-theme relative
volumes of groups of sprites ("buses") and exporting the result as JSON to hand-copy into the
project once mixing is finalized. Not a player-facing feature — no button, label, or hint anywhere
in the visible UI points to it.

**Bus routing (`busRouting.js`):** every sprite name in the game maps, by prefix, to exactly one
of 8 buses (was 7 — `busPowerBet` split out from `busWinsBig` per explicit request once a real
Powerbet toggle sound existed to route, China's):

| Bus | Sprites |
|---|---|
| `busReelsNormal` | `reelStart01-05`, `reelStop01-05` |
| `busReelsTurbo` | `reelTurbo01-05` |
| `busMusic` | `musicMain` |
| `busAtmosphere` | `gameAmbLP`, `gameStart` |
| `busWinsSmall` | `winSmall01-04`, `winSmallDigits`, `winSmallDigitsEnd` |
| `busWinsSymbol` | `winSymbol01-04`, `winSymbolWild`, `winSymbolScatter` |
| `busWinsBig` | `winBigRiser`, `winBigRiserEnd`, `winBigT1` |
| `busPowerBet` | `powerBetOn`, `powerBetOff` |

`getBusForSprite(name)` does the prefix match; `BUS_NAMES` is the canonical ordered list both
`ThemeAudio` and `DevMixerPanel` read from — adding a 9th bus is a one-rule addition to
`BUS_RULES`, nothing else needs to change.

**State (`DevMixer.js`):** `themeMixes` is a plain in-memory object, `{ <themeId>: { <busName>:
<multiplier> } }`. Every bus defaults to `1` (no change) until a slider actually touches it —
`getBusVolume()`/`getThemeMix()` fill in that default rather than requiring every bus to be
pre-populated for every theme. Deliberately not persisted (no `localStorage`) — this is a tool for
arriving at numbers to hardcode elsewhere, not a setting a player's session should remember,
matching how Master Mute/the fader position already don't survive a reload either.

**Range is 0-1 (trim/attenuate only, no boost) — this is a hard ceiling, not a UI choice.**
`setBusVolume()` clamps to `[0, 1]` and the mixer panel's sliders cap at `max="1"` to match.
Originally allowed up to 2x (200%) with no clamp; a value above 1 passed to Howler's own
`.volume()` setter is silently ignored (no error, no boosted sound — the sound just keeps
whatever gain it already had), discovered when an exported `busWinsBig: 1.3` for Football
audibly did nothing. If a real boost is ever needed, it has to happen at the source (louder
source audio, or `baseVolume` in `ThemeAudio._play()`), not via a bus multiplier above 1.

**How a bus gain actually reaches Howler (`ThemeAudio.js`):** `_play(name, baseVolume = 1)` is the
one chokepoint nearly every sprite plays through — it multiplies `baseVolume` (1 for plain
one-shots, a dB-derived trim for `winSmall`, see `playSmallWin()`) by `_busGain(name)`
(`devMixer.getBusVolume(this.currentTheme, bus)`) and sets that as the sound's Howler volume the
instant it starts. This is why adding bus support needed no changes at all to `playReelStart`,
`playSymbolWin`, `playBigWinIntro`, `playPowerBetOn/Off`, etc. — they all already funnel through
`_play()`. **`musicMain` and `gameAmbLP` are the two exceptions**, since they're long-running loops
started via direct `this.howl.play()` calls (for their own id-tracking/looping reasons, not via
`_play()`) rather than one-shots — `_musicTargetVolume()` (fader raw value × `MUSIC_VOLUME_TRIM` ×
`busMusic` gain) and `refreshAmbientVolume()`'s equivalent for `gameAmbLP` are the analogous
chokepoints for those two, and both have a public `refresh*Volume()` method the mixer panel calls
right after a relevant slider moves — so, unlike one-shots (which just pick up the new gain next
time they naturally play), music and ambience react to a mid-song slider drag *immediately*.
`refreshBusLive(bus)` is the single entry point `DevMixerPanel` calls for this; it no-ops for the
5 buses with no continuous sound on them.

**Reveal mechanism (`DevMixerPanel.js`):** the Signal Monitor panel (`#audio-profiler`) is
`pointer-events: none` end-to-end (a pure readout, see "Audio profiler" below) — its header
(`#audio-profiler-header`) alone gets `pointer-events: auto` + `cursor: pointer` back specifically
so it can be a click target, without the rest of the panel starting to intercept clicks meant for
whatever's behind it. Reveal is a manual click-counter with a reset timeout
(`TRIPLE_CLICK_WINDOW_MS`, 500ms) — 3 ordinary `click` events within the window toggles the panel
— rather than relying on any browser-native "triple-click" concept, since `dblclick` has no triple
equivalent and a click event's own `detail` count isn't consistently trustworthy for this across
browsers.

**Export Config:** stringifies `devMixer.themeMixes` (`JSON.stringify(..., null, 2)`) and always
writes it into a `<textarea readonly>` (hidden until first export) so the result is visible and
manually copyable no matter what; it also *attempts*
`navigator.clipboard.writeText()` and reports "Copied to clipboard" if that succeeds, falling back
to `.select()`-ing the textarea and reporting "Select + copy below" if the Clipboard API throws
(no permission, insecure context, etc.) — never a dead end either way. **A real click (not a
synthetic/programmatic `.click()`) is required for `writeText()` to succeed** — Chrome doesn't
treat script-triggered clicks as the "trusted user activation" the Clipboard API needs, confirmed
directly while building this: a synthetic click from the console reliably hit the fallback path,
a real click did not error. Worth remembering if a future automated test ever "detects" this as
broken — it may just be testing via a synthetic click.

**Theme-scoping:** the mixer only ever reads/writes the currently active theme's entry
(`themeAudio.currentTheme`) — switching themes while the panel is open re-renders every slider
from that theme's own (independent) stored mix via `refresh()`, called from `main.js` right after
both `themeTransition.enterFromTerminal()` (cold start) and `.swapTo()` (in-game switch) resolve,
so the panel is never stale even if it wasn't open at the moment the switch happened. Verified
live: setting Egypt's `busMusic` to 50%, switching to Football, confirming Football's own
`busMusic` slider read back 100% (its own untouched default, not leaking Egypt's value) and its
actual Howler gain was `0.9` (fader × `MUSIC_VOLUME_TRIM` only) — not `0.45`.

---

## Adding China: variant-count and music-name fallbacks (Step 17)

**Historical note (superseded by Step 19 below):** point 2's `_musicSpriteName()` fallback was
removed and `chinaSounds.json`'s `mainMusic` was corrected to `musicMain` at the source. Point 1's
variant-count fix (`_randomAvailableIndexedName()`) is still current — that one's about *how many*
variants exist, not a naming mismatch, so it was never in question. Kept below as-written for the
reasoning trail; don't treat point 2's fallback as still active.

**The "add a theme" pipeline (see "What's deliberately NOT implemented yet" below) held for
China exactly as documented** — `themes/china.json`, `src/audio/chinaSounds.json` (copied
byte-for-byte per rule #4), `assets/bg_china.jpg`, one `THEMES` entry, one `THEME_BACKDROPS`
gradient — **but `chinaSounds.json` also exposed two assumptions every earlier bank happened to
satisfy without anyone stating them as requirements.** Both are now handled generically (not
patched for "china" specifically), since a 6th theme is just as likely to repeat either.

**1. Fewer indexed sprite variants than every earlier bank.** egypt/mexico/arcade/football all
provide exactly 5 `reelStart`, 5 `reelStop`, 5 `reelTurbo`, and 4 `winSmall` variants — nowhere
written down as a rule, just true of every bank so far, and `ThemeAudio.js` used to hardcode
those counts directly (`randomIndexedName(prefix, count)`, picking a random index 1..count with
no check the sprite actually existed). `chinaSounds.json` only defines 3 `reelStart`, 3
`reelTurbo`, and 3 `winSmall` variants (still the full 5 `reelStop`) — a random pick against the
old hardcoded counts would, for China, sometimes call Howler with a sprite name (`reelStart04`,
`winSmall04`, ...) the active bank never declared. Fixed by replacing the hardcoded-count
function with `_randomAvailableIndexedName(prefix)`, which filters `this._spriteNames` for
`^<prefix>\d+$` and picks among only what's actually there — `playReelStart/Stop/Turbo` and
`playSmallWin` all switched to it. Verified both directions: spied on `howl.play()` across 200
calls each on China (only ever saw `01`-`03`) and on Egypt (still the full `01`-`05`/`01`-`04`,
confirming no regression for banks with the "normal" counts).

**2. `mainMusic` instead of `musicMain` (originally).** `chinaSounds.json` as first provided named
its main loop sprite `mainMusic` (words reversed) instead of every earlier bank's `musicMain`.
`_playMusicLoop()` used to hardcode `"musicMain"` directly, so this would have silently played no
music at all for China. Fixed generically first — `_musicSpriteName()` prefers `musicMain`, falls
back to `mainMusic`, returns `null` (no music) if a bank defines neither, same dynamic-fallback
shape as `playSymbolWin()`'s Scatter/symbol04 handling above — and `busRouting.js`'s `busMusic`
rule was widened to match either name too. Verified live at the time: China's Signal Monitor
showed the loop playing under the `mainMusic` label, at the correct combined gain.
**Confirmed as a one-off authoring mistake, not an intentional variant, and corrected directly at
the source** — both `src/audio/chinaSounds.json` (this project's byte-for-byte copy, normally
never hand-edited per rule #4) and the original file in the Drive sync folder now say
`musicMain`, so China no longer exercises the `mainMusic` fallback branch at all. **The fallback
code itself was deliberately left in place, not reverted** — it's zero-cost when unused and
exists specifically so the same mistake in some future bank is handled automatically rather than
needing this same investigation again.

**3. `winSmallDigits` / `winSmallDigitsEnd` — a new sprite pair, generalized immediately rather
than special-cased.** China is the first bank to define these: `winSmallDigits` is meant to run
under the small-win counter's roll-up (`WinCounter.rollUp()`), `winSmallDigitsEnd` is a one-shot
completion sting the instant the roll-up settles. Wired as the small-win mirror of the existing
big-win riser/riserEnd pattern, at the exact same chokepoints (`audioHooks.js`'s
`startWinRollup(type)`/`stopWinRollup(type)`, which `WinCounter.rollUp()` already called for
`type === "big"`): `type === "small"` now calls `themeAudio.playSmallWinDigits()` /
`.stopSmallWinDigits()` too. `playSmallWinDigits()` loops the sprite (guarded by
`_spriteNames.has("winSmallDigits")`, same shape as the Powerbet guards below — no-ops quietly on
every bank that doesn't define it yet); `stopSmallWinDigits()` stops it and fires
`winSmallDigitsEnd` from the stopped sound's own `"stop"` callback (guarded the same way),
mirroring exactly how `stopBigWinRiser()` chains into `winBigRiserEnd`. Both route through
`busWinsSmall` automatically — no `busRouting.js` change needed, since the existing `winSmall`
prefix rule already covers them. Verified live: spied on `howl.play()` through a real small win —
`winSmall03`/`winSymbol01` (the existing win layers) fired first, then `winSmallDigits` started,
then `winSmallDigitsEnd` fired exactly when the counter's roll-up settled.

**4. Powerbet playback needed zero changes; its bus did.** China is also the first bank to define
`powerBetOn`/`powerBetOff` — `ThemeAudio.playPowerBetOn/Off()` already guarded on
`_spriteNames.has(...)` specifically so playback would become live automatically the moment any
bank defined them (see "Powerbet (Step 13)" above). Verified live: toggling Powerbet on then off
on China correctly played `powerBetOn` then `powerBetOff` with no code touched. **Its dev-mixer
bus was a separate story:** `powerBetOn`/`powerBetOff` originally shared `busWinsBig` with the
Grand Win climax sprites (nothing to route before China, so it was an arbitrary choice at the
time) — split into its own `busPowerBet` once real Powerbet audio existed to actually route,
since the toggle's on/off cue is conceptually a distinct player-facing control sound, not part of
the win climax. `busWinsBig` now covers only `winBigRiser`/`winBigRiserEnd`/`winBigT1`.

---

## Adding Neon Drive: a second reordered-name case (Step 18)

**Historical note (superseded by Step 19 below):** the fallback approach described in this whole
section was reverted. `_randomAvailableIndexedName()` is back to single-prefix-only,
`neondriveSounds.json`'s `smallWin01-04` was corrected to `winSmall01-04` at the source, and
`playSmallWin()` no longer passes an array. Kept below as-written for the reasoning trail — it's
*why* Step 19 landed the way it did — not as current behavior.

**Same pipeline as every theme add, plus one more reordered-name mismatch** —
`neondriveSounds.json` names its small-win flavor layer `smallWin01-04` instead of every earlier
bank's `winSmall01-04` (egypt/mexico/arcade/football/china all agree on `winSmall`). Same
mistake-shape as China's `mainMusic`/`musicMain` (Step 17), different sprite family.

**Handled by generalizing the Step 17 fix rather than writing a second one-off fallback.**
`_randomAvailableIndexedName(prefix)` became `_randomAvailableIndexedName(prefixOrPrefixes)`:
still accepts a single prefix string (every existing call site — `reelStart`, `reelStop`,
`reelTurbo` — is unchanged), but now also accepts a priority-ordered array. `playSmallWin()` is
the one call site that uses the array form: `["winSmall", "smallWin"]` — tries `winSmall*` first,
only falls through to `smallWin*` if the bank defines zero sprites matching the first prefix.
`busRouting.js`'s `busWinsSmall` rule was widened the same way (`startsWith("winSmall") ||
startsWith("smallWin")`), so bus-gain routing agrees with playback regardless of which name a
given bank used. **This is deliberately the general mechanism for* any* future reordered-prefix
case, not specific to `winSmall`/`smallWin`** — a third bank reordering some other prefix pair
would extend the same way: pass an array to `_randomAvailableIndexedName()` at its one call site,
widen the matching `busRouting.js` rule to match either spelling.

**Verified both directions, same regression-check shape as Step 17:** spied on `howl.play()`
across 100 calls on Neon Drive — `_randomAvailableIndexedName(["winSmall", "smallWin"])`
consistently resolved to `smallWin01-04` (no `winSmall*` exists in this bank, so the fallback
always engages) — and on Egypt, still consistently resolved to `winSmall01-04` (the primary
prefix has matches, so the fallback is never even consulted). A real small-win spin on Neon Drive
was also verified end-to-end: `smallWin01`/`winSymbol01` both fired correctly as the win layers.
`musicMain` needed no fallback this time — Neon Drive's bank already uses the standard name.
`powerBetOn`/`powerBetOff` again needed zero playback changes, same as China (Step 17) — picked
up automatically by the existing `_spriteNames.has(...)` guard, routed to the now-separate
`busPowerBet` bus with no further change.

---

## Reverting the naming fallbacks: fix JSON at the source instead (Step 19)

**What changed:** both naming-fallback mechanisms built in Steps 17-18 were removed, and the two
JSON files that motivated them were corrected directly instead — same treatment as the original
`mainMusic` → `musicMain` correction from Step 17, just applied consistently now rather than
building code around the second occurrence.

- `_musicSpriteName()` (Step 17) is gone. `_playMusicLoop()` and `_musicTargetVolume()` go back to
  a hardcoded `"musicMain"` literal, guarded by `_spriteNames.has("musicMain")`.
- `_randomAvailableIndexedName()` (Step 18) is back to taking a single prefix string, not a
  priority-ordered array. `playSmallWin()` calls it with just `"winSmall"`.
- `busRouting.js`'s `busMusic` and `busWinsSmall` rules dropped their `mainMusic`/`smallWin`
  alternate-name matches — back to exact/single-prefix matches only.
- `neondriveSounds.json`'s `smallWin01-04` was renamed to `winSmall01-04`, in both this project's
  copy and the original file in the Drive sync folder — the same two-location fix already applied
  to `chinaSounds.json`'s `mainMusic` in Step 17.

**Why:** explicit direction after Neon Drive's `smallWin`/`winSmall` mismatch turned out to be the
same category of thing as China's `mainMusic`/`musicMain` — a one-off authoring slip, not an
intentional per-theme convention worth a permanent code branch for. Building fallback logic for
each new naming variant, as Steps 17-18 did, has two real costs: it grows `ThemeAudio.js`'s surface
area indefinitely (a new fallback for every future slip, forever), and it silently papers over a
data-quality problem that's cheaper to fix once at the source than to keep defending against in
code. Fixing the JSON directly keeps `ThemeAudio.js`'s contract simple — *every* bank uses the
standard sprite names, full stop — and surfaces naming inconsistencies where they can actually be
prevented (the audio-authoring pipeline), not just individually patched around forever.

**The rule going forward, stated explicitly:** when a new theme bank's sprite naming looks like a
slight, likely-unintentional variation on the established convention (words reordered, a typo,
etc.), **ask whether to correct it in the source JSON before writing any fallback/dynamic-matching
logic for it.** Don't default to defensive code the way Steps 17-18 did. This doesn't apply to
things that are genuinely optional-by-design (`winSmallDigits`, `powerBetOn/Off` not existing in
every bank, the `winSymbolScatter`/`winSymbol04` legacy rename) — those are real per-bank
differences the code is meant to tolerate, not naming mistakes to correct.

**Verified after reverting:** Neon Drive's small win still plays correctly (`winSmall02` fired on
a live small-win spin, via the plain non-fallback path this time), `busRouting.js` confirmed
`getBusForSprite("smallWin01")` and `getBusForSprite("mainMusic")` both now return `null` (neither
name is routed, matching that no bank uses them anymore), and Egypt/China both regression-checked
clean.

---

## Refreshing egyptSounds.json (Step 20)

`egyptSounds.json`/`.mp3` were re-copied from the source (byte-for-byte per rule #4, both the
project's copy and the original file in the Drive sync folder). Two things changed:

**Egypt caught up to the modern convention.** It now defines `powerBetOn`/`powerBetOff` (China/
Neon Drive already did; Mexico/Arcade/Football still don't) and `winSymbol04` directly (previously
Egypt was one of the banks still on the legacy `winSymbolScatter` name — see "Scatter removal
(Step 11)"). No code changes needed either way; both are picked up automatically by the existing
`_spriteNames.has(...)` guards, exactly as designed.

**The new file also briefly had 4 big-win-intro takes instead of 1** — `playBigWinIntro()` plays a
single one-shot, `winBigT1`, the instant the Grand Win overlay appears. The refreshed JSON arrived
with `winBigT1`, `winBigT12`, `winBigT2`, and `winBigT4` all present, numbered irregularly (not a
clean `01`-`04` pattern like every other multi-variant sprite family in this project). **This was
not treated as "another variant-count case for `_randomAvailableIndexedName()`"** — unlike
`winSmall01-04`/`reelStart01-05`/etc., `winBigT*` was never meant to be a random-pick pool; the
irregular numbering itself was a signal something was off, not a naming convention to generalize
for. Asked the user directly rather than guessing (per the Step 19 policy) — answer: keep only the
`winBigT4` take, rename it to `winBigT1`, delete the other three entries. Done directly in the
JSON (both copies, same as the `mainMusic`/`smallWin` fixes) — `ThemeAudio.js`'s
`playBigWinIntro()` needed no code change, since the sprite it already calls (`winBigT1`) just now
points at different audio (start `154s`, the former `winBigT4`'s offset) instead of the original
take. Verified live: `howl._sprite.winBigT1` reports `[154000, 3226]` (matching the kept take's
original offset/duration exactly), and a real forced Grand Win fired `winBigT1` correctly in
sequence (`winSymbol03` → `winBigT1` → `winBigRiser` → `winBigRiserEnd`).

---

## Refreshing arcadeSounds.json (Step 21)

Same source-refresh pattern as Egypt (Step 20), a second naming oversight this time instead of a
new-content ambiguity. Per the Step 19 policy, asked before changing anything rather than fixing
or working around either silently.

- **`mainMusic` instead of `musicMain`.** The exact same mistake-shape China originally had (Step
  17) — not a new fallback, just the same direct-rename treatment: `musicMain` in both the
  project's copy and the original file in the Drive sync folder.
- **`powerbetOn`/`powerbetOff` instead of `powerBetOn`/`powerBetOff`.** A naming variant not seen
  before — lowercase "b" in "bet" rather than a word-order swap. Same treatment: renamed to the
  capitalized form the code actually checks for (`_spriteNames.has("powerBetOn")` etc.), in both
  file locations.

No `ThemeAudio.js` or `busRouting.js` changes of any kind — both fixes are exact-name corrections
to sprites the code already expects, not new naming *patterns* to account for. Verified live:
Arcade's music plays under `musicMain` (`mainMusic`/lowercase-`powerbet*` confirmed absent from
`_spriteNames`), and a real Powerbet toggle on/off correctly played `powerBetOn` then
`powerBetOff`.

---

## Synchronizing the Big Win counter's settle moment (Step 22)

**Historical note (updated by Step 23 below):** the synchronization mechanism described in this
section — everything firing from one call site — is still exactly how it works. What's *not*
current anymore is the 550ms `CLIMAX_HOLD_MS.big` delay this section describes before that call
site is reached: Step 23 removed it, so all three things below now fire in the same frame the
counter hits its target, not 550ms later. Read this section for *what* fires together and *why*
it's structured as one call site; read Step 23 for *when*.

**What changed:** the exact instant `WinCounter.rollUp()`'s massive-counter roll-up settles (big
wins only), three things now fire from one synchronous block instead of being only loosely
related in time:

1. **Digit punch** — a one-shot CSS animation on the counter digits: scale to 1.8x, flash pure
   white, then settle to gold (`var(--cabinet-accent)`) at scale 1.0. New class
   `.win-counter__value--climax-pulse` / `@keyframes win-counter-climax-pulse` in `styles.css`
   (250ms, `ease-out forwards` — `forwards` fill keeps the settled gold/scale(1) end state applied
   until the class is next removed). Per-keyframe `animation-timing-function` gives the up-swing a
   springy overshoot and the down-swing a sharp "slam" rather than one uniform easing curve for
   the whole thing. The 40%/60% keyframe pair holds the white flash for exactly 50ms of the 250ms
   total. **The peak scale was originally 1.2x, not 1.8x** — bumped in a later fix once real
   testing showed the punch reading as a letdown: the roll-up itself already grows the digits up
   to ~1.55x via `--climax-scale` as the count approaches its target (see below), and the punch
   started from a reset `scale(1)` baseline, so a 1.2x peak was visually *smaller* than what was
   already on screen a frame earlier. 1.8x (which the up-swing's overshoot easing actually carries
   past, to ~1.87x measured live) clears that peak with real margin — the settle reads as the
   biggest moment on screen, not a shrink from the climb. No duration, offset, or easing-curve
   values changed, only the two `scale(1.8)` magnitudes at the 40%/60% keyframe.
2. **Coin fountain emitter cutoff** — `CoinFountain.stopSpawning()` (new method) clears the spawn
   interval only, leaving `activeCoins` and their already-running fall animations completely
   alone. This is a genuinely new method, not a rename: the existing `stop()` (used only for
   outright dismissal — Collect / backdrop click, in `BigWinWidget._dismiss()`) still does the old
   "clear interval + immediately remove every coin" behavior, now implemented as
   `stopSpawning()` + destroying `activeCoins`. Before this step, `BigWinWidget.show()` called the
   destructive `stop()` on the roll-up's natural completion too (via `.then()` on the `rollUp()`
   promise) — coins in flight were being deleted outright the moment the count finished, not left
   to fall. Now `show()` passes `() => this.fountain.stopSpawning()` as `rollUp()`'s new 4th
   argument instead.
3. **`busWinsBig` outro stinger queued** — unchanged mechanism (`stopWinRollup("big")` →
   `ThemeAudio.stopBigWinRiser()`, which registers `winBigRiserEnd` on the riser's own `"stop"`
   event and calls `.stop()` — see "Powerbet" and the sprite-contract table above), just now
   sharing the same call site as the two effects above instead of being the only thing that fired
   there.

**How the sync is actually enforced:** `rollUp(amount, durationMs, type, onClimaxSettle)` gained a
4th parameter, called only for `isBig`. Inside the roll-up's existing `setTimeout` callback (the
one that already called `stopWinRollup(type)` after `CLIMAX_HOLD_MS.big` — 550ms — of hold time
past the counter visually hitting its target), the digit-punch class-add, the `--climax-scale`
reset to `1` (so the pulse's own `scale(1)` end state is what persists, not the roll-up's last
grown value, ~1.55), and `onClimaxSettle()` all run as the first statements in that callback,
immediately followed by the pre-existing `stopWinRollup(type)` call. **Nothing async or
promise-chained** — this is deliberately NOT "resolve the roll-up promise, then `.then()` the
fountain stop," which is what the original code did and is exactly the kind of loose coupling
this task asked to remove. `BigWinWidget.show()` no longer has any `.then()` on `rollUp()` at all
for this purpose.

**`WinCounter.reset()`** now also removes `win-counter__value--climax-pulse` (alongside its
existing `--climax-scale` reset), so the pulse can cleanly re-trigger on a future big win — a
CSS class add is a no-op if the class is already present, so cleanup has to happen somewhere, and
`reset()` (already the canonical "clear all counter visual state" method, called at the start of
every `show()` and on every dismiss) is the natural place, not an `animationend` listener (which
would fire the same instant `forwards` fill starts holding the end state, immediately undoing it).

**Verified live**, by wrapping `ThemeAudio.stopBigWinRiser` and `CoinFountain.prototype.stopSpawning`/
`.stop` directly (not just observing effects) through a real forced Grand Win:
- The digit-punch class-add and `stopBigWinRiser()` (which queues `winBigRiserEnd`) landed in the
  same JS tick — a `MutationObserver` on the digits' `class` attribute logged the change only
  ~0.2ms after the wrapped `stopBigWinRiser` call, and that gap is `MutationObserver`'s own
  microtask delivery lag, not real execution order (the class-add statement runs *before*
  `stopWinRollup()`/`stopBigWinRiser()` in source order, within one synchronous callback).
- After settling: computed `color` was `rgb(212, 175, 55)` (exactly `--cabinet-accent`) and
  computed `transform` was the scale(1) identity matrix — confirms the "slam back to 1.0x, gold"
  end state actually holds, not just the keyframe declaring it.
- `stopSpawning()` fired with **71 active coins** in flight at that exact moment, and — critically
  — `stop()` was *not* called for this path, confirming those 71 coins were left alone rather than
  destroyed. They finished falling and self-removed (via each coin's own pre-existing
  `anim.finished` cleanup, unchanged) on their own over the following ~1.6-2.6s.
- A real small win was checked afterward: the inline counter's value element never gained the
  `--climax-pulse` class, confirming this entire step is scoped to big wins only, as designed —
  `isBig` gates every part of it.

---

## Reworking the Big Win counter's pacing: aggressive climb, zero-latency climax (Step 23)

**The complaint:** the counter was "decelerating too early (dragging between 24k and 25k)" — a
symptom of the old easing curve (`1 - (1-t)^4`, a single continuous ease-out across the *entire*
roll-up). A quartic ease-out reaches ~99%+ of its target well before t=1 and then spends a large
remaining fraction of the total duration crawling through a small remaining fraction of the value
— for a 25,000-point win that meant multiple seconds spent creeping through the last couple
hundred points. Separately, Step 22's `CLIMAX_HOLD_MS.big` (550ms) meant the climax effects
(digit punch, fountain cutoff, outro stinger) didn't fire until half a second *after* the counter
visually stopped moving — a second, compounding kind of lag on top of the dragging itself.

**1. Easing curve — `bigWinEasedProgress(t, amount)` (`WinCounter.js`), big wins only:**
a two-phase curve, not one continuous formula:
- **Climb phase** (first `1 - BIG_WIN_BRAKE_TIME_FRACTION` = 92% of the duration): **linear**,
  not decelerating, up to `brakeStartProgress` — computed per-call as `1 - min(amount * 2%, 1000)
  / amount`, i.e. value progress stops just short of a brake zone that's at most 2% of the target
  *and* never more than 1000 points, whichever is smaller. For a 25,000 win that's the last 500
  points (2%); for a hypothetical 100,000 win it'd cap at the last 1000 points (1%) rather than
  scale up to 2%.
- **Brake phase** (final `BIG_WIN_BRAKE_TIME_FRACTION` = 8% of the duration, currently 640ms of
  an 8s roll-up): a steep `1 - (1-localT)^4` ease-out, but confined to this short window and
  small value slice — reads as a sharp snap-to-stop rather than a long drift, since a high-power
  ease-out is still fast through most of *its own* local range and only really decelerates right
  at the very end of it.
- The two phases meet at exactly `brakeStartProgress` at the boundary (`t = climbTimeEnd`) in
  both formulas, so there's no visible jump at the phase transition — only a change in slope
  (the "sharp brake" itself, which is the intended effect, not a bug).
- Small-win easing (`1 - (1-t)^2`) is untouched — this task was scoped to the Big Win counter
  only, per its own framing.

**2. Zero-latency climax — no more `CLIMAX_HOLD_MS.big`.** The `isBig` branch of `rollUp()`'s
finishing block no longer wraps anything in `setTimeout`: the instant `t` reaches 1 (the frame
the target value is hit), `triggerWinClimax()`, the `--climax-scale` reset, the
`win-counter__value--climax-pulse` class add, `onClimaxSettle()` (fountain `stopSpawning()`), and
`stopWinRollup("big")` (which queues the `busWinsBig` outro via
`ThemeAudio.stopBigWinRiser()`) all run as consecutive statements in that same frame — an early
`return` after them skips the small-win-only `setTimeout` path entirely. `CLIMAX_HOLD_MS` now
only has a `small` key; small wins still hold briefly (200ms) between their own climax cue and
stop hook, unchanged — see "Synchronizing the Big Win counter's settle moment (Step 22)" above
for why that separation is still useful for small wins specifically (it isn't for big wins, whose
climax effects are meant to read as one instantaneous beat, not two).

**Verified live**, sampling the displayed counter value every 100ms through a full real Grand Win
(target 25,000) plus the same direct-instrumentation approach as Step 22:
- The climb from ~20,256 to 24,792 (most of the pre-brake range) advanced at a **flat, linear
  ~3,330/second** rate — no early deceleration, confirming the "aggressive, non-dragging climb"
  fix.
- The brake phase covered 24,792 → 25,000 (208 points) in **~408ms**, versus an estimate for the
  old curve covering a comparable late range (24,798 → 25,000, ~202 points) in **~2,400ms** — the
  old curve was already at 99.19% of target by 70% of elapsed time, then spent the remaining 30%
  crawling the last <1%. Roughly a 6x reduction in how long the "final approach" visibly drags.
- The digit-punch class-add and the wrapped `stopBigWinRiser()` call landed in the same JS tick
  (the ~0.2ms gap between them is `MutationObserver`'s microtask delivery lag, same caveat as
  Step 22) — confirming no `setTimeout` reintroduced a delay.
- A real small win afterward rolled up normally (0 → 50) with no change in behavior, confirming
  the small-win path is untouched.

---

## Real per-theme symbol icons (Step 24)

**Historical note (superseded by Step 26 below):** the concept table a few paragraphs down was
that session's best-effort naming convention, but the user has since provided a different,
more specific one (new icon art per theme, sourced from `assets/new icons/`) — **Step 26's table
is the current canonical convention now, not this one.** Kept below for the reasoning trail (why
some icons were deliberately left unchanged in this pass) and because the SVG plumbing/CSS
mechanism this section describes is still exactly how icons work; only the *concept-per-slot*
table is stale.

**What changed:** symbols went from CSS-shape placeholders (clip-path + flat color + a "01"/"WILD"
text label) to real 2D icon art — 5 hand-authored flat SVG icons per theme (symbol01-04, wild),
one set per theme in `assets/themes/<name>/`, referenced by `themes/<name>.json`'s `symbols` map
(which previously pointed at files that didn't exist — that map is genuinely read now, not
scaffolding). Every icon uses the same slot color (`--symbol-01/02/03/04/wild`) across every
theme — the *shape* is theme-specific, the *color* isn't, so a symbol's role (which slot it is)
stays visually recognizable at a glance even after a theme switch, without needing to relearn 6
different color languages.

**Icon concepts are pinned to explicit SFX-object associations, not freely chosen per theme.**
The user specified exactly which real-world object each symbol slot should depict, per theme —
this table is the source of truth for what each icon *is*; if an icon ever needs redrawing, redraw
it as this thing, not as whatever it currently looks like:

| Theme | symbol01 (blue) | symbol02 (green) | symbol03 (red) | symbol04 (purple) | wild (gold) |
|---|---|---|---|---|---|
| Egypt | hawk/bird god | ankh | gem | hieroglyph tablet | scarab |
| Mexico | piñata | sombrero | guitar | maraca/castanet pair | calavera skull |
| Vintage Arcade | joystick | ghost | coin | D-pad | star burst |
| Football | drum (+ drumsticks) | boot | whistle | trophy/cup | laurel ball |
| China | gong (+ mallet) | tiger/lion face | money pouch | coin stack | gold bar |
| Neon Drive | cocktail/whiskey glass | supercar | cassette tape | retro sun | sparkle star |

A cell whose object coincides with the slot it already had before this pass (Vintage Arcade's
whole set; Football's boot/trophy; Mexico's/China's/Neon Drive's wild; Neon Drive's cassette/retro
sun) was deliberately left as the existing SVG rather than redrawn — "keep it" was an explicit
instruction for some of these (Vintage Arcade especially: none of its 5 icons change "for the
moment"), and for the rest the existing art already matched the newly-specified object, so
redrawing it would only have introduced visual drift for no reason. Egypt and China had the most
churn; everywhere else only 1-2 icons actually changed shape.

**Egypt's symbol02 became the ankh, not scarab.** The first pass put scarab at both symbol02
("any" — meaning keep the pre-existing icon, which happened to already be a scarab) *and* wild
(freshly assigned "scarabei" per spec) — two scarabs on the same reel, differentiated only by
color, was confusing in practice. Swapped symbol02 to the ankh instead — a shape this project
already had fully designed and tested (it was symbol03's icon before the gem replaced it there),
so reusing it here was zero new design risk, not just a convenient placeholder.

**Every theme's wild icon carries a "WILD" text label overlaid on top of the gold icon art**, not
just a plain shape — `<text ... fill="#f2ead3" stroke="#0b0c10" stroke-width="2.2"
paint-order="stroke">WILD</text>`, appended as the *last* element in each `wild.svg` so it always
paints in front of whatever icon art sits beneath it. `paint-order="stroke"` renders the black
outline behind the cream fill (the standard SVG text-outline trick) — that's what keeps "WILD"
legible regardless of how busy or light the icon underneath happens to be at that exact spot,
without needing a separate background/ribbon shape behind the text (a plainer approach than a
banner backing, but sufification enough since the outline alone gives reliable contrast). This is
independent of whether a theme's wild icon's *art* changed in the table above — Egypt's did (new
scarab), the other 5 didn't, but all 6 got the text added.

**A legibility pass followed real user testing — several icons that looked fine in isolation didn't
actually read as their intended object once seen live.** Each fix followed the same underlying
lesson: **a flat icon needs a small number of unambiguous, well-separated primitive shapes — one
intricate hand-drawn silhouette, or two shapes that overlap/blend together, reads as a blob rather
than a specific object at actual reel-tile size, no matter how correct it looks zoomed in.**
- **China's wild** went through *two* redraws. The first (a dragon head built from one long
  meandering `<path>`) rendered as an unrecognizable lumpy blob. The second attempt (an ellipse +
  3 triangles + a circle, composed as a horned creature head) fixed the blob problem but was still
  reported as unclear *what it was supposed to be* — decomposing into simple shapes fixes
  "muddy," it doesn't automatically fix "ambiguous concept." Replaced with an isometric gold bar
  (3 flat polygons: a lighter top face, a gold front face, a darker side face) — an object with an
  unambiguous silhouette even as 3 flat shapes, no organic curves to misread. Its top face was
  first drawn as translucent white (`opacity: 0.5`) intending a lighter-gold highlight, but with no
  gold underneath that specific polygon to blend with, it rendered as flat *gray* against the black
  page background — replaced with a solid pre-computed light-gold hex (`#f0d878`) instead.
  **Translucency for a "lighter tint" effect only works if there's actually something of the target
  color behind it to blend with; on a plain background, use a solid pre-mixed color instead.**
- **China's symbol01** (a pellet-drum-on-a-stick, meant to read as "shaker") rendered as a
  mushroom/spinning-top instead — replaced with a gong + mallet (a large ringed disc plus a
  separate stick-and-ball shape at a distance from it), which reads unambiguously as a percussion
  instrument even though it's technically a different instrument than originally specified.
- **Mexico's symbol03** (guitar) had a body silhouette but nothing marking it as a *stringed
  instrument* specifically — no headstock, no strings, no bridge, just an ambiguous double-lobed
  shape. Added a headstock with 2 tuning-peg dots, a neck, 2 visible strings running the full
  length, and a bridge bar near the base — the diagnostic *details* of a guitar, not just its
  outer contour, are what make it actually read as one.
- **Neon Drive's symbol02** (supercar) had a real bug, not just an ambiguity: the wheel circles
  were drawn at 60% opacity, straddling the car body's bottom edge exactly in half — the halves
  overlapping the green body blended into a dark green, while the halves hanging below it (over
  transparent background) rendered as flat black, so each wheel looked visually split in two.
  Fixed by making the wheels fully opaque. Separately, the whole silhouette was redrawn lower and
  wedge-shaped (sharp low nose, long sloped hood/roofline, small cabin greenhouse, raised rear
  spoiler on its own support) to actually read as a Ferrari/Lamborghini-style profile instead of
  the tall, boxy sedan-like shape it was before.
- **Football's symbol03** (whistle) technically had a blow-hole nub and a grille slot already, but
  the nub was drawn in the *exact same fill color* as the chamber behind it (`#e0574c` on
  `#e0574c`), so it was invisible despite being present in the markup — a shape can be "there" in
  the SVG and still be functionally invisible if it has zero contrast against what's behind it.
  Redrawn with the blow-hole nub poking out *above* the chamber's own silhouette (so it's
  contrasted against the black background instead of the same-color chamber) and a darker, taller,
  higher-opacity grille slot for real contrast.

**`.symbol` split into a container + content, not a single element:**
- `.symbol` is now a plain, invisible flexbox container (`aspect-ratio: 1/1`, `background:
  rgba(255,255,255,0.02)`, `border: 1px solid rgba(255,255,255,0.08)`, centered) — a faint hint of
  a tile frame, not a colored shape. It's also still what `dataset.symbol` lives on and what the
  win-state classes (below) target — nothing about its role as "the symbol element" changed from
  the outside, `ReelController.getPaylineSymbolEl()`/`getVisibleSymbolEls()` still return it
  directly, `SymbolCelebration.celebrate()` still clones it whole.
- Inside it: either a themed `<img class="symbol__icon">` (the normal case now) with `filter:
  drop-shadow(...)` (two stacked shadows — a tight dark one for physical depth, a soft wide one
  for ambient glow) for depth, or — if the active theme has no art for that symbol, or the image
  404s/fails to decode — a `.symbol__fallback` div carrying the *old* CSS-shape rendering
  (`.symbol--01` etc.'s clip-path/color rules moved onto this element, unchanged otherwise) plus
  the text label. This is the same "missing art degrades gracefully" contract Step 9 already
  established for background photos (`ThemeTransition._applyBackdrop`) — not a new pattern, the
  same one applied one layer deeper. `ReelController.js`'s `createFallbackEl()`/`themeIconPath()`
  are the two functions that implement it; an `<img>`'s `onerror` swaps in the fallback element
  in-place (`img.replaceWith(...)`) rather than just logging, so a bad path can never regress a
  tile to a visibly broken image.

**JSON integration:** `themeIconPath(symbolId)` reads `themeManager.currentTheme.symbols[symbolId]`
at the moment each symbol element is created (`createSymbolEl()`, called from both `buildStrip()`
and `setStatic()`) — always the *live* active theme, never cached at construction time. That's
what makes a theme switch's new art show up correctly on the very next spin with zero extra code:
`buildStrip()` already reads fresh on every call.

**The one thing that reading-fresh-on-every-call doesn't cover: symbols already resting on the
reel when a theme switch happens.** Nothing normally rebuilds those — no spin, no `buildStrip()`
call — so without an explicit push they'd silently keep showing the old theme's icons (or the
fallback shape) until the player's *next* spin happened to redraw them. Fixed with
`ReelController.redrawIcons()` (calls `setStatic(this.lastSymbols)` — same currently-resting
symbol ids, freshly re-rendered) and `GameController.refreshSymbolArt()` (calls it on every reel,
skipped entirely while `isSpinning` — a reel mid-animation has no stable "resting" symbols to
redraw, and the next spin will pick up the new art on its own regardless, so there's nothing unsafe
being left un-fixed by skipping). `main.js` wires this to `themeManager`'s existing
`themeconfigloaded` event (`ThemeManager.js`, unchanged) — which fires *during* the fade-to-black,
before the backdrop/audio even start loading — so the icon swap happens fully behind the fade, the
same invisible-swap timing the background photo and theme audio already get. No new event, no new
plumbing between `ThemeTransition` and `GameController` — just one more listener on a signal that
already existed for exactly this "something needs to react to the new theme" purpose.

**The Win State — dormant Wild, two distinct win classes:** Wild carries no idle animation of any
kind — same as before, this was never regressed. `ReelController._applyWinClass(el)` (called from
`highlightPayline()` for small wins and `highlightAll()` for a blackout, replacing what used to be
a bare `el.classList.add("symbol--win")` in both) checks `el.dataset.symbol === "wild"` and applies
exactly one of two mutually-exclusive classes: `.symbol--win` (unchanged — the standard 0.9s gold
pulse) for a base symbol, or `.symbol--wild-win` (new — a faster 0.5s pulse in `--powerbet-accent`
red-orange rather than gold, deliberately reusing Powerbet's existing "this is a distinct
high-energy mode" accent color rather than inventing a third) for a Wild. `clearHighlight()` strips
both classes at the start of every spin, so there's never a stale highlight of either kind carried
into a new spin. Verified via a forced blackout on Wild specifically (Powerbet's round-robin
symbol cycle: `symbol01, symbol02, symbol03, wild, symbol04`, so 4 arm/disarm cycles lands it) —
all 9 visible tiles came back `wildWin: true, win: false`, and a subsequent ordinary `symbol01`
small win came back `win: true, wildWin: false` on the payline, `false/false` everywhere else.

**Both win pulses are capped at exactly 3 flashes, not `infinite`.** The first version left them
looping forever, which read as "stuck/broken" rather than celebratory on any spin where the player
didn't immediately hit Spin again — `clearHighlight()` only ever runs at the *start* of the next
spin, so an infinite pulse had no natural end otherwise. Fixed by changing both
`animation: ... infinite` declarations to `animation: ... 3` (`animation-iteration-count: 3` via the
shorthand) — one iteration is a full off→glow→off cycle, so 3 iterations reads as exactly 3
flashes. `.symbol--wild-win`'s keyframes also had to change alongside this: its `0%, 100%` resting
state used to hold a dim-but-nonzero glow (by design, back when the animation ran forever and never
needed a genuine "off"), so simply capping the iteration count would have left a permanent faint
halo behind once the 3rd flash landed on that keyframe. Its resting state is now fully transparent
(`rgba(255, 92, 61, 0)` on both shadow layers) to match `.symbol--win`'s already-transparent resting
state, so both genuinely go dark when they stop, not just stop animating.

---

## Preparing 3 small-win audio hooks, left inert (Step 25)

**What this is:** 3 audio hooks for small-win moments, fully wired and structurally complete, but
producing no sound yet — none of the sprite names involved exist in any bank's JSON. Each becomes
live automatically the moment the relevant sprite is added, no code changes needed, same
"generalize, don't special-case" shape as every naming/variant fix in Steps 17-21.

**1. `playWinLineDash()` (existing hook, now wired)** — fires when the win-line starts sweeping
across the reels, *before* the small-win celebration's pop/blink effects begin ("the small line
prior to the small win celebration"). Calls `systemAudio.play("smallWinLineTick")` — systemic
(not per-theme), so it's the same sound across every theme. Pitch randomization is automatic:
`SystemAudio.play()` already applies `randomizedPitchRate()` (±1 semitone) to every trigger, so
no new randomization logic was needed here at all — just calling the existing `play()` entry
point gets it for free.

**2. `playSmallWinBlink()` (new hook)** — fires once the small-win celebration (the
`SymbolCelebration` pop/glow overlay) has fully resolved. At that point the payline tiles are
still mid-blink — `.symbol--win`'s 3-iteration pulse (Step 24) is a pure CSS animation running
independently of this JS-level hook, not something this hook needs to fire 3 times to sync with;
it's the audio accent for that phase as a whole, fired once. Also systemic, same shape as #1:
`systemAudio.play("smallWinBlinkTick")`, pitch-randomized automatically. Wired in
`GameController.js` right after `Promise.all([...celebrate(el), winLine.hide()])` resolves, before
`winCounter.rollUp()` starts.

**3. Small-win money counter — theme-priority with systemic fallback.** Unlike #1/#2, this isn't
a single new sprite — it's a *dispatch* decision between two existing shapes:
`ThemeAudio.playSmallWinDigits()`/`stopSmallWinDigits()` (China already has one, see Step 17's
"Adding China" section) and new `SystemAudio.playSmallWinDigits()`/`stopSmallWinDigits()`
(identical sprite names — `winSmallDigits`/`winSmallDigitsEnd` — but in the systemic bank, for
themes with no custom money-counter sound of their own). `audioHooks.js`'s `startWinRollup`/
`stopWinRollup("small")` now call new local `startSmallWinDigits()`/`stopSmallWinDigits()`
wrappers instead of `themeAudio.playSmallWinDigits()` directly: `ThemeAudio.hasSmallWinDigits()`
(new public method, just `this._spriteNames.has("winSmallDigits")`) is checked fresh on every
roll-up — theme wins if it has its own pair, systemic bank is used otherwise. A module-level
`smallWinDigitsUsingSystemFallback` flag (set on start) tells the matching stop call which bank to
stop, so start/stop always agree even if a theme switch happens mid-flow.

**Why the fallback dispatch lives in `audioHooks.js`, not `ThemeAudio`:** `ThemeAudio` is
deliberately theme-scoped and shouldn't need to know `SystemAudio` exists (rule #2's theme/system
separation) — `audioHooks.js` already imports both and is exactly the layer meant to coordinate
across banks (same role it plays for e.g. `playReelStart()`'s `systemAudio.play("uiReelStart")` +
`themeAudio.playReelStart()` pairing).

**Why `SystemAudio.playSmallWinDigits()` bypasses `play()`'s pitch randomization:** the money
counter is a sustained loop, not a one-shot tick — randomizing its pitch per-play would make it
drift out of tune with itself every time it (re)starts, and `ThemeAudio`'s version never
pitch-randomizes anything, so using `play()` here would make the systemic fallback behave
audibly differently from the theme-specific version depending on which one happened to be active.
Both call `this.howl.play(name)` directly instead, matching exactly.

**Verified live**, via direct instrumentation on both `ThemeAudio` and `SystemAudio` instances
through real spins: on China, `hasSmallWinDigits()` → `true` → only `ThemeAudio.playSmallWinDigits`/
`.stopSmallWinDigits` fired, `SystemAudio`'s versions never touched. On Egypt (no custom money
counter), the same check → `false` → only `SystemAudio.playSmallWinDigits`/`.stopSmallWinDigits`
fired instead. `playWinLineDash()`/`playSmallWinBlink()` were confirmed to reach
`systemAudio.play()` on every small win (guarded no-op today, since neither sprite exists) with
zero console errors throughout.

---

## The per-theme symbol icon convention (Step 26)

**This table is the canonical, persistent naming convention for every theme's 5 symbol icons.**
It supersedes the looser keyword guesses Step 24 shipped with (those were inferred from the
placeholder art's shapes, not an actual spec) — treat *this* table as the source of truth for
what each slot is supposed to depict, going forward, not just a changelog entry. If a symbol's
icon is ever replaced again, update this table to match, the same way any other binding
project convention in this file is kept current.

**The 5 slots always use the same fixed color, regardless of theme** (`--symbol-01` etc. in
`css/styles.css`) — only the icon *concept* varies per theme:

| Slot | Color |
|---|---|
| `symbol01` | Blue `#4f8ef7` |
| `symbol02` | Green `#38b26a` |
| `symbol03` | Coral `#e0574c` |
| `symbol04` | Purple `#b06fe0` |
| `wild` | Gold `#d4af37` |

| Theme | symbol01 (blue) | symbol02 (green) | symbol03 (coral) | symbol04 (purple) | wild (gold) |
|---|---|---|---|---|---|
| Egypt | ibis bird / Horus | ankh | pyramid | pharaoh | scarab |
| Mexico | piñata | sombrero | chili pepper | maracas | saloon / drink |
| Vintage Arcade | joystick / retro controller | ghost | rocket | striped sun | bonus star / star badge |
| Football | gloves | vuvuzela | referee whistle | soccer ball | trophy |
| China | panda | dragon head | coins | pagoda | lantern |
| Neon Drive | martini | F1 sports car | cassette | money stack | suitcase |

*(Updated by Step 27: Arcade's symbol03 gap is filled — "rocket", not "diamond" — and Football's
symbol01 changed from "trophy cup" to "gloves", freeing "trophy" to be Wild's plain concept name
rather than "trophy (premium)"; see Step 27 for why, and for the file-naming convention the actual
SVGs now follow — the `assets/themes/<theme>/<slot>.svg` paths this section originally described
no longer exist.)*

**Source and provenance:** the icons themselves came from a folder the user dropped at
`assets/new icons/` — originally 29 raw SVGs (later joined by 2 more, `rocket.svg` and
`gloves.svg`, for Step 27), each a standard game-icons.net export (a black `viewBox="0 0 512 512"`
background square plus the actual icon as a single white path). A one-off Node script (not
checked in — scratchpad-only) strips the black background and recolors each icon's path(s) to its
slot's fixed color per the table above.

**Two filenames needed disambiguation, resolved by reading their actual path data (not
guessing from the name alone), then confirmed live in-browser:**
- `trophy.svg` vs `diamond-trophy.svg` — Football needs a plain "trophy cup" (symbol01) *and* a
  separate "trophy" for Wild. `trophy.svg`'s path is a plain trophy-cup silhouette →
  `symbol01`; `diamond-trophy.svg`'s path is a fancier, diamond-topped trophy → `wild`, the
  higher-tier symbol getting the more premium-looking version of the same object.
- `allied-star.svg` — a circular badge with a star cutout (a "star badge" shape) → Arcade's
  `wild` ("bonus star / star badge"). Not to be confused with `diamond-trophy.svg` above; the two
  aren't related despite both having "diamond" energy in their shapes.

**The original gap (Arcade's `symbol03`, 29 icons for 30 slots) was resolved in Step 27** — the
user provided `rocket.svg` for it directly rather than a diamond/gem icon, so the *concept* for
that slot changed to "rocket" instead of the gap being filled with the originally-requested
"diamond". No slot is missing an icon as of Step 27.

**Verified live** across all 6 themes via the Browser pane at the time: every icon rendered in
its correct color and location, including both Football trophies (confirmed visually distinct —
plain vs. diamond-topped) before Step 27 replaced the plain one's role with "gloves". See Step 27
for its own live verification of the current state.

---

## Icon file naming convention + WILD text (Step 27)

**1. Two icon concept changes, both by explicit request:**
- **Arcade `symbol03`: "diamond" → "rocket".** The one gap Step 26 left open (no diamond/gem
  icon was among the original 29) — rather than wait for a diamond icon, the user supplied
  `rocket.svg` and changed the slot's own concept to match. Filled with the same
  strip-background-and-recolor treatment as every other icon, coral (`symbol03`'s fixed color).
- **Football `symbol01`: "trophy cup" → "gloves"**, via a new `gloves.svg`. This freed "trophy"
  to be `wild`'s plain concept name (previously written as "trophy (premium)" specifically to
  distinguish it from `symbol01`'s own trophy) — `wild` still uses `diamond-trophy.svg`'s art
  (the fancier, diamond-topped one), unchanged; only `symbol01` actually swapped icons.
  `trophy.svg` (the plain trophy, formerly `symbol01`) is now unused — left in
  `assets/new icons/` per the instruction below, not deleted.

**2. Every icon file was renamed to an explicit convention: `<theme>-<slot>-<color>-<keyword>.svg`**
— e.g. `assets/themes/egypt/egypt-01-blue-horus.svg`, `assets/themes/football/football-wild-gold-trophy.svg`.
`<slot>` is `01`-`04` or `wild` (matching `themes/<id>.json`'s `symbol01`...`symbol04`/`wild` keys
directly); `<color>` is the slot's fixed color name (`blue`/`green`/`coral`/`purple`/`gold`), not
a hex code; `<keyword>` is the concept from the Step 26 table (hyphenated — `chili-pepper`,
`dragon-head`, `star-badge`, etc.). Replaces the old generic `symbol01.svg`/`wild.svg` names,
which carried no information about what the file actually contained.

**Old-named files were deleted, not left alongside the new ones** (`assets/themes/<theme>/`
had exactly 5 files before this step and exactly 5 after — same count, new names, zero
leftovers). This is safe because icon paths are 100% data-driven: `ReelController.js`'s
`themeIconPath()` reads `theme.symbols[symbolId]` from the loaded theme JSON at runtime, never a
hardcoded filename — so every `themes/<id>.json`'s `"symbols"` map was updated to point at the
new paths in the same pass, and nothing in JS needed to change at all.

**3. All 6 `wild` icons gained real "WILD" text**, baked into the SVG as a `<text>` element —
Step 26's fresh icon set was purely the icon art with no text, unlike Step 24's old placeholder
wilds (which all had `WILD` baked in). Positioned near the bottom of the `0 0 512 512` viewBox
(`x="256" y="480"`), bold, cream fill (`#f2ead3`) with a thick dark stroke (`#0b0c10`,
`stroke-width="10"`, `paint-order="stroke"`) for legibility regardless of what's directly behind
it — same visual language Step 24's placeholders used, just scaled up for the new viewBox (the
old convention was tuned for a `0 0 100 100` viewBox) and reproduced as a standalone element
rather than copied per-file, so all 6 are pixel-identical in styling.

**Unused source icons stay in `assets/new icons/`, untouched** — per explicit instruction, only
icons actually mapped to a slot get copied out; anything left over (like the now-orphaned
`trophy.svg`) simply sits there for potential future use, not deleted and not treated as an error.
*(Superseded by Step 28: the user later had the whole folder emptied out — see there — so this
"leftovers accumulate" behavior no longer describes the current state, just the mechanism.)*

**Verified live** across all 6 themes via the Browser pane: Football shows gloves (`symbol01`)
and a gold trophy with clearly legible "WILD" text; Arcade shows the rocket (`symbol03`) and the
star-badge wild, also with legible "WILD" text; all 4 remaining themes' wild icons (scarab,
saloon, lantern, suitcase) confirmed showing "WILD" text correctly too. Zero console errors
throughout.

---

## Adding Gangster: a completely-renamed riser (Step 28)

**Same pipeline as every theme add** (China/Neon Drive/Egypt-refresh/Arcade-refresh, Steps
17-21) — `themes/gangster.json`, `src/audio/gangsterSounds.json` (copied byte-for-byte per rule
#4, after the fixes below), `assets/bg_gangster.jpg` (already present), one `THEMES` entry, one
`THEME_BACKDROPS` gradient (warm charcoal/amber, matching a speakeasy/noir aesthetic), 5 icons
processed through the same strip-background-and-recolor script as Steps 26-27 —
`gangster-01-blue-revolver.svg`, `02-green-poker-hand`, `03-coral-grand-piano`,
`04-purple-explosion` (source file `mine-explosion.svg`, concept name shortened to just
"explosion"), `wild-gold-reload` (source file `reload-gun-barrel.svg`, concept name "reload").

**Two naming issues found, both confirmed with the user before fixing anything (Step 19
policy) — one familiar, one new:**
- **`smallWin01-04` → `winSmall01-04`.** The exact same "words reversed" mistake-shape China and
  Neon Drive already had. No hesitation needed here beyond the standard confirmation — same
  fix, same treatment, both file locations (project copy + Drive source).
- **`startAnimationBigWin`/`startAnimationBigWinEnd` → `winBigRiser`/`winBigRiserEnd`.** A
  materially different case from every prior naming fix — not a reordering or a casing slip, a
  *completely different name* for (very likely) the same role. Circumstantial evidence was
  strong before asking — 15.7s duration (a long buildup, not a one-shot), positioned immediately
  before `winBigT1` in the sprite sequence, exactly where every other bank's `winBigRiser` sits —
  but "very likely" isn't "confirmed," and this is exactly the kind of structural ambiguity Step
  19 exists for: asked directly rather than pattern-matching on circumstantial evidence alone.
  Confirmed correct, fixed the same way (both file locations).

**No `ThemeAudio.js`/`busRouting.js` changes for either fix** — both are exact-name corrections
to sprites the code already expects, same as every prior naming-oversight fix since Step 19.

**Verified live:** `_spriteNames` confirmed `winBigRiser`/`winBigRiserEnd`/`winSmall01`/
`powerBetOn` all present, `smallWin01`/`startAnimationBigWin` both absent. A real forced Grand
Win fired the sequence `winSymbol01 → winBigT1 → winBigRiser → winBigRiserEnd` correctly; a real
small win fired `winSmall02` (the renamed sprite) correctly. Icons confirmed rendering with
correct colors and legible "WILD" text on the reload icon. Egypt spot-checked afterward for
regressions — clean. Zero console errors throughout.

**`assets/new icons/`'s 5 consumed source files (`revolver.svg`, `poker-hand.svg`,
`grand-piano.svg`, `mine-explosion.svg`, `reload-gun-barrel.svg`) were deleted after conversion**,
keeping the folder down to just whatever hasn't been used yet (currently nothing — see the
`.gitkeep`-only state from the prior session) — consuming an icon out of this folder means
removing it from here, not leaving a copy behind.

---

## Super Bet rename + dual sprite names, and Space-to-spin (Step 29)

**1. Powerbet → "Super Bet" (player-facing label only).** `index.html`'s toggle button's visible
text, `aria-label`, and `title` all changed from "Powerbet" to "Super Bet". Its element id
(`powerbet-toggle-btn`), CSS classes (`.powerbet-toggle`, `.powerbet-toggle--active`,
`.cabinet__frame--powerbet`), the `--powerbet-accent` CSS variable, `main.js`'s
`syncPowerbetUI()`/`powerbetBtn`, and the dev-mixer's `busPowerBet` bus name **were deliberately
left unchanged** — purely internal identifiers with no player-facing meaning, and renaming
`busPowerBet` specifically would have meant also migrating `DevMixer.js`'s already-shipped
`busPowerBet` values for China/Gangster (Steps 17, 28) for zero functional benefit. **No theme
JSON was touched** ("don't change the json so far" was explicit) — every existing bank still uses
`powerBetOn`/`powerBetOff`.

**2. Dual sprite-name support in `ThemeAudio.playPowerBetOn()`/`playPowerBetOff()`:** now check
`superBetOn`/`superBetOff` first, falling back to `powerBetOn`/`powerBetOff` if a bank doesn't
define the new name (none do yet). **This is deliberately a fallback, unlike Step 19's policy
against them** — Step 19 was about *accidental* naming mismatches (a typo, words in the wrong
order) that should be fixed at the source once, not defended against in code forever. This is a
different situation: an intentional, ongoing two-name transition, where old banks legitimately
keep working unmodified while new banks can adopt "superBet" whenever they're ready — exactly the
"genuinely optional-by-design, not a naming mistake" carve-out Step 19's own policy already names
(same category as `winSmallDigits` or `powerBetOn/Off` themselves being absent from most banks).
`busRouting.js`'s `busPowerBet` rule was widened to also match `superBet*`, so a future
`superBetOn`/`superBetOff` sprite routes to the same bus automatically.

**Verified live** (after correctly cache-busting `main.js`/`ThemeAudio.js`/`audioHooks.js`/
`busRouting.js` this time — an earlier verification pass hit exactly the stale-nested-import gotcha
this file already warns about, produced a false "nothing played" result, and was redone properly):
toggling the button on Egypt (which only has `powerBetOn`/`powerBetOff`, not the new names)
correctly played `powerBetOn` then `powerBetOff` — confirming the fallback engages correctly.

**3. Space triggers a spin from anywhere on the page.** New `wireSpinKeyboardShortcut()` in
`main.js`, called at the very end of `init()` — deliberately not from `wireGame()`, which runs
*before* the welcome screen/startup terminal are dismissed. A native click on the Spin button
during that phase would be blocked by whichever overlay is visually on top, but a document-level
keydown listener has no such protection — attaching it early would let Space attempt a spin
before a theme is even chosen. Wiring it only once `game.refreshLayout()` (the last line of
`init()`) has already run guarantees the cabinet is actually playable first.

**Revised almost immediately: Space is an exclusive Spin shortcut, not "activate whatever's
focused."** The first version deferred to native behavior whenever `document.activeElement` was
an `INPUT`/`SELECT`/`BUTTON`/`TEXTAREA` — reported back as a real bug the same day: after clicking
Fast or Super Bet with the mouse, focus stays on that control (normal browser behavior), so a
*later* Space re-toggled *that* control instead of spinning, since the old guard was deliberately
stepping aside for it. The fix removed the guard entirely — `event.preventDefault()` is now called
unconditionally, before any native per-control Space handling gets a chance to run, so nothing
else can ever intercept it. The listener is otherwise unchanged: `spinBtn.click()` — reusing the
exact same click handler already wired in `wireGame()`, not duplicating any spin-triggering logic
— guarded only by `!spinBtn.disabled`.

**Verified live:** confirmed inert on the welcome screen and the startup terminal (both dispatched
`keydown` events before the game was ready — used a real `KeyboardEvent` dispatch rather than the
Browser pane's own key-simulation action, which was found not to produce an event with
`code === "Space"` reaching `document` in this tool — a testing-tool quirk, not a bug in the
listener itself, confirmed by the identical dispatch working correctly once the game *was* ready).
Once past the terminal, with the *fixed* version: focused the Fast checkbox, dispatched Space —
`fastToggle.checked` stayed `false` (native toggle suppressed) and the spin fired anyway; same
result focusing the Super Bet button (`aria-pressed` stayed `"false"`) and the theme `<select>`
(`.value` stayed `"egypt"`) — all three confirm Space now reaches Spin and *only* Spin, regardless
of what's focused. Zero console errors throughout.

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
- **All 6 themes now have a real image file on disk at their `bgImagePath`** (`assets/bg_egypt.jpg`,
  `bg_mexico.jpg`, `bg_arcade.jpg`, `bg_football.jpg`, `bg_china.jpg`, `bg_neondrive.jpg` —
  top-level `assets/`, not `assets/themes/<name>/`), so the gradient fallback in normal play is
  currently dead-but-ready code, only exercised if a file goes missing or fails to decode. Adding
  a 7th theme with no image yet is fine and expected to work (falls through cleanly) — just don't
  mistake "gradient showing" for "the feature is broken," check the file actually exists at the
  exact path first.

**There is no "medieval" theme anymore** — it was removed (it was always a placeholder with no
audio asset ever provided). Themes now come from `themeRegistry.js`'s `THEMES` array, which both
the `<select>` and the startup terminal render from — see below, this also means there's no
longer a "first option" footgun, since nothing loads audio automatically on page load at all.

---

## Welcome screen (Step 12) & the audio-gate chain

There are now *two* full-screen gates stacked on load, not one: the welcome screen
(`#welcome-screen`, `z-index: 400`) sits **above** the startup terminal (`z-index: 300`), which
sits above everything else. Both are fully rendered/wired in the DOM from the start — nothing
about the terminal's own setup changed for this. The welcome screen simply covers it a moment
longer, then gets removed to reveal it. Order in `main.js`'s `init()`:

1. Everything gets set up as before (audio profiler, theme select populated, game wired, terminal
   rendered + its rows wired with `wireGlobalUISfx(startupTerminal.listEl)`) — all of it already
   interactive underneath, just visually and pointer-blocked by the welcome screen on top.
2. `await welcomeScreen.waitForStart()` — blocks until "Initialize Engine" is clicked.
3. `unlockAudioContext()` (`audioUtils.js`) — explicitly resumes `Howler.ctx` if it's suspended.
   This is normally redundant (Howler already auto-unlocks on its own first-gesture listeners,
   which is exactly what let the terminal act as the "first gesture" before this step existed) —
   but the whole point of this screen is to *be* that first gesture as early and deliberately as
   possible, not to depend on whichever click happens to land first.
4. `systemAudio.play("uiClick")` — the handoff sound, fired explicitly here rather than through
   the generic `data-sfx-click` pattern (the welcome screen's button deliberately doesn't carry
   `data-sfx-hover`/`data-sfx-click` — this exact single click is a scripted step, not a generic
   UI interaction, and double-wiring it would risk playing `uiClick` twice for one press).
5. `await welcomeScreen.dismiss()` — fades (`.welcome-screen--fading`, CSS opacity transition,
   `transitionend`-driven like every other fade in this app) then removes itself from the DOM
   permanently, same pattern as `StartupTerminal.dismiss()`.
6. Only then does `await startupTerminal.waitForSelection()` get awaited — though since the
   terminal was blocked purely by z-index/paint-order (not by JS setup order), it was already
   silently "waiting" underneath the whole time; this is just where the code catches up to what
   the player can now actually see and click.

**Why this exists at all:** before Step 12, the startup terminal itself was the page's first
gesture gate — fine for unlocking *theme* audio (that's what it was built for), but its own
`uiHover`/`uiClick` sfx (added later, see the gotcha about the focus-mute layer silencing early
hover) were only reliably audible *after* whatever interaction happened to be the actual first
click. The welcome screen makes "the first click" a single, explicit, unmissable step instead of
an implicit side effect of whatever the player happens to do first.

**If this ever needs a 3rd stacked gate**, follow the same shape: render+wire it fully, give it
the next z-index up, block on its own `waitForX()` before proceeding, and make sure whatever's
underneath is already fully set up so nothing needs to wait on *that* setup once revealed.

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
Enter/Space-selects) a row in the terminal. (As of Step 12, the terminal's click is no longer the
page's *literal* first gesture — the welcome screen's "Initialize Engine" click, stacked above it,
is — see "Welcome screen (Step 12)" above. The terminal's click is still what gates *thematic*
audio specifically, which is what this section is actually about.)
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

`#theme-select` (the in-game dropdown — inside the floating `#audio-dock` as of Step 15, in
`.audio-dock__theme`; see "Title relocation & theme select → dock (Step 15)" above for its full
move history) is populated at runtime from the same `THEMES` registry (`populateThemeSelect()` in
`main.js`) rather than hardcoded `<option>` tags in the HTML — so both the terminal and the
dropdown always agree on what themes exist, from one array.

---

## Global UI audio (`SystemAudio.js`)

One Howl instance for the whole page session (`uiHover`, `uiClick`, `uiReelStart`, plus unused
`uiBet`/`uiMenuOn`/`uiMenuOff`/`uiSlider`), wired generically in `main.js` via
`[data-sfx-hover]`/`[data-sfx-click]` attributes — any element with those attributes
automatically gets the sound, no per-element wiring needed. Whole bank plays at -3dB
(`SYSTEM_VOLUME_DB`). Every trigger gets a randomized playback rate between 0.94-1.06
(`randomizedPitchRate()`, ±1 semitone) so repeated clicks don't sound robotically identical.

**As of Step 25, `SystemAudio` tracks `_spriteNames`** (same purpose as `ThemeAudio`'s own set) —
`play(name)` no-ops quietly if `name` isn't in `systemSounds.json`, the same guarded shape
`ThemeAudio` has always used, letting a hook be wired up before its sprite exists (see Step 25).
`SystemAudio` also gained `playSmallWinDigits()`/`stopSmallWinDigits()` — a systemic fallback for
the small-win money counter, deliberately bypassing `play()`'s pitch randomization (calls
`this.howl.play()` directly) since the money-counter loop isn't meant to be pitch-varied, matching
`ThemeAudio`'s equivalent (which never randomizes pitch at all).

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
persisted anywhere, and none of the ids/JS wiring changed, only where they sit in the DOM). The
dock gained a second row, the theme select, in Step 15 — see "Title relocation & theme select →
dock (Step 15)" above:
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
oversight) made when this was scoped out with the user before implementation. (Superseded for
Spin by Step 14's brushed-aluminum pass, below — Spin's radial gradient became a directional
metallic one, though the "stay dimensional against the flatter frame" reasoning still holds.
`.big-win-collect-btn` is the one place that old radial-gradient treatment still lives.)

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
10. **The two `position: fixed`, viewport-anchored corner panels (`.audio-dock` bottom-left,
    `.audio-profiler` "Signal Monitor" bottom-right) can silently overlap real cabinet content**
    (as of Step 15, `.audio-dock` is a 2-row column — Master Mute + fader on row 1, the theme
    select on row 2 — sized to its widest row, ~167px at mobile widths, comfortably clear of
    `.audio-profiler`; an earlier same-step attempt at a single wrapping row measured ~350px wide
    on mobile and did overlap, see "Title relocation & theme select → dock (Step 15)" above for
    why a wrapping flex row is the wrong tool for this and what replaced it)
    — neither panel's position accounts for `.app`'s or `.cabinet__frame`'s actual edges in any
    way (they're anchored to the *viewport*). Two distinct instances of this hit in practice:
    - **Desktop/horizontal** (~846px test viewport): `.app`'s 480px max-width plus both panels'
      own widths didn't leave much slack — invisible for a long time because nothing was ever
      placed in the kickplate's bottom-right corner besides an empty spacer, until Step 13's
      Powerbet toggle landed there. Fixed by narrowing `.audio-profiler` from 220px to 168px
      (see "Powerbet (Step 13)").
    - **Mobile/vertical** (375x812 tested): `.app` is close to full-width there, so both docks
      span nearly the cabinet's whole width — and `body`'s `align-items: safe center` vertical
      centering has no awareness of either dock's height, so with enough spare vertical room it
      centered `.app` far enough down that `.cabinet__frame`'s bottom edge and `.audio-profiler`'s
      top edge genuinely overlapped (~12px measured), not just a near-miss. Fixed with a
      `@media (max-width: 600px)` rule adding `padding-bottom: 96px` to `body` — this shrinks the
      box flexbox centers `.app` *within*, shifting the whole app up and out of the docks' reach,
      cheaper and more robust than computing either dock's exact height/position from JS. Verified
      clear at 375px (mobile) and 768px (tablet, above the breakpoint, relies on natural spacing
      instead — also verified clear); 96px covers both docks' typical steady-state height (a
      couple of active channels in the profiler) with margin, not their absolute worst case
      (`.audio-profiler`'s `max-height: 260px` if many channels were active at once, which is
      transient, not the steady state this was tuned against).
    - **`100vh` vs `100dvh` — a real-device gap this project's testing can't catch.** `body`'s
      centering used plain `min-height: 100vh`, which on real mobile Safari/Chrome is pinned to
      the *largest* possible viewport (browser chrome fully collapsed), not whatever's actually
      visible (usually smaller, since that chrome starts out shown). The Browser-pane tool's
      mobile emulation is a fixed-size viewport with no collapsing chrome to diverge from, so
      this gap is structurally invisible to every mobile test done in this environment — a user
      reported "still overlapping on my actual phone" after the fix above tested clean here,
      which is exactly the symptom this would cause. Fixed by adding `min-height: 100dvh` right
      after the `100vh` line (progressive enhancement — unsupporting browsers just keep the
      `100vh` fallback, since they don't recognize the `dvh` declaration at all). **Any future
      "works in the Browser-pane tool but not on a real phone" mobile report is worth checking
      against this exact gap first** — this tool cannot reproduce or verify real dynamic-viewport
      behavior at all, only fixed-size emulation.

    **If anything else ever gets added near a cabinet edge or corner, measure
    `getBoundingClientRect()` against both fixed panels at multiple viewport sizes before
    assuming it fits** — don't trust that "nothing overlapped before" means nothing will now.
11. **Item 1's stale-cache gotcha applies to binary audio assets too, not just HTML/CSS/JS —
    and it's far more dangerous there because Howler decodes whatever bytes it gets with zero
    validation against the JSON describing them.** Refreshing a theme's bank means updating *two*
    files at once (`src/audio/<theme>Sounds.json` and `assets/23/sounds/<theme>Sounds.mp3`) — it's
    easy to remember to `fetch(jsonPath, {cache:'reload'})` before testing (the JSON's content is
    directly inspectable, so a stale copy is usually obvious) and forget the mp3 (opaque bytes,
    no direct way to eyeball whether it's stale). The result: Howler decodes an *old* mp3 against
    a *new* JSON's sprite offsets — every `[start, duration]` in the fresh JSON now points at
    whatever happens to be at that timestamp in the *wrong* audio file, which can very plausibly
    sound like "the wrong sprite entirely" or "everything scrambled past some point," not just a
    small timing error. This is a silent failure — no console error, no failed fetch, Howler has
    no way to know the buffer doesn't match the sprite map it was given. Caught concretely in
    Football's Step-35-convention refresh: `_musicMainSpriteName` resolved correctly
    (`"musicMain_130"`), the JSON's offsets were correct, and it *still* played wrong content,
    because the browser was serving the mp3 from before that same refresh
    (`fetch()`'s default cache mode returned the 4,129,763-byte original file; the actual new file
    on disk was 5,665,763 bytes). **Always cache-bust *both* files together** —
    `fetch(jsonPath, {cache:'reload'})` **and** `fetch(mp3Path, {cache:'reload'})` — before testing
    any theme-bank refresh, and confirm the fix landed by checking `themeAudio.howl.duration()`
    against the JSON's own last sprite's `start + duration` (should be a close match, typically
    within ~0.5s from trailing encoder padding/silence — a large mismatch means a stale buffer is
    still loaded). **This most likely also explains item 7's unresolved "Mexico/Arcade silent"
    mystery** — a stale-mp3 mismatch wouldn't necessarily present as literal silence, but "some
    sprites play, others don't/sound wrong" is well within what a buffer/offset mismatch produces,
    and item 7's own writeup already listed "the stale-cache gotcha" as a leading suspect before
    this exact mechanism was confirmed.
12. **A long-lived Browser-pane tab can accumulate state/errors unrelated to the current code** —
    don't assume every console error reflects the code as it stands right now. This project's
    Browser-pane tabs have shown at least two distinct ways to accumulate misleading state: real
    clicks landing during a sensitive moment of page load, and item 5's stray-tab spawning. **When
    a fresh code change produces an error that doesn't match anything you just touched, try a brand
    new tab before assuming the code is wrong** — cheap to rule out. **But don't stop there if the
    same symptom is independently reported by the actual user** (see item 13) — a tab artifact and
    a real bug can produce the identical error message, and only one of them goes away on its own.
13. **`TypeError: Cannot read properties of null (reading 'addEventListener')` was, in Step 39,
    a REAL bug, not a tab artifact** — despite superficially matching item 12. Root cause: `index.html`
    gained new `#bet-decrease-btn`/`#bet-selector-value`/`#bet-increase-btn` markup alongside the new
    `wireBetSelector()` in `main.js`; if a browser ever serves a stale cached `index.html` (missing
    that markup) alongside a fresh `main.js` (which unconditionally calls `.addEventListener()` on
    those elements), `wireGame()` throws synchronously. `init()` has no top-level `.catch()`, so the
    whole async function silently aborts — including the `await welcomeScreen.waitForStart()` line
    further down, meaning **the welcome screen's "Initialize Engine" button never gets its click
    listener wired at all**. Symptom on the user's end: "nothing happens when I click Initialize
    Engine," with no visible error unless they specifically open devtools. **Fix applied:**
    `wireBetSelector()` (`js/main.js`) now guards on all three elements being non-null and degrades
    to a no-op `{ lock(){}, unlock(){} }` with a `console.warn` instead of throwing, so a markup/JS
    version mismatch can no longer take down the entire init sequence. **Lesson: any DOM lookup done
    inside `init()`'s synchronous path, before `welcomeScreen.waitForStart()` is awaited, is a single
    point of failure for the whole app** — prefer guarding new lookups there, or wrap `init()` itself
    in a `.catch()` that at least logs, rather than assuming a `getElementById` will always succeed
    just because the current on-disk HTML matches. **Recurred again later, confirmed as pure cache
    this time**: after further markup/JS churn (the bet-selector pill rework, the Fast-toggle
    checkbox→button rework), the user hit "Initialize Engine does nothing" a second time. A fresh
    tab reproduced nothing (worked first try, zero console errors) and a full DOM/id cross-check
    found no mismatch — but the user then confirmed it independently by loading the page in an
    **Incognito window, where it worked immediately**. Incognito has no disk cache to begin with, so
    this is about as clean a confirmation as this gotcha gets: **when this symptom recurs, checking
    in Incognito first is faster and more conclusive than re-auditing the DOM** — a clean load there
    means the code is fine and it's purely a stale-cache artifact on the regular profile.
    `init()` still has no top-level `.catch()` as of this writing — the underlying single-point-of-
    failure risk described above is unchanged, just not what fired this particular time.

---

## What's deliberately NOT implemented yet

- Several `audioHooks.js` functions remain pure `console.log` placeholders with no real sound
  wired in yet: `playWinStinger`, `playSymbolPulse`, `triggerWinClimax`, `playTransitionWhoosh`
  (no whoosh-in sprite exists in `systemSounds.json` yet — Step 39 added its outro counterpart,
  `playTransitionOutro()`, but not this one). `playWinLineDash()`/`playSmallWinBlink()` are no
  longer on this list as of Step 39 (`uiDash`/`uiPulse`). Check `audioHooks.js` directly for the
  current authoritative list — it changes as more sound design lands.
- 6 themes exist (Egypt, Mexico, Vintage Arcade — `id: "arcade"` — Football, China, and Neon
  Drive). The system generalizes cleanly to dozens more: drop a new `<theme>Sounds.json`/`.mp3` at
  the established paths, add a `themes/<name>.json` stub, add one `{ id, label }` entry to
  `THEMES` in `themeRegistry.js` (this alone updates both the startup terminal's list and the
  in-game dropdown), and add a `THEME_BACKDROPS[themeName]` gradient in `ThemeTransition.js`
  (falls back to the default dark gradient if omitted). Football (added post-Step-10) is the
  cleanest proof of the *no-code-change* case: zero code beyond the registry entry and the
  fallback gradient. China (Step 17) and Neon Drive (Step 18) both needed real code changes, but
  only because their banks broke previously-unstated naming/count assumptions (fewer indexed
  sprite variants, `mainMusic`/`musicMain` and `winSmall`/`smallWin` reordering) — every fix is
  generic, not theme-specific, so a 7th theme repeating any of them should now need zero code
  changes. See "Adding China" (Step 17) and "Adding Neon Drive" (Step 18) above.
- The win-line dash (small win) is a single horizontal line; a big win's 9-tile blackout has no
  equivalent multi-line dash effect (explicitly deferred — see comment in `GameController.js`).

## Adaptive music: vertical layering (Step 30)

Every theme's Howl instance can now carry a second, fully optional music sprite —
`musicIntense` — alongside the existing `musicMain`. Vertical layering: both are the *same*
underlying loop at two different energy levels, played simultaneously and continuously, with
only their relative volumes crossfading in and out in response to how well the player is
currently doing. No shipped bank defines `musicIntense` yet; the whole system degrades to
exactly today's single-track behavior (`musicIntensityWeight` simply never leaves 0) until one
does. Same "prepare the mechanism, leave it inert until a bank defines the sprite" contract as
`winSmallDigits`/`powerBetOn` before it.

**Phase-locked start.** `ThemeAudio._playMusicLoop()` starts `musicMain` and (if the bank defines
it) `musicIntense` in the same synchronous tick, both looped — `musicIntense` begins truly
playing from the first instant, just silently (`.volume(0, id)`), rather than being started later
on the first small win. Starting it later would not be phase-aligned with wherever `musicMain`'s
loop position already was; starting both together makes them two layers of one loop rather than
two independently-timed loops that merely share a tempo. `musicMain` keeps its existing 2s
fade-in from silence (`MUSIC_FADE_IN_MS`); `musicIntense` has nothing to fade in to yet since its
resting target is 0.

**Trigger: `ThemeAudio.notifySmallWin()`.** Called from `audioHooks.js`'s `playThemeSmallWin()` —
i.e. once per small win, the same "winSmalls" event that already fires the small-win layer and
per-symbol layers. No-ops immediately if the active theme never started a `musicIntense` layer
(`this.musicIntenseId === null`). Otherwise:
- If not already fully crossfaded to intense (`musicIntensityWeight < 1`), starts a crossfade
  toward it (`_crossfadeToIntensity(1)`) — duration is customizable per theme via the Dev Mixer,
  defaulting to 1s (see "Customizable crossfade duration (Step 32)" below).
- (Re)arms a strict 10s cooldown (`SMALL_WIN_INTENSITY_COOLDOWN_MS`, wall-clock `setTimeout`, not
  paused for reel spins or any other animation) that crossfades back down to `musicMain`
  (`_crossfadeToIntensity(0)`) if it ever elapses without a new small win. Each new small win
  resets this back to the full 10s rather than extending an existing countdown — a burst of small
  wins holds the intense layer up for 10s past the *last* one, not 10s stacked per win.

**The crossfade itself (`_crossfadeToIntensity(weight)`).** `weight` is the logical 0-1 position
(0 = `musicMain` fully up, 1 = `musicIntense` fully up), stored on `musicIntensityWeight` so
`refreshMusicVolume()` (below) knows where things settled. The combined fader/trim/busMusic
multiplier (`_musicTargetVolume()` — unchanged computation, now shared by both layers rather than
just `musicMain`) is read once at the moment the crossfade starts; each layer is `Howl.fade()`-ed
from its own *current* actual volume (not an assumed starting point, so a crossfade triggered
mid-fade — a rapid run of small wins — animates smoothly from wherever it actually is rather than
jumping) to `weight * multiplier` / `(1 - weight) * multiplier` respectively, over
`devMixer.getCrossfadeMs(currentTheme)` (see Step 32 — defaults to 1000ms). A
`_musicCrossfadeActive` flag is set for that window and a settle timer calls
`refreshMusicVolume()` again the instant it clears — see below for why.

**Mixer/fader integration — "for free".** `busRouting.js`'s `busMusic` rule now matches
`musicIntense` as well as `musicMain`, so both layers share the exact same Dev-Mixer slider and
music fader; no new bus, no DevMixer/DevMixerPanel changes needed. `refreshMusicVolume()` (called
by both the fader and `refreshBusLive("busMusic")`) now recomputes *both* layers' targets as
`weight * multiplier` / `(1 - weight) * multiplier` using the live `musicIntensityWeight`, so a
mixer or fader change lands correctly whichever side the crossfade is currently settled on — a
track sitting at "100% intense" scales exactly like `musicMain` used to when the mixer moves. The
one deliberate wrinkle: `refreshMusicVolume()` skips re-applying while `_musicCrossfadeActive` is
true, so it doesn't fight Howler's own fade animation mid-flight (re-applying `.volume()` every
tick would visibly stutter the crossfade); the crossfade's own settle timer calls it once more the
moment its window ends, so a mixer/fader change made *during* an active crossfade still lands
correctly, just after that crossfade finishes rather than instantaneously.

**Not touched:** `_duckMusic()`/`_unduckMusic()` (the Big Win riser duck) still only operate on
`musicMain`'s id — if `musicIntense` is active when a Big Win riser starts, it currently keeps
playing unducked. Undefined/unspecified behavior until a real bank exercises this combination;
flagged here rather than guessed at, same spirit as the win-line-dash gap above.

**Verified** by mocking a second real playing sound as a stand-in `musicIntenseId` (no bank
defines a real `musicIntense` sprite yet to test against) via the Browser pane: confirmed the
phase-locked start, the crossfade animating to the correct math-verified targets in both
directions, the strict-reset cooldown, live fader/mixer reactivity at every crossfade weight
(0, 0.5, 1), and a clean teardown/reset (no stray timer errors) on a mid-crossfade theme switch.
Also confirmed a real in-game small win calls `notifySmallWin()` end-to-end with zero console
errors, correctly no-op'ing on every current bank.

## Refreshing arcadeSounds.json with musicIntense (Step 31)

Arcade's bank was refreshed from the sync drive's `arcadeSounds_v01.json`/`.mp3` (both copied
over the standard `src/audio/arcadeSounds.json` / `assets/23/sounds/arcadeSounds.mp3` paths,
replacing the previous Step 21 refresh) — the first bank to actually define `musicIntense`,
specifically so Step 30's vertical-layering system could be exercised end-to-end with real audio
instead of a mocked stand-in layer.

One naming issue, found before touching anything and confirmed with the user first per the Step
19 policy: the new file had `powerbetOn`/`powerbetOff` (lowercase "b"), while every other bank —
including Arcade's own previous version — uses `powerBetOn`/`powerBetOff`. Fixed at the source
(both the Drive original and the project copy), not via fallback logic, consistent with every
prior naming-oversight case in this project.

**Live-verified in the Browser pane** (see Step 30 for the mocked-layer verification this
supersedes): loading Arcade starts both `musicMain` and `musicIntense` simultaneously (confirmed
both playing from the first instant, phase-locked, via the Signal Monitor and direct Howler
inspection) at the correct resting split (musicMain audible, musicIntense silent). A real in-game
small win crossfades to `musicIntense` over 1s, settling exactly at the expected multiplier
(`weight=1`, `musicMain` volume 0, `musicIntense` volume = the full fader/trim/busMusic
multiplier); left alone for the full 10s cooldown, it crossfades back down to `musicMain` just as
cleanly (`weight=0`, back to the original split). Zero console errors throughout.

## Customizable crossfade duration (Step 32)

The musicMain<->musicIntense crossfade duration (Step 30) is now a per-theme Dev Mixer setting
rather than the hardcoded `MUSIC_CROSSFADE_MS` constant it started as. `DevMixer.getCrossfadeMs
(theme)`/`setCrossfadeMs(theme, ms)` store it as `crossfadeMs` inside the same per-theme object
as the bus multipliers (`themeMixes[theme].crossfadeMs`) — not itself a bus (see `busRouting.js`),
just co-located so it rides along automatically with `exportJSON()`/Export Config, the same
bake-into-`DEFAULT_THEME_MIXES` workflow the bus gains already use. Defaults to 1000ms
(`DEFAULT_CROSSFADE_MS`) for any theme that hasn't had it explicitly set. `ThemeAudio.
_crossfadeToIntensity()` reads it fresh (`devMixer.getCrossfadeMs(this.currentTheme)`) at the
start of each crossfade, so a mixer change only affects the *next* transition, never distorts one
already in flight — same "read once per fade, never fought mid-animation" principle Step 30
already established for the fader/bus multiplier itself.

**UI:** a new "Music Crossfade" row in the Dev Mixer panel (`index.html`, `DevMixerPanel.js`),
styled identically to a bus row but rendered as its own fixed row above the BUS_NAMES-driven list
rather than generated from it, since it isn't a bus. Range 0-5s, step 0.5s. Unlike a bus row, there's
nothing continuously playing to live-refresh mid-drag — the value simply takes effect on whichever
crossfade triggers next, so the input handler just stores it and updates the label.

**Verified in the Browser pane** on Arcade (the only bank with a real `musicIntense` layer):
dragging the slider to 3.0s and triggering a small win via `notifySmallWin()`, measured wall-clock
via `performance.now()` polling `_musicCrossfadeActive`, took ~3012ms — matching the slider almost
exactly. Confirmed `crossfadeMs` appears correctly in Export Config's output alongside Arcade's
bus values. Reset to the 1s default afterward. Zero console errors.

## Unifying the theme-transition black-screen hold to 1000ms (Step 33)

The fade-to-black and fade-in themselves (`.fade-overlay`'s CSS `opacity 0.4s` transition) were
always fixed — but the black screen *between* them, while the new theme's config/image/audio load
(`ThemeTransition._transitionTo()`), used to last exactly as long as that load happened to take:
measured (see below) anywhere from ~333ms (a small bank, e.g. Neon Drive) to ~800ms (a larger one,
e.g. Arcade) depending on the theme. `BLACK_HOLD_MIN_MS = 1000` now puts a floor under that gap —
a `setTimeout(1000)` runs *concurrently* with the load work (not after it) via `Promise.all([load
Work, minHold])`, so the fade only lifts once both are done: a fast-loading theme still holds for
the full second instead of flashing back early, and a theme slower than 1000ms (none currently are)
would simply hold for as long as it actually takes — this is a floor, not a hard cap, since lifting
before the load finishes would mean revealing an unready background/audio.

**Measured before/after in the Browser pane** via real theme switches (not simulated), timing each
from the fade-to-black's `transitionstart` to the fade-in's `transitionend`:
- Before: black-hold gap ranged 333–800ms across 7 switches (theme-dependent), total transition
  time averaged ~1339ms.
- After: black-hold gap measured 1033.7–1033.9ms across 6 switches — effectively identical
  regardless of theme (the ~34ms over the nominal 1000ms is normal `setTimeout`/event-loop
  scheduling slack, not theme-dependent). Total transition time is now a consistent ~1801ms for
  every theme. Zero console errors.

## BPM-quantized Big Win entry with a hard duck/curtained-exit restore (Step 34)

A Big Win's entry (the riser starting, the widget appearing) now waits for the next musical
8th-note (half-beat) of the currently-playing `musicMain` before firing, instead of landing
whenever the on-reel celebration animation happens to finish — a deliberate anticipation beat
that also gives the entry a clean, silent moment to duck into. Fully additive to Step 30's
vertical-layering system; the two are designed to interoperate (see "Pausing the intensity
cooldown" below), not to replace each other.

**Dynamic BPM parsing (`audioUtils.js`).** `parseBpmFromPath(path)` — a small regex helper,
`/[_-](\d{2,3})(?=\.[a-z0-9]+$)/i` — pulls a 2-3 digit number immediately before a file's
extension (e.g. `musicMain_124.mp3` -> `124`), falling back to `DEFAULT_BPM` (120) if none is
found. `ThemeAudio.loadTheme()` calls this on `bank.src` (the theme's shared spritesheet path,
e.g. `arcadeSounds.mp3`) and stores the result as `this._bpm`. No shipped bank's filename
currently encodes a BPM — every theme resolves to the 120 default today, same "prepare the
mechanism, inert until the asset supports it" contract as `winSmallDigits`/`musicIntense` before
it; verified directly (`musicMain_124.mp3` -> 124, `musicMain-98.mp3` -> 98, a real bank path ->
120, `null` -> 120) via the Browser pane before wiring it into the timing math.

**The quantization math (`ThemeAudio._msToNextEighth()`).** `Howler.seek(musicId)` gets
`musicMain`'s current playback position in seconds; `msPerEighth = (60000 / bpm) / 2`;
`timeToNext = msPerEighth - ((seekSeconds * 1000) % msPerEighth)`. Returns 0 (fire immediately)
if there's no music actually playing to measure against, per the formula given in the task spec
exactly — including firing a full `msPerEighth` later (not 0) on the rare exact-boundary case,
since that's what the formula literally produces.

**Orchestration (`ThemeAudio.scheduleBigWinEntry()`, called via the `scheduleBigWinEntry()` audio
hook from `GameController`'s blackout branch, right after the on-reel celebration and before
`playBigWinIntro()`/`bigWinWidget.show()`):**
1. Pauses the Step 30 intensity cooldown immediately (see below).
2. Computes `_msToNextEighth()` and waits exactly that long (`setTimeout`).
3. The instant it fires: hard-ducks both music layers to silence (`_duckMusicForBigWin()`,
   100ms) and resolves — `GameController` then fires `playBigWinIntro()`/`bigWinWidget.show()`
   in the same tick, so the riser/widget land on the same beat the duck does (measured ~1.6ms
   apart in the Browser pane, i.e. same synchronous chain).

**The hard duck.** Not the old dB-based partial duck (`_duckMusic()`/`_unduckMusic()`, now
deleted) — `_duckMusicForBigWin()` captures each layer's *actual current* volume (whatever
`musicIntensityWeight` mix it was really in — could be anywhere from all-`musicMain` to
all-`musicIntense`, or genuinely mid-crossfade) and fades both to true 0 over `BIG_WIN_DUCK_MS`
(100ms). `playBigWinRiser()` no longer ducks anything itself; the duck already happened.

**The curtained exit.** `stopBigWinRiser()`'s existing "stop chains into `winBigRiserEnd`"
callback now also calls `_restoreMusicAfterBigWin()` in the same breath — both music layers fade
from silence back to *exactly* the volumes `_duckMusicForBigWin()` captured (not a freshly
recomputed target) over `BIG_WIN_UNDUCK_MS` (2000ms), long enough that `winBigRiserEnd`'s own
tail covers the crossfade coming back in, per the task's framing. `stopWinRollup("big")` already
fires `stopBigWinRiser()` in the same zero-latency synchronous block as the counter hitting its
target (see Step 23) — so this inherits that exact-millisecond timing for free, no new wiring
needed there.

**Pausing the intensity cooldown.** `_pauseIntensityCooldown()`/`_resumeIntensityCooldown()` are
genuine pause/resume, not clear-and-restart: `_armIntensityCooldown()` (the renamed core of what
`notifySmallWin()` used to do inline) now tracks a wall-clock `_cooldownDeadline`, so pausing
mid-countdown captures the *true remaining* time and resuming re-arms with exactly that, not a
fresh `SMALL_WIN_INTENSITY_COOLDOWN_MS`. This matters because the Big Win duck and the Step 30
idle-fade-down both ultimately animate the same two Howler ids — without pausing, a cooldown
that happened to be mid-countdown from an earlier small win could fire its own crossfade-to-0
in the middle of the Big Win's hard duck/restore and fight it. Resumption is scheduled off
`_restoreMusicAfterBigWin()`'s own `BIG_WIN_UNDUCK_MS` timer, so the cooldown only starts
ticking again once the restore fade has actually finished settling.

**Verified in the Browser pane**, two ways:
- A full real gameplay flow (Super Bet -> Grand Win) with every relevant `ThemeAudio` method
  spied for call time: `scheduleBigWinEntry` -> `_pauseIntensityCooldown` -> `_msToNextEighth`
  (computed 228ms) -> `_duckMusicForBigWin` fired ~234ms later (228ms + ~6ms of normal
  `setTimeout` slack) -> `playBigWinRiser` 1.6ms after that -> `stopBigWinRiser` exactly
  8001.9ms later (matching `BIG_ROLLUP_MS`) -> `_restoreMusicAfterBigWin` 1.8ms after that ->
  `_resumeIntensityCooldown` exactly 2000.2ms later (matching `BIG_WIN_UNDUCK_MS`). Final
  settled volumes matched the pre-win resting state exactly (`musicMain` 0.9, `musicIntense` 0).
- A targeted edge case: triggering a small win (arming the cooldown, crossfading to
  `musicIntensityWeight=1`), waiting 2s, then triggering a Big Win mid-countdown. Confirmed the
  pause captured the true ~7996ms remaining (not a fresh 10000ms); confirmed the duck/restore
  correctly captured and restored the *actual* pre-duck per-layer volumes (`musicMain` 0,
  `musicIntense` 0.9 — correct for a weight-1 mix, not the weight-0 resting values); confirmed
  the cooldown resumed at ~7796ms remaining (7996ms minus elapsed) rather than restarting at
  10000ms; confirmed the 100ms duck actually reaches silence (sampled post-fade, not just that
  `.fade()` was called). Zero console errors throughout every run.

## BPM-in-sprite-name + musicBigWin: refreshing Arcade to v02 (Step 35)

Arcade's bank was refreshed again, from the sync drive's `arcadeSounds_v02.json`/`.mp3`
(replacing the v01 refresh from Step 31) — this version changed the vertical-layering sprite
names themselves and introduced a third music layer, both confirmed with the user first (per the
Step 19 policy) before any code was written, since neither is a "fix the obvious typo" case:

- **`musicMain`/`musicIntense` are now `musicMain_114`/`musicIntense_114`** — the BPM Step 34
  parses is embedded directly in the sprite name, not (only) the shared spritesheet's file path.
  Confirmed as the intended go-forward convention, not a naming slip.
- **A new sprite, `musicBigWin`** (22s) — confirmed as a dedicated Big Win music bed, meant to
  play "on beat" together with `winBigRiser`.
- **`powerbetOn`/`powerbetOff`** — same lowercase-"b" regression as v01 (Step 31), fixed at the
  source again (Drive original + project copy), same as last time.

**Sprite-name resolution is now dynamic, not hardcoded.** `ThemeAudio._findMusicSpriteName
(baseName)` looks for the bare name first ("musicMain"), then a `"<base>_<bpm>"` variant — every
place that used to hardcode the literal `"musicMain"`/`"musicIntense"` strings (`_playMusicLoop()`,
`_musicTargetVolume()`'s bus lookup) now goes through the resolved name, stored on
`_musicMainSpriteName`/`_musicIntenseSpriteName`/`_musicBigWinSpriteName` once `_playMusicLoop()`
runs. `busRouting.js`'s `busMusic` rule became a regex,
`/^(musicMain|musicIntense|musicBigWin)(_\d{2,3})?$/`, to keep matching either form. A bank with
no BPM in either the sprite name or the file path still resolves to `DEFAULT_BPM` exactly as
before — this is additive, not a breaking change for Egypt/Mexico/Football/China/Neon
Drive/Gangster's plain `musicMain` sprites.

**BPM source priority.** `loadTheme()` still parses `bank.src` via `parseBpmFromPath()` first (the
Step 34 fallback), but once `_playMusicLoop()` resolves the actual `musicMain`-family sprite name,
`audioUtils.bpmFromSpriteName()` re-checks *that* name for a `"_<bpm>"` suffix and overrides
`_bpm` if found — the sprite name is more specific (per-track) than the shared file path, so it
wins when both are present. Arcade v02 resolves to 114 BPM this way (its file path has no number
at all).

**`musicBigWin` plays "on beat" with the riser by piggybacking on the same trigger, not a second
quantization pass.** `playBigWinRiser()` — already firing at the Step 34 quantized entry point —
now also starts `musicBigWin` (if the bank defines it) in the same call, so no new BPM-aware
timing code was needed; it inherits Step 34's anticipation delay for free. Scaled like
`musicMain`/`musicIntense` (fader × `MUSIC_VOLUME_TRIM` × busMusic gain via
`_scaledMusicVolume()`), not a plain one-shot SFX, since it's still "the music" during the
climax — also picked up by `refreshMusicVolume()`'s live fader/mixer reactivity, unweighted (it's
an on/off third layer, not part of the `musicIntensityWeight` crossfade). `stopBigWinRiser()`
stops it in the same synchronous moment the riser's own stop is issued, alongside (not chained
through) the `winBigRiserEnd`/restore sequence — it started with the riser, so it ends with it too.

**Verified in the Browser pane**, all against the real v02 bank (not a mock): confirmed
`_musicMainSpriteName`/`_musicIntenseSpriteName`/`_musicBigWinSpriteName` resolved to
`"musicMain_114"`/`"musicIntense_114"`/`"musicBigWin"` and `_bpm` resolved to `114` (not the
`120` file-path fallback); a full Super-Bet-triggered Grand Win with the same method-spy
instrumentation as Step 34 — computed delay 185.26ms (correctly `< msPerEighth` at 114 BPM,
263.16ms), duck fired ~189ms later (188.6ms + slack), riser ran 8015.5ms, restore/resume timing
consistent with Step 34's measurements — and final settled volumes exactly matching the pre-win
resting state. Directly confirmed `musicBigWin` played alongside the riser at the correct
fader-scaled volume (0.9, matching `_scaledMusicVolume()`) and that both `riserId`/`musicBigWinId`
correctly cleared to `null` after `stopBigWinRiser()`. Zero console errors throughout.

## Refreshing Egypt, Football, China, Gangster, and (eventually) Mexico to the Step 35 convention (Step 36)

Egypt's bank was refreshed from the sync drive (`egyptSounds_v01`) — adds `musicIntense_100`,
renames `musicMain` to `musicMain_100`, and adds a `musicBigWin` sprite, matching the exact
convention Arcade's v02 bank introduced in Step 35. No naming fix needed this time (Egypt's
`powerBetOn`/`powerBetOff` were already correctly cased) and no code changes either — Step 35
already generalized sprite-name resolution, bus routing, and BPM parsing to handle any bank
following this convention, and Egypt picked it up automatically.

**Mexico's matching `mexicoSounds_v01` was reverted, not shipped.** It was initially copied in
alongside Egypt's and looked structurally correct (same convention, resolved to
`musicMain_130`/`musicIntense_130`/`musicBigWin`, timing math verified against real gameplay —
see the now-superseded numbers this section used to report), but the user then flagged the actual
audio as "completely baked" with "all sfx misplaced" once they listened to it in-game — the sprite
offsets/durations in the JSON don't line up correctly with the actual content of the new mp3.
This is exactly the class of bug the Browser-pane verification in this project *cannot* catch:
everything checked here is structural/timing correctness (does the right sprite name resolve, does
the delay math work out, does a `.fade()` land on the right volume at the right millisecond) —
never whether the audio playing back actually sounds like what it's supposed to, since that
requires a human ear. Reverted via `git checkout` back to the last-committed (pre-this-session,
single plain-`musicMain`, no `musicIntense`/`musicBigWin`) Mexico bank, since it was still
uncommitted at the time. Mexico needs a corrected export from the source pipeline before this
convention can be applied to it — Arcade and Egypt are unaffected and were not reported as broken.

**Verified in the Browser pane** (Egypt only, the surviving change here): resolved to
`musicMain_100`/`musicIntense_100`/`musicBigWin`, `_bpm` 100. A Super-Bet Grand Win computed a
112ms entry delay (`< msPerEighth` at 100 BPM, 300ms), duck fired ~117ms later, riser ran
8002.8ms, and final volumes settled at the theme's own busMusic-mix-scaled target (`musicMain`
0.72 = 1 fader × 0.9 trim × 0.8 Egypt busMusic mix) with `musicBigWinId` correctly cleared. Zero
console errors.

One environment note, not a code issue: mid-test, a run kept re-triggering spins on its own after
a Big Win finished — traced to the Browser pane's `read_page` accessibility-tree calls apparently
generating stray keyboard events the page's own Space-to-spin shortcut (Step 29) picks up. Not
reproducible through normal play; avoided afterward by using coordinate clicks instead of
`read_page`+`ref` lookups.

**Two more Mexico attempts, both also reverted, and a root-cause diagnosis.** A follow-up
`mexicoSounds.json` from the sync drive had a `"mexicoSunds"` typo (key/`src`/`id` all missing the
"o") — confirmed with the user and fixed at the source before importing, same Step 19 policy as
always. That import loaded and ran cleanly (structurally — `_musicMainSpriteName` etc. all
resolved, a full Big Win sequence ran with zero console errors), but a checksum comparison
against a *third* attempt showed the mp3 bytes were byte-identical to the one already reverted —
the underlying audio content hadn't actually changed between saves, only the JSON typo had been
fixed, so it was never going to sound different. The user then pinpointed the actual symptom:
looped `musicMain` was audibly playing straight through `reelStart`/`reelStop`/`reelTurbo` and
into the very distinctive `winBigRiser` instead of looping back to its own declared boundary.
That symptom shape — correct near the start of the file, increasingly wrong further in, wrong by
a lot at 71s+ — is the signature of an **MP3 encode/decode timeline mismatch**: Howler stops/loops
a sprite purely by the `start`/`duration` milliseconds declared in the JSON (confirmed by reading
`loadTheme()` — `sprite[sound.name] = [sound.start * 1000, sound.duration * 1000]`, a verbatim
pass-through, no computation on our side to have introduced this), but if the export tool computed
those timestamps against a different decode of the mp3 than the browser's Web Audio API produces
(common with VBR/LAME-padded MP3s — decoders don't always agree frame-for-frame), the *declared*
boundary and the *actual* audio content at that timestamp drift apart, compounding the deeper into
the file you go. Egypt and Arcade's `musicMain`/`musicIntense` loop correctly under the identical
code, which rules out anything on the ThemeAudio.js/Howler-usage side — this is specific to how
Mexico's particular mp3 was encoded/exported. Reverted again via `git checkout`, same as before.
Fixing this needs a corrected export on the source side (a constant-bitrate re-encode is the usual
fix for this class of issue) — not a JSON edit or a code change.

**Resolution: the real bug was a stale mp3 HTTP cache in this project's own testing, not (only) a
source-asset problem — see "Known environment gotchas" item 11 for the full mechanism.** It
surfaced unambiguously during Football's refresh (`footballSounds_v01` — also needed one naming
fix first, `musicMain` → `musicMain_130` to match `musicIntense_130`, confirmed with the user):
structural checks all passed (`_musicMainSpriteName` resolved correctly, zero console errors) and
it *still* played wrong content, because `fetch()`'s default cache mode was serving the *old*
football mp3 (4,129,763 bytes) underneath the *new* JSON's offsets — a silent mismatch with no
error, since Howler has no way to know the decoded buffer doesn't match the sprite map it was
given. Explicitly cache-busting both files together
(`fetch(jsonPath, {cache:'reload'})` **and** `fetch(mp3Path, {cache:'reload'})`) and re-testing
fixed it immediately — the identical code, identical convention, just a genuinely fresh buffer.
Football verified: `musicMain_130`/`musicIntense_130`/`musicBigWin`, `_bpm` 130, riser ran
8010.9ms, `mainVol` settled at 0.675 (1 × 0.9 trim × 0.75 Football's busMusic mix).

This meant Mexico's every previous test in this project (including the ones that reported it as
broken) never actually confirmed a fresh mp3 buffer was loaded — so the "completely baked"/"all
sfx misplaced" report may have been this exact caching artifact the whole time, not necessarily a
genuine export-pipeline problem. Re-tried with the same `mexicoSounds_v01` bytes already sitting
on the sync drive (checksum `fd9ad7f7...`, unchanged from every earlier attempt), this time with
both files properly cache-busted *and* a new safety check — `themeAudio.howl.duration()` compared
against the JSON's own last sprite's `start + duration` — added specifically to catch this class
of mismatch going forward. Mexico verified: `musicMain_130`/`musicIntense_130`/`musicBigWin`,
decoded duration 164.0s against an expected ~163.7s (a close match, confirming the right buffer),
riser ran 8006.8ms, zero console errors. Re-added to the project (no longer reverted).

China's bank (`chinaSounds_v01`) followed with no surprises: `musicIntense_120`/`musicMain_120`
correctly paired from the start (no naming fix needed, unlike Football), `musicBigWin` added,
`powerBetOn`/`powerBetOff` already correctly cased. Verified the same way — duration check (137.0s
decoded vs. ~136.6s expected) before anything else, then a full Super-Bet Grand Win: riser ran
8015.2ms, `mainVol` settled at 0.45 (1 × 0.9 trim × 0.5 China's busMusic mix), zero console errors.

Gangster's bank (`gangsterSounds_v01`) followed the same clean pattern as China: `musicIntense_100`/
`musicMain_100` correctly paired, `musicBigWin` added, `powerBetOn`/`powerBetOff` already correctly
cased — no naming fixes needed. Duration check first (180.0s decoded vs. ~179.8s expected), then a
full Super-Bet Grand Win: riser ran 8003.2ms, `mainVol` settled at 0.45 (1 × 0.9 trim × 0.5
Gangster's busMusic mix), zero console errors.

With this, every theme with a real audio bank (Arcade, Egypt, Football, China, Gangster, Mexico)
is now on the Step 35 convention — Neon Drive is the only one left untouched (no `_v01` bank has
been provided for it yet).

**Every theme-bank refresh from here on should do the duration cross-check before any other
verification** — it's cheap, catches the single most misleading failure mode in this whole
pipeline, and every refresh in this step now does it as standard practice.

---

## Storing BPM per theme instead of a sprite-name suffix; longer intensity cooldown; a 17s Big Win roll-up (Step 37)

**BPM is no longer parsed from the music sprite's name.** Step 35's `musicMain_<bpm>`/
`musicIntense_<bpp>` convention added real complexity (a naming fix needed for Football, an extra
resolution path in `_findMusicSpriteName()`) for a value that changes rarely and is easy to just
tell the assistant directly. All 6 refreshed banks' JSON (`arcadeSounds.json`, `egyptSounds.json`,
`footballSounds.json`, `chinaSounds.json`, `gangsterSounds.json`, `mexicoSounds.json`) had
`musicMain_<bpm>`/`musicIntense_<bpp>` reverted back to plain `musicMain`/`musicIntense` —
`musicBigWin` never had a suffix and is unaffected. The BPM values themselves aren't lost: they're
now a curated constant, `THEME_BPM` in `ThemeAudio.js` (`{ arcade: 114, egypt: 100, football: 130,
china: 120, gangster: 100, mexico: 130 }`), supplied manually rather than parsed. Future
theme-bank imports will have their BPM given directly (in chat) and added to this table, not
baked into the bank's own filenames.

`_playMusicLoop()`'s BPM resolution is now a priority chain: `THEME_BPM[currentTheme]`
(authoritative) → `bpmFromSpriteName(mainName)` (kept as a fallback — still works if some future
bank *does* use the suffix again) → `parseBpmFromPath()` on the bank's own `src` (stashed as
`this._bankSrc` in `loadTheme()`, since by the time `_playMusicLoop()` runs and needs it, `bank`
itself is out of scope) → `DEFAULT_BPM` (120, `parseBpmFromPath()`'s own built-in floor).
`_findMusicSpriteName()` itself is unchanged — it already checked the bare name first, so the
reverted banks resolve exactly like Football did before Step 35 touched it, no code changes needed
there.

**`SMALL_WIN_INTENSITY_COOLDOWN_MS` raised from 10000 to 20000** — the high-energy `musicIntense`
layer now holds for 20s past the last small win (still a strict reset per win, not accumulated;
see Step 30) before crossfading back down.

**`BIG_ROLLUP_MS` raised from 8000 to 17000** (`GameController.js`, briefly 16000 mid-session
before the user asked for one more second) — the Big Win counter now takes 17s to reach its
target instead of 8s. No changes needed in `WinCounter.js`: its easing (`bigWinEasedProgress()`)
and the digit-scale growth (`--climax-scale`, capped at 1.55×) are both parameterized purely on
`t` (elapsed-time *fraction*, 0-1) and the win `amount`, never the raw duration in ms — changing
`durationMs` just stretches the identical curve shape over a different wall-clock time, so the
"gradual rise, subtle font growth, sharp brake at the very end" feel carries over unchanged, just
slower. `scheduleBigWinEntry()`'s quantized-entry timing, the
`BIG_WIN_DUCK_MS`/`BIG_WIN_UNDUCK_MS` duck/restore, and `winBigRiser`'s own explicit-stop-at-climax
handling (Step 34) are all independent of `BIG_ROLLUP_MS` too — none needed touching.

**Verified in the Browser pane:** on Arcade, confirmed `_musicMainSpriteName`/
`_musicIntenseSpriteName` resolved to the bare `"musicMain"`/`"musicIntense"` and `_bpm` resolved
to `114` from `THEME_BPM`, not a sprite-name suffix (which no longer exists in the JSON) or the
120 file-path fallback. Confirmed `notifySmallWin()` now arms a 20000ms cooldown deadline exactly.
For the roll-up: a real Super-Bet Grand Win sampled the counter's displayed value/`--climax-scale`
every 300ms end to end — smooth, monotonically increasing digits throughout
(494 → 994 → 1,521 → … → 24,280 → 24,732 → 24,925 → 24,989 → 25,000, visibly decelerating in the
final samples exactly as the brake-zone math predicts) and `--climax-scale` climbing smoothly to
its 1.550 cap. A separate, precise instrumented run — a bare `WinCounter.rollUp(25000, 17000,
"big", …)` timed directly with `performance.now()` outside any game-flow overhead — measured
**17004.7ms elapsed, landing on exactly "25,000"**, confirming the duration is exact, not just
approximately in the right neighborhood. Zero console errors throughout.

---

## Reel Turbo 16th-note quantization + a background-tab throttling guard (Step 38)

**Turbo reel stops now snap onto the track's 16th-note grid, both visually and audibly, instead
of firing at a fixed offset.** `ThemeAudio._msToNextEighth()` (Step 34) was generalized into
`_msToNextGridPoint(divisor)` — 2 for an 8th note, 4 for a 16th — so both the Big Win entry and
this share one implementation rather than two near-duplicates. `getTurboStopQuantizeDelay()` (the
new public entry point, exposed through `audioHooks.js`) wraps `_msToNextGridPoint(4)`.
`GameController.spin()`'s fast-mode branch now waits the reel's normal `FAST_TIMING.spinMs` delay
(plain, non-rhythmic — just game pacing), then samples `getTurboStopQuantizeDelay()` fresh at that
moment and waits that too before calling `reel.stop(0, landingMs, onImpact)` — so both the reel's
visual landing (which `reel.stop()`'s own delay controls the start of) and its stop chime (which
fires on `onImpact`, when the landing animation first reaches the target) land on the same
beat-aligned instant. Since `FAST_TIMING.staggerMs` is 0, all 3 reels share the identical base
delay and each independently samples essentially the same quantize amount microseconds apart —
verified live: all 3 `getTurboStopQuantizeDelay()` calls landed within 0.2ms of each other, and
all 3 resulting `playReelStop()` calls within 0.3ms of each other, i.e. genuinely simultaneous, not
just close.

**The stop chime itself stays suppressed in fast mode, for now — a same-session reversal.** It was
briefly un-suppressed (the reasoning being that quantization makes 3 simultaneous `reelStop`
samples read as one locked-in hit rather than a phasey overlap, unlike the old un-quantized
suppression's original concern), verified working, then reverted at the user's request: the
existing `reelStop` bank wasn't sound-designed with 3-at-once playback in mind, so it goes back to
silent in Turbo mode until a chime actually meant for that exists. `audioHooks.playReelStop()`
keeps its `if (!isFastMode)` guard around `themeAudio.playReelStop()`. The quantization mechanism
itself — the *visual* landing snapping to the 16th-note grid, computed via
`getTurboStopQuantizeDelay()` — is untouched by this; only the audio call is skipped again.

**`js/audio/rhythmTimers.js` (new file)** — a tiny registry (`setRhythmTimeout()`/
`flushAllRhythmTimers()`) for exactly the timers that exist to hit a precise musical moment: the
Turbo quantize wait above, and `scheduleBigWinEntry()`'s 8th-note anticipation delay (Step 34,
switched from a raw `setTimeout` to `setRhythmTimeout`). `flushAllRhythmTimers()` doesn't silently
drop pending callbacks — it runs each one *immediately* and cancels the real `setTimeout` — because
the underlying game action (a reel locking into place, a Big Win entering) still has to happen even
though the tab is hidden; only the "wait for the exact beat-aligned millisecond" nicety is worth
skipping, since nothing about that timing would be perceptible while backgrounded anyway. This
matters because a hidden tab's timers are subject to real, sometimes multi-second browser
throttling — letting one of these fire "naturally" late would read as a jarring desync the instant
the player returns; flushing immediately avoids that entirely rather than just capping how late it
can be.

**`js/backgroundGuard.js` (new file)**, wired from `main.js`'s `init()` right after `wireGame()`,
listens for `document.visibilitychange`: on hidden, `flushAllRhythmTimers()` and
`GameController.pauseAllReelAnimations()`; on visible, `resumeAllReelAnimations()` and
`themeAudio.refreshMusicVolume()` (corrects any drift in the live fader/mixer volume that crept in
while backgrounded, e.g. a crossfade's own settle timer firing late). `ReelController` gained
`pauseSpinAnimation()`/`resumeSpinAnimation()`, both just `stripEl.getAnimations().forEach(anim =>
anim.pause()/.play())` — `getAnimations()` uniformly covers the WAAPI spin-up ramp, the CSS
cruise-loop, and a landing bounce, whichever happens to be active, so there's no need to track
which one is currently driving the strip.

**Deliberately does NOT call `Howler.mute()`.** `main.js`'s `wireAudioControls()` (pre-existing,
not part of this step) already mutes/unmutes on `visibilitychange` via a `windowActive`/
`masterMuted` combination that correctly layers auto-mute-on-hide *underneath* the player's own
manual Master Mute toggle, never overriding it. A second, cruder `Howler.mute()` call from this
new guard would risk exactly that: incorrectly un-muting audio the player deliberately silenced,
the instant the tab becomes visible again. Verified live: with Master Mute manually engaged,
simulating hidden → visible left `Howler._muted` `true` throughout and after — untouched by the
new guard, exactly as intended.

**Verified in the Browser pane**, all self-contained scripts (per this project's own
tool-round-trip-latency gotcha — a first attempt at this exact test was invalidated by real
multi-second gaps between separate tool calls, see "Known environment gotchas" item 2): a dummy
10-second `setRhythmTimeout` fired in 0.1ms when `visibilitychange` fired with `document.hidden`
forced `true`, confirming the flush is immediate, not merely "eventually." A real fast-mode spin's
reel animation measured `"running"` → `"paused"` → `"running"` across a simulated hide/show cycle,
and the interrupted spin still completed cleanly afterward (`spin-btn` re-enabled, a real result
displayed) — nothing left stuck. `themeAudio.refreshMusicVolume()` confirmed called on the
visible-again transition. Zero console errors throughout every run.

---

## systemSounds v1 refresh, an elegant bet-size UI, a spin lock, and pitch-bending audio (Step 39)

**systemSounds refreshed to v1** (`systemSounds_v01` from the sync drive — no naming issues, key/
`src`/`id` all correct) — adds `moneyCounter01`/`moneyCounter02`/`moneyCounterEnd`, `uiBet` (was
already present), `uiDash`, `uiPulse`, `uiTransition`; `uiMenuOff`/`uiMenuOn` also newly present
but unused so far (available for future wiring). Four call-site renames/additions in
`audioHooks.js`, all going through the existing `SystemAudio.play()` wrapper (which already
applies `randomizedPitchRate()`, ±~1 semitone — this is *why* the four sprites the task called out
for pitch randomization needed no new pitch logic, just routing through `play()` rather than a
direct `howl.play()`):
- `playWinLineDash()`: `"smallWinLineTick"` (a placeholder name, no such sprite ever existed) →
  `"uiDash"`.
- `playSmallWinBlink()`: `"smallWinBlinkTick"` (same, placeholder) → `"uiPulse"`.
- `playTransitionOutro()` (new hook): `"uiTransition"`, called from `ThemeTransition._transitionTo()`
  right as the fade lifts (after `this.fadeOverlayEl.classList.remove(...)`'s moment) — an outro,
  deliberately distinct from `playTransitionWhoosh()` at the top of the same method, which marks
  the fade-to-black *starting*. `playTransitionWhoosh()` itself is untouched (still an unwired
  placeholder — the task only specified an outro, not an intro sprite).

**`SystemAudio`'s systemic small-win money-counter fallback renamed**: `playSmallWinDigits()`/
`stopSmallWinDigits()` used to reference sprite names (`winSmallDigits`/`winSmallDigitsEnd`) that
never actually existed in any systemSounds bank — dead placeholder names. Now: a new
`_randomAvailableIndexedName()` helper (same pattern as `ThemeAudio`'s own) picks randomly between
`moneyCounter01`/`moneyCounter02` for the loop (still bypassing `play()`'s pitch randomization,
matching `ThemeAudio`'s never-randomized loop behavior — consistent regardless of which bank ends
up serving a given theme), and `moneyCounterEnd` for the completion sting — which *does* go
through `play()`, since it's one of the four sprites meant to randomize in pitch. This is the
*systemic fallback* specifically (`audioHooks.js`'s `startSmallWinDigits()`/`stopSmallWinDigits()`
choose it only when the active theme has no `winSmallDigits`/`winSmallDigitsEnd` of its own — see
"Adding China" and Step 25); `ThemeAudio`'s per-theme mechanism (China's own bank) is untouched.

**The bet-size UI** (`index.html`, `css/styles.css`): a new `.bet-selector` — two bare `<button>`
elements (real, focusable, keyboard-operable elements, just reset to no border/background/padding
so only their inline SVG caret glyph shows — "no clunky HTML buttons" was read as "no visible
button chrome," not "avoid semantic buttons entirely") flanking a `<span>` showing the current bet
(`"$ 1.00"`). Sits in a new `.kickplate__fast-col` wrapper alongside the existing Fast toggle,
stacked vertically — this was the direct way to guarantee it lands "directly below" that specific
control regardless of viewport width, rather than relying on implicit CSS grid column placement
across two separate rows.

**The logic** (`main.js`'s `wireBetSelector()`): a strict, ordered `BET_STEPS` array
(`[0.20, 0.50, 1.00, 2.00, 5.00, 10.00]`), default index 2 (`$1.00`). The arrows step one entry at
a time and *clamp* at either end rather than wrapping around — "cycle... up and down through this
array" read as "step through," not "wrap from $10 back to $0.20," which felt like the wrong
default for anything bet-adjacent even in a prototype; worth flagging in case wrap-around was
actually intended. Not yet wired into actual payout math — `SpinSequence.js`'s tiers are still
fixed amounts regardless of the displayed bet; this step is the UI/audio layer only.

**The Spin Lock**: `wireGame()`'s `spinBtn` click handler already disabled `spinBtn`/`powerbetBtn`
synchronously before `await game.spin()` and re-enabled them only after it resolved — `betSelector
.lock()`/`.unlock()` (toggling `.disabled` on both arrow buttons) were added at those exact same
two points, so the bet arrows share the identical lock lifecycle down to the millisecond, not a
separately-timed approximation of it. `css/styles.css`'s `.bet-selector__arrow:disabled` sets both
`opacity: 0.5` and an explicit `pointer-events: none` (native `disabled` already blocks
clicks/focus on its own; the explicit rule is redundant-but-harmless belt-and-suspenders, matching
the task's literal ask).

**Dynamic pitch-bending audio** (`SystemAudio.playBetClick(direction)`, `BET_CLICK_*` constants):
a *separate* code path from `play()`'s random-jitter pitch — this is a controlled, directional
effect, so it calls `howl.play()`/`howl.rate()` directly. Tracks `_betClickRate` and
`_betClickLastAt`; each call checks the gap since the last click: over `BET_CLICK_CONSECUTIVE_MS`
(500ms) resets the rate to exactly 1.0, otherwise nudges it `BET_CLICK_RATE_STEP` (0.05) in the
clicked direction, clamped to `[BET_CLICK_RATE_MIN, BET_CLICK_RATE_MAX]` (0.5-1.5). One rate value
shared across both directions (not two independent up/down accumulators) — a same-window direction
reversal bends smoothly back toward 1.0 and past it, rather than each direction maintaining its own
separate "how far up/down have we gone" state; this was the more literal reading of the task's own
worked example (`1.0, 1.05, 1.1` for 3 consecutive same-direction clicks) generalized to the
mixed-direction case. `main.js`'s `wireBetSelector()`'s `step()` calls `playBetClick(direction)`
unconditionally on every enabled click — even one that's clamped at an array boundary and doesn't
actually move the displayed value — so the click always confirms audibly, matching "every time an
enabled arrow is clicked" literally.

**Verified in the Browser pane.** Direct, spied calls to `SystemAudio.playBetClick()` confirmed the
exact rate sequence for `up, up, up, down` (rapid): `[1, 1.05, 1.1, 1.05]` — matching the task's
own worked example precisely, including the direction-reversal case. A 15-click rapid "up" burst
capped at exactly `1.5`; a 15-click "down" burst floored at exactly `0.5`; a single click after a
600ms gap reset to exactly `1`. The Spin Lock: a real `spinBtn.click()`, checked in the very next
tick, showed `spinBtn`/both bet arrows all `disabled: true` simultaneously; polled until the spin
concluded, all three were `false` again, with `getComputedStyle` confirming `opacity: 0.5` /
`pointer-events: none` on the arrows once the CSS transition itself had settled (an initial
same-tick check misleadingly read `opacity: 1` — mid-transition, not a bug — resolved by checking
past the transition's own 150ms). Boundary clamping confirmed exact: 10 rapid "down" clicks from
`$1.00` landed on `$0.20` (not below); 10 rapid "up" clicks from there landed on `$10.00` (not
above). The systemic money-counter fallback (Egypt, no theme-specific `winSmallDigits`) confirmed
via a spied `howl.play()`: a real small win called `moneyCounter02` then `moneyCounterEnd`, in that
order. `playTransitionOutro()` confirmed firing (console log) right as a theme's fade lifted. Zero
console errors throughout every run — all in a **freshly-created tab**, notably: the original,
long-lived tab from this same session had also logged a
`TypeError: Cannot read properties of null (reading 'addEventListener')` that a brand-new tab
(same URL, same code) did not reproduce, initially misdiagnosed as a tab-state artifact (see
"Known environment gotchas" item 12). **This diagnosis was wrong** — the user went on to report
the real symptom ("Initialize Engine does nothing") independently and repeatably; see the fourth
follow-up bullet below and "Known environment gotchas" item 13 for the actual root cause and fix.

**Same-session follow-up, three fixes/clarifications:**
- **Bet-selector arrows now stay silent at either boundary.** `wireBetSelector()`'s `step()`
  reordered: the bounds check now happens *before* `playBetClick()`, not after — clicking "up"
  already at `$10.00` (or "down" at `$0.20`) changes nothing and confirms nothing. Verified: 5
  clicks at each boundary produced exactly 0 `playBetClick()` calls.
- **`moneyCounter01` removed from `src/audio/systemSounds.json`, `moneyCounter02` only, for now** —
  the project's own copy only; the sync-drive original is untouched, so a future re-sync would
  bring `moneyCounter01` back (this is a deliberate, temporary scope-narrowing, not a fix to an
  upstream mistake). `SystemAudio._randomAvailableIndexedName("moneyCounter")` needed no code
  change — it already degrades correctly to "the one match" when only one exists.
- **`uiDash`/`uiPulse`/`uiTransition` re-verified end to end, all three confirmed genuinely
  working** (a report that they were "missing" prompted this recheck): direct `systemAudio.play()`
  calls for all three produced a real `howl.play()` + a `howl.rate()` within the expected
  0.94-1.06 range (`uiDash` 1.0159, `uiPulse` 0.9638, `uiTransition` 1.0133 in one sampled run —
  confirms `uiDash` *is* randomized, one of the things asked to double-check), and a real
  gameplay small win independently triggered both `uiDash` and `uiPulse` via a spied `howl.play()`.
  The likely explanation for not hearing them: `systemSounds.mp3` was refreshed *mid-session* (the
  v1 refresh, earlier in this same step) — `uiPulse` and `uiTransition` sit at the *later* offsets
  in the new file (18s/21s), so a browser tab that cached the old, shorter mp3 before the refresh
  would seek past where that old file actually ends for exactly those two, while earlier-offset
  sprites (`uiBet`, `uiClick`, etc.) would keep working — matching the selective "these specific
  ones are missing" symptom exactly. Same mechanism as "Known environment gotchas" item 11.
- **"Initialize Engine does nothing" was a real bug, since fixed.** `wireBetSelector()` threw on
  `null.addEventListener()` whenever `index.html` (missing the new bet-selector markup) was stale
  relative to `main.js` (already expecting it) — which silently aborted the rest of `init()`,
  including the welcome-screen click-listener wiring further down, since `init()` has no top-level
  `.catch()`. `wireBetSelector()` now guards on all three of its elements being non-null and
  degrades to a no-op instead of throwing. See "Known environment gotchas" item 13 for the full
  mechanism. If "nothing happens on click" ever resurfaces, hard-refresh first (this exact failure
  mode needs a stale HTML+fresh JS mismatch to trigger), then check the console for the
  `[main] Bet selector elements not found` warning this fix now logs.

---

## Theme-select audio timing, synced small-win pulses, and an in-tune money counter (Step 40)

Three independent, user-directed audio-timing fixes, none of them touching the underlying sprites:

- **`uiTransition` now fires the instant a theme is selected, not once the reveal finishes.**
  `ThemeTransition._transitionTo()` called `playTransitionOutro()` as its very last line, right
  before the fade lifted — so the cue landed roughly `BLACK_HOLD_MIN_MS` + load time after the
  actual click, not "the moment of selection" as intended. Moved to the top of the method, right
  alongside `playTransitionWhoosh()` (both now fire in the same synchronous tick the method is
  entered, which is itself the same tick as the dropdown's `change` handler or the startup
  terminal's `waitForSelection()` resolving — nothing meaningful happens in between). Verified via
  console log ordering on both entry points: `playTransitionOutro()` now logs before
  `playTransitionWhoosh()` and before any fade/load work, for both the init-menu terminal and the
  in-game dropdown.
- **`uiPulse` now fires 3 times per small win, synced to the actual 3-iteration `.symbol--win` CSS
  animation** (`symbol-win-pulse`, 0.9s × 3, see styles.css) instead of firing once, well after the
  celebration pop had already finished. `GameController._wireSmallWinPulseAudio()` listens for the
  CSS animation's native `animationiteration` event on one reference payline element — it fires
  between iterations only (twice, for 3 total, at the 0/900/1800ms boundaries) — as a reliable
  per-iteration anchor. Only one element is wired (not all 3 winning tiles) because every winning
  tile gets the class in the same synchronous tick and animates in lockstep — wiring all of them
  would have tripled the pulses instead of syncing them.
  **Correction, same-session, reported by the user as "still not synced":** the first version fired
  audio right on each iteration boundary — but the animation's own keyframes put peak brightness at
  each iteration's *50% mark*, not its boundary (the boundary is the animation's darkest resting
  point, 0% and 100% of the keyframe). Firing on the boundary meant every cue landed a consistent
  450ms *before* the visual flash it was meant to accent — small enough to not be an obvious "wrong
  count" bug, large enough to read as unmusical. Fixed by offsetting every cue by a new
  `SMALL_WIN_PULSE_PEAK_OFFSET_MS` (900ms iteration / 2, hardcoded to match the CSS rather than
  read live off the animation, same style as this file's other fixed timing constants) before
  calling `playSmallWinBlink()`. Verified with a `MutationObserver` (timestamping the instant
  `.symbol--win` is actually applied) cross-referenced against a `Howl.play` spy (timestamping each
  `uiPulse` play call): the 3 cues landed at +461ms / +1351ms / +2251ms off the win-class instant,
  matching the keyframe's 450/1350/2250ms peaks within ordinary timer jitter. **If this class of
  "technically firing 3x but still feels off" bug resurfaces elsewhere** (any audio cue tied to a
  CSS/WAAPI animation), check the keyframe's own peak offset before assuming the trigger count or
  timing source is the problem — matching iteration *count* isn't the same as matching iteration
  *phase*.
- **`moneyCounter`'s pitch randomization removed entirely.** The looping counter itself
  (`moneyCounter01/02`) never had pitch randomization to begin with (`SystemAudio.playSmallWinDigits()`
  already called `this.howl.play()` directly, bypassing the `play()` wrapper's
  `randomizedPitchRate()`) — but `moneyCounterEnd`, the completion sting, did go through the `play()`
  wrapper and so was still randomizing ±1 semitone per the Step 39 spec. `stopSmallWinDigits()` now
  calls `this.howl.play("moneyCounterEnd")` directly too, matching the loop. Verified with a
  `Howl.prototype.rate`/`.play` spy across a real small win: zero `rate()` calls for either
  `moneyCounter02` or `moneyCounterEnd`'s sound ids, while `uiDash`/`uiPulse`/`winSmall01`/etc. in
  the same win still received their usual randomized rate — confirms the change is scoped to just
  the money-counter family, not a global regression of `SystemAudio.play()`'s pitch jitter.

---

## Kickplate control rework: bet-selector pill, a matched Fast-spin button, and systemSounds v2 (Step 41)

A cluster of visual/UX fixes to the kickplate controls, plus one audio-bank refresh, all done
without pushing per the user's request (still local-only as of this writing):

- **Bet-selector reworked into a proper pill.** The original `.bet-selector` was bare floating
  text + unstyled SVG chevrons — no `font-family` on the value at all (inheriting the browser
  default sans, mismatching every other readout in the cabinet) and thin dim-gray arrows with no
  relation to the cabinet's iconography. Reworked to reuse the same dark bordered pill treatment
  as `.audio-fader`/`.audio-dock__theme` (`border-radius: 999px`, `var(--control-border)`/
  `var(--control-bg)`), `"Courier New", monospace` on the value, and solid filled-triangle SVG
  arrows instead of outlined chevrons.
- **Repositioned to its own row, centered below Spin** (was stacked under the Fast toggle, in the
  kickplate's left 74px column) — `.cabinet__kickplate` is now a column flex (row, then the pill)
  instead of the row being the only child. First pass measured the gap from Spin's *shadow-
  inclusive* visual edge (matching the reasoning `.cabinet__frame`'s own bottom-padding comment
  already used for Spin itself) and came out asymmetric-but-intentional (40px raw above / 14px
  raw below, meant to read as equal). The user's next request clarified they wanted literal,
  equal raw distance from Spin's actual border, not its shadow — reworked to a plain matching
  value both sides (currently 24px `.cabinet__kickplate` gap == 24px `.cabinet__frame` bottom
  padding), verified via `getBoundingClientRect()` on both gaps.
- **Sized up per follow-up request**: padding 5px/10px → 7px/14px, value font-size 0.72rem →
  0.82rem, arrow SVGs 10×7 → 12×9. Verified pill grew from 27×116px to 33×138px, gaps still equal
  (24px/25px, 1px rounding only) after the resize.
- **Fast-spin toggle rebuilt as a `<button>` matching `.powerbet-toggle`'s exact shape, size, and
  position** (mirrored on Spin's other side) — replacing the old checkbox + sliding-track switch,
  per an explicit user request for symmetry with Super Bet. Keeps reading as a switch (not a
  second command button) via a small track-and-thumb SVG glyph whose dot slides on state change
  (`cx` as an animatable CSS geometry property, not a `transform`, to avoid the viewBox's own
  scale ambiguity). New `--fast-accent` cyan (`#38c6e0`), distinct from `--cabinet-accent` (gold)
  and `--powerbet-accent` (orange), for the active-state glow — no infinite pulse like Powerbet's
  armed state, since Fast is a persistent session mode, not a one-shot arm. `main.js`'s
  `fastToggle` wiring switched from a `change`/`.checked` listener to a `click` + local
  `fastEnabled` boolean + `aria-pressed`, mirroring `powerbetBtn`'s own pattern exactly. Both
  buttons' heights (43px vs. 48px, from the icon-size difference — an emoji glyph vs. an SVG
  glyph don't naturally match) were pinned to an explicit, identical `height: 48px` so the two
  stay pixel-symmetric regardless of icon rendering. Verified: 74×48px both, 157px from Spin's
  center on both sides. Label text is "Fast Spin" (was "Fast"), per a same-session follow-up.
  **Diagnostic note**: mid-testing, a synthetic click on the startup terminal's theme list
  appeared to do nothing, and the terminal seemed to still be showing on a later screenshot even
  after the game DOM had loaded — both were testing-script artifacts, not app bugs: (1) the click
  landed before `WelcomeScreen.dismiss()`'s fade transition had finished attaching
  `waitForSelection()`'s listener (a script-timing race, not reproducible from a real user's
  slower manual click), and (2) the stale-looking screenshot was a frozen compositor frame from
  the Browser-pane tool having been not-visible/not-compositing a moment earlier — re-querying the
  DOM directly (not the screenshot) showed the terminal genuinely gone. Neither is an app defect.
- **systemSounds refreshed to v2**: the small-win money counter's numbered `moneyCounter01/02`
  convention is gone entirely, replaced by named variants — `moneyCounter`, `moneyCounterBubbles`,
  `moneyCounterDigital`, `moneyCounterWood`, `moneyCounterZap` — none of which end in digits, so
  the existing `_randomAvailableIndexedName()` (built for a `"<prefix><NN>"` pattern) silently
  matches nothing against them. Added a dedicated `SystemAudio._randomMoneyCounterName()`
  instead: filters sprite names starting with `"moneyCounter"` and explicitly excludes
  `"moneyCounterEnd"`, per the user's explicit instruction to keep End as the fixed completion
  sting, never part of the randomized pool. Verified live with a `Howl.play` spy across several
  small wins: random draws from the 5-variant pool (`moneyCounterBubbles`, `moneyCounter` both
  observed), every one immediately followed by exactly `moneyCounterEnd`, never the reverse and
  never `moneyCounterEnd` itself drawn as the starter. `uiDash`'s duration also changed (0.385s →
  0.645s) as an incidental part of the v2 bank; no code depends on that duration directly, so no
  further change was needed for it.
- **Signal Monitor: the tag column (SYS/THEME, always rendered blank per its own "reserved for
  something more useful... not removed from the layout" comment) removed entirely**, per an
  explicit user request ("remove the old spacing we left there") after noticing long sprite names
  were losing their identifying suffix to the row's `text-overflow: ellipsis` (e.g.
  `"moneyCounte…"`, the "Bubbles"/"Digital" part invisible). `AudioProfiler.js`'s row template
  dropped the `<span class="audio-profiler__row-tag">`, `.audio-profiler__row`'s
  `grid-template-columns` went from `16px 1fr 32px` to `1fr 32px`, and the now-dead
  `.audio-profiler__row-tag` CSS rule was deleted. Reclaimed exactly the expected 22px (16px
  column + 6px gap) — verified via `getBoundingClientRect()` before/after (name column: 80px →
  102px for a short name). Checked the fix wouldn't reintroduce the overlap the panel's own width
  comment warns about: at the referenced ~846px test viewport, `.audio-profiler`'s left edge sits
  essentially flush against `.cabinet__frame`'s right edge already (measured slack: -1px) — so
  *widening* the panel is not safe headroom, only reclaiming already-dead internal space was.
- **`moneyCounter*` sprite names renamed to `counter*`** (`counterMain`/`Bubbles`/`Digital`/`End`/
  `Wood`/`Zap`, "moneyCounter" itself explicitly renamed to `counterMain` rather than the empty
  string a blind prefix-strip would've produced), per an explicit user request, project's
  `src/audio/systemSounds.json` copy only — the sync-drive `systemSounds_v02.json` master is
  untouched, same scoping precedent as the earlier `moneyCounter01` removal. `SystemAudio.js`'s
  `_randomMoneyCounterName()` and `stopSmallWinDigits()` updated to match (`"counter"` prefix,
  excludes `"counterEnd"`). This rename also incidentally finished off the Signal Monitor
  truncation above: the shorter names (`counterBubbles`/`counterDigital`, 14 chars vs. the old
  `moneyCounterBubbles`/`moneyCounterDigital`'s 20) now fit inside the reclaimed 102px name column
  without even touching the ellipsis — confirmed live, full names rendering during a real small
  win (`counterBubbles` then `counterEnd`, both fully visible in the Signal Monitor).
- **Bet-selector pitch-bend's consecutive-click window raised 500ms → 1000ms**
  (`SystemAudio.js`'s `BET_CLICK_CONSECUTIVE_MS`), per an explicit user request — clicking an
  arrow again within 1s of the last click now keeps bending the rate, instead of 500ms. Verified
  with precisely-timed synthetic clicks (both dispatched from one script, not two separate tool
  calls — an earlier attempt using two separate `wait`+`click` tool calls measured a "700ms" gap
  that actually reset, which turned out to be tool round-trip overhead pushing the real gap past
  1000ms, not a bug): a 700ms gap now bends (`1.0` → `1.05`), an 1100ms gap still resets
  (`1.0` → `1.0`).
- **China's theme-specific small-win money counter removed**, per an explicit user request —
  `winSmallDigits`/`winSmallDigitsEnd` deleted from `src/audio/chinaSounds.json` (China was the
  only bank that ever defined this pair; see Step 21's "Adding China" section). No other code
  change was needed: `ThemeAudio.hasSmallWinDigits()`/`playSmallWinDigits()`/`stopSmallWinDigits()`
  already check `_spriteNames.has("winSmallDigits")` fresh on every roll-up rather than caching a
  per-theme flag, and `audioHooks.js`'s `startSmallWinDigits()` already falls back to
  `systemAudio.playSmallWinDigits()` whenever the active theme doesn't define its own pair — this
  is exactly the same fallback path every other theme has always used, China just now takes it
  too. `busRouting.js`'s `busWinsSmall` comment (previously citing China's pair by name) updated
  to reflect no bank currently defines it. Verified live: fresh-loaded China now has
  `hasSmallWinDigits() === false`, and a real small win played `counterBubbles` → `counterEnd`
  (the generic systemic pool) instead of `winSmallDigits`/`winSmallDigitsEnd`, zero console
  warnings. **Note on the investigation immediately before this fix**: an initial verification
  attempt appeared to show China still playing the old `winSmallDigits`/`winSmallDigitsEnd` after
  the JSON edit — this was purely the already-running page's in-memory `ThemeAudio` instance still
  holding the pre-edit sprite list (this project's usual stale-cache/stale-module-instance
  pattern, see "Known environment gotchas" item 1), not a failed edit; a genuinely fresh load
  (new tab, cache-busted) confirmed the fix works correctly on the first real try.

---

## Refreshing Neon Drive to the current bank convention (Step 42)

Neon Drive was the last theme with a real audio bank still on the old, pre-Step-35 convention
(bare `musicMain` only, no `musicIntense`/`musicBigWin` adaptive layers) — synced from the drive's
`neondriveSounds_v01`.

- **Naming slip caught before copying anything in**: the sync source had the small-win flavor
  sprites as `smallWin01-04` (word order reversed) instead of the `winSmall01-04` every other
  theme and the code itself expect (`ThemeAudio._randomAvailableIndexedName("winSmall")`). Per
  standing preference, asked the user rather than silently renaming or writing fallback code for
  it — confirmed as unintentional, fix requested at the source. Renamed in the sync-drive master
  (`G:\...\spritesheets\neondriveSounds_v01.json`) *before* copying into the project, so the fix
  survives the next sync instead of needing to be reapplied.
- **BPM**: Neon Drive had no `THEME_BPM` entry (`ThemeAudio.js`) — without one, the new
  `musicIntense`/`musicBigWin` layers' quantized timing (Big Win entry, Turbo reel-stop) would've
  silently guessed a 120 BPM default instead of the theme's real tempo. Asked the user; added
  `neondrive: 80`.
- Copied `neondriveSounds_v01.json` → `src/audio/neondriveSounds.json` and
  `neondriveSounds_v01.mp3` → `assets/23/sounds/neondriveSounds.mp3` (post-rename). Verified live:
  `themeAudio._bpm === 80` once Neon Drive loads, `musicIntense`/`musicBigWin` both present, a real
  small win played `winSmall04` (confirming the rename took), zero console warnings. A forced Grand
  Win also confirmed `musicBigWin` fires correctly.

**Follow-up, same step:** a finalized `neondrive` entry added to `DevMixer.js`'s
`DEFAULT_THEME_MIXES` (`busReelsTurbo: 0.75, busWinsSmall: 0.8, busWinsSymbol: 0.9,
busReelsNormal: 0.9, busMusic: 0.9`) — the user's provided mix-level update also included
egypt/football/arcade/china/gangster, but those matched the already-baked-in values exactly
(byte-for-byte), so only the new `neondrive` entry actually changed anything. Verified live via
`devMixer.getBusVolume("neondrive", <bus>)` for all 5 buses after a proper cache-busted reload
(an initial check read stale `1` defaults from the already-loaded module — same pattern as this
file's other stale-cache gotchas, resolved by a fresh navigation); spot-checked the five unchanged
themes' values too, to confirm the edit didn't disturb anything else.

---

## Drag-to-unlock engine slider, ported from Tactile (Step 43)

The plain "Initialize Engine" button on the welcome screen (the master audio gate — see
`WelcomeScreen.js`) was replaced with a physical, resistant gear-slider: an 8-notch track the
player has to drag a brushed-metal thumb across, not just click. Ported from the sibling Tactile
project (`D:\DEV\Claude\Tactile`, an agency site that embeds this engine live via iframe and
already built the identical interaction against the same design tokens) and adapted to this
project's lifecycle rather than reinvented.

**What changed:**
- `index.html`'s `#welcome-screen` block: the old `<button id="welcome-start-btn"
  class="welcome-screen__btn">` is gone, replaced by `.engine-slider` (track, 8 notches, fill,
  brushed-metal thumb with a grip texture) and a `.welcome-screen__shutter` (4 corner blades for
  the unlock wipe). `#welcome-start-btn` still exists, but repurposed: a `display:none` proxy
  button, purely a click-dispatch target now (see below).
- `css/styles.css`: `.welcome-screen__btn*` rules and its pulse keyframes removed; new
  `.engine-slider*`/`.welcome-screen__shutter*` rules added, reusing this project's own
  `--metal-hi/light/mid/dark/shadow`, `--cabinet-accent`, and `--control-border` tokens directly
  (confirmed identical values in both projects' `:root` before copying Tactile's gradient stops
  verbatim — no parallel palette introduced).
- `js/theme/WelcomeScreen.js`: gained `_wireEngineSlider()`/`_snapAndUnlock()` (ported from
  Tactile's `js/main.js` gate-slider IIFE — `thumbTravel()`, `setPosition()`, the pointer/touch
  handlers, `snapAndUnlock()` — adapted to resolve through this class's existing lifecycle instead
  of managing reveal/removal itself). **`waitForStart()` and `dismiss()` are both textually
  unchanged** — the integration deliberately routes through their existing contracts rather than
  replacing them.

**The two integration problems a naive port would hit, and how they were actually solved:**
1. **AudioContext unlock timing.** `resume()` only counts as "inside a user gesture" if nothing
   async sits between the gesture and the call. `_snapAndUnlock()` fires everything synchronously
   inside the same pointerup/touchend call stack the threshold-crossing drag is already running
   in: snap the thumb, flip the label, add the shutter class, then `this.startBtnEl.click()` —
   a real click, synchronously resolving `waitForStart()`'s existing listener. `main.js`'s
   `await welcomeScreen.waitForStart(); unlockAudioContext();` continuation runs as a microtask
   directly off that synchronous gesture, preserving activation — exactly like the plain button's
   click always did. The shutter sweep and `dismiss()`'s fade are purely cosmetic and run
   afterward, off the gesture entirely.
2. **Sequencing with the existing fade, without touching `dismiss()`'s code.** Shutter blades are
   siblings of `.welcome-screen__card` (not nested inside it), so neither's opacity multiplies the
   other. `.welcome-screen--fading` (added by `dismiss()`, unchanged) got one new line:
   `transition-delay: 0.48s` — matching the blade sweep's 0.45s duration plus a small buffer — so
   the root's own opacity fade doesn't even start until the blades have already fully covered the
   viewport. Net effect: wipe to black (0–450ms), then fade away from black to reveal the terminal
   underneath (480ms–880ms) — one continuous-feeling sequence, `dismiss()`'s `transitionend`
   listener still fires exactly once, Promise still resolves exactly once, zero JS changes to make
   it happen.

**Verification** (scripted `PointerEvent` dispatch driving the exact same code paths real
touch/mouse input hits, since this session's browser-automation tool's click coordinates don't map
1:1 to viewport CSS pixels — see "Known environment gotchas" below — plus a real manual drag by
the user):
- Partial drag (40% travel) released early → thumb sprang back to `left:4px` (0%), `armed` class
  removed, zero `Howl.play()` calls — no unlock.
- Full drag (~99% travel) → label changed to "ENGINE ONLINE", `.welcome-screen--snapping` added,
  `Howler.ctx.state === "running"` confirmed after, and a real `uiClick` sound actually played
  (`main.js`'s `systemAudio.play("uiClick")` right after `waitForStart()` resolves) — direct proof
  the AudioContext unlock landed inside the gesture, not just that the Promise resolved.
  `#welcome-screen` fully removed from the DOM ~1.5s later, `#startup-terminal` revealed
  underneath, `dismiss()`'s Promise resolved without hanging.
- One real bug found and fixed during this verification: `thumb.setPointerCapture(event.pointerId)`
  (ported as-is from Tactile) threw an uncaught `NotFoundError` when the browser didn't consider
  the id an active pointer at that instant — a real, if narrow, edge case even with genuine input,
  not just scripted events. Wrapped in a `try {} catch {}` since capture is a nicety (keeps the
  drag tracking if the pointer leaves the track bounds), not required for the slider to function —
  confirmed zero console errors on every subsequent run via a dedicated `window.addEventListener
  ("error", ...)` listener (more reliable here than this session's `read_console_messages`, which
  turned out to return accumulated history across navigations, not just the latest page load —
  briefly misread as the fix not having taken effect before catching that).

New "Known environment gotchas" item: **this session's Browser-automation `computer` tool's
click/drag `coordinate` (documented as "screenshot-pixel space") does not map 1:1 to real viewport
CSS pixels** — measured ~1.19x scale factor (a screenshot-space click at `(290,369)` landed a real
browser event at viewport `(344,439)`) on at least one viewport size this session. A `left_click_drag`
aimed from a screenshot-estimated thumb position missed the target and dragged a text selection
instead. Don't burn turns chasing pixel-perfect `computer`-tool coordinates for drag interactions —
verify the underlying logic via direct scripted `PointerEvent`/`TouchEvent` dispatch instead (drives
the identical code paths), and ask the user to do a real manual pass for the "does this actually
feel right" check.

---

## Font tokens: JetBrains Mono + Space Grotesk, ported from Tactile (Step 44)

Brought over the same font pairing/rule the sibling Tactile portfolio site already uses (it embeds
this engine live, so the two now share one visual language end to end): JetBrains Mono is the base
for every label/control/readout in this cabinet (reads as physical hardware engraving); Space
Grotesk is reserved for headline-scale, brand-carrying moments only.

- **New tokens in `:root`** (`css/styles.css`): `--font-mono: "JetBrains Mono", "Courier New",
  monospace;` and `--font-display: "Space Grotesk", var(--font-mono), sans-serif;` — both chain
  back to the old hardcoded fallback, so a failed font load still degrades to the exact previous
  look rather than an unstyled system font.
- **Fonts loaded** in `index.html`'s `<head>` via the same Google Fonts CSS2 API `<link>` pattern
  Tactile uses (`preconnect` ×2 + one stylesheet link, `JetBrains+Mono:wght@400;700` +
  `Space+Grotesk:wght@400;500;700`).
- **All ~15 literal `"Courier New", monospace` occurrences in `styles.css`** replaced with
  `font-family: var(--font-mono);` (one occurrence legitimately remains — the `--font-mono` token's
  own fallback chain, not a hardcoded usage). Every one of these was `font-family: var(--font-mono);`
  before this step too (a straight swap, not a redesign) — only 4 selectors were deliberately moved
  to `--font-display` instead: `.cabinet__title` (the "OCTAVE SPIN FORGE" wordmark — previously had
  no explicit font-family at all, inheriting body's mono; weight bumped 400→700 since a grotesk at
  the old inherited default reads thin at this size, letter-spacing/color/glow left as-is),
  `.welcome-screen__text:first-child` (the one human-voiced line on the audio gate), `.win-counter__value`
  (the small in-cabinet WIN number — its `.win-counter__label` "WIN" caption stays mono), and
  `.big-win-counter__value` (the jackpot payout number, already weight 800). Every other
  control/badge/readout — `.big-win-widget__title`, `.big-win-collect-btn`, `.bet-selector__value`,
  `.powerbet-toggle__label`, `.fast-toggle__label`, `.spin-btn`, the engine slider's own label, etc.
  — stays mono, deliberately.
- **A pre-existing, previously-invisible bug found and fixed along the way**: every
  `<button>`/`<select>`/`<input>` in this app was silently rendering in the browser's default UI
  font (Arial), not `"Courier New"` — a well-known UA-stylesheet quirk where form controls don't
  inherit `font-family` from their ancestors by default. This had been true since long before this
  step (nothing about the mono→token swap introduced it), just undetectable while the "wrong" font
  and the "right" font were both generic serif-less system fonts that looked similar enough not to
  notice. It became directly checkable — and directly relevant to this step's own acceptance
  criteria ("every button, toggle, badge, and label readout is still visibly monospace") — the
  moment a real, distinctive display font entered the picture and made computed-style spot-checks
  worth doing. Fixed with a global reset (`button, select, input, textarea { font-family: inherit;
  }`) right after the `* { box-sizing: border-box; }` rule — the same `font-family: inherit;`
  pattern already used one-off on `.dev-mixer__export-btn`, now applied everywhere instead of just
  that one control.
- **Verified**: `document.fonts.check()` confirmed both families genuinely loaded (not silently
  falling back) for every weight actually used; computed `font-family` spot-checked across all 4
  `--font-display` selectors and 9 mono control/label selectors (including the ones the pre-existing
  bug above affected) — every one matched the intended token post-fix. Zero console errors on a
  fresh load. Confirmed visually too: the "OCTAVE SPIN FORGE" wordmark and the welcome screen's
  opening line both render in a clearly distinct grotesk face against the monospace labels
  surrounding them (READY/WIN/SPIN/FAST SPIN/SUPER BET/THEME, etc.).

---

## Engine slider width bug: a self-inflicted CSS comment broke `.engine-slider` entirely (Step 45)

The user reported a visual bug: right at the moment the drag-to-unlock slider (Step 43) reaches
the end, "the slider resizes and the slide circle jumps to its locked position but on the resized
slider." Root cause turned out to be much bigger than the symptom suggested, and dated back to
Step 43 itself — not a new regression.

**The bug**: Step 43's own doc comment above `.engine-slider` read
`--metal-*/--cabinet-accent/--control-border tokens` — and `*/` is how a CSS comment ends. The
comment closed itself early, right in the middle of a sentence, at that `*/`. Everything from
there — the rest of that sentence, the intended real `*/`, and the entire
`.engine-slider { width: 100%; display: flex; flex-direction: column; align-items: center; gap:
14px; margin-top: 8px; }` rule immediately after — got consumed by the browser's CSS parse-error
recovery and silently dropped. No console error, no visual "something's broken" signal — CSS
parse errors are silent by design. Confirmed via `document.styleSheets`: the live parsed
stylesheet's rule list jumped straight from `.welcome-screen__start-proxy` to
`.engine-slider__track` with no `.engine-slider` rule in between, despite the raw source text
(fetched with `cache:"no-store"`) clearly containing it.

**Why this produced exactly the reported symptom, and not something more obviously broken**:
without `.engine-slider`'s `display:flex`/`width:100%`, it fell back to being an ordinary
block-level flex-item child of `.welcome-screen__card` (still `display:flex`, that rule is
untouched) with no explicit width — and `.welcome-screen__card` uses `align-items: center`, not
`stretch`, so a cross-axis-unsized flex item shrinks to fit its own widest in-flow child instead of
filling the row. That widest child was `.engine-slider__label`'s own text — "INITIALIZE SOUND
ENGINE" measures ~196px, so the *entire slider* (which also has `.engine-slider__track`'s own,
separate, still-intact `width: 100%` — now 100% of this shrunk ~196px parent, not the card's full
~366px) rendered at barely half its intended width for the *whole resting state*, not just at
unlock. It only became *visible* as a bug at the unlock moment specifically because that's the one
point `label.textContent` changes to something shorter ("ENGINE ONLINE", ~150px) — shrinking the
already-wrong shrink-to-fit parent even further, live, at the exact instant the thumb snaps to a
position computed against the pre-shrink width. Two more-or-less-independently-broken things
(missing `display:flex`, and a text change happening to coincide with the one moment anyone would
be staring at the slider closely enough to notice) combined into one specific, narrow-looking
symptom.

**Fix**: reworded the comment to avoid the literal `*/` substring (`--metal- family, --cabinet-accent,
and --control-border tokens` instead of `--metal-*/--cabinet-accent/--control-border`) — no code
logic changed, this was purely a documentation-comment bug. Swept the rest of `styles.css`
programmatically (a small Node script checking every line for `*/` followed by trailing
same-line content) for any other instance of this exact failure mode — none found.

**Verified**: `document.styleSheets` rule count went 202 → 203 (the recovered rule), `.engine-slider`
now computes `display: flex` at the full ~366px card-content width instead of block/~196px, and a
`requestAnimationFrame`-driven geometry logger spanning the unlock moment confirmed `trackW`/`trackL`
now stay exactly constant across the label-text switch (previously: 196px → 111px in the same
window). Visually confirmed too: the slider now correctly spans the full card width at rest, not
just at unlock — the bug was present the whole time, just least noticeable before the thumb was
sitting still.

**Lesson for future CSS comments in this file**: a token list or path containing both `*` and `/`
adjacent to each other (glob-style tokens, wildcard paths, "before/after" prose right next to an
asterisk) is one keystroke away from silently deleting whatever rule follows it, with zero runtime
signal that anything went wrong. Worth a second glance before landing a comment shaped like
`* /` or `x*/y`.

---

## If you're picking this up fresh

1. Read this file fully before touching code.
2. To run it locally: `python3 -m http.server 8934` from the project root, then open
   `http://localhost:8934/index.html`. No build step.
3. Check `audioHooks.js` first to see exactly which game events have real audio wired vs. are
   still placeholders — it's the single source of truth for "what's implemented."
4. When testing audio/timing in the Browser-pane tool, read the "Known environment gotchas"
   section above before spending time debugging what looks like an app bug.
