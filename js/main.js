import { systemAudio } from "./audio/SystemAudio.js";
import { themeAudio } from "./audio/ThemeAudio.js";
import { unlockAudioContext } from "./audio/audioUtils.js";
import { playPowerBetOn, playPowerBetOff, playBetClick } from "./audio/audioHooks.js";
import { AudioProfiler } from "./audio/AudioProfiler.js";
import { DevMixerPanel } from "./audio/DevMixerPanel.js";
import { ThemeTransition } from "./theme/ThemeTransition.js";
import { WelcomeScreen } from "./theme/WelcomeScreen.js";
import { StartupTerminal } from "./theme/StartupTerminal.js";
import { THEMES } from "./theme/themeRegistry.js";
import { GameController } from "./game/GameController.js";
import { getInitialDisplay, spinSequencer } from "./game/SpinSequence.js";
import { wireBackgroundGuard } from "./backgroundGuard.js";

function populateThemeSelect(themeSelectEl) {
  THEMES.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.label;
    themeSelectEl.appendChild(option);
  });
}

// Scoped to `root` (defaults to the whole document) so it can also be re-run just
// against elements created after the initial page-load sweep — like the startup
// terminal's theme rows, which don't exist yet the first time this runs — without
// re-binding (and double-playing) everything it already wired.
function wireGlobalUISfx(root = document) {
  root.querySelectorAll("[data-sfx-hover]").forEach((el) => {
    el.addEventListener("mouseenter", () => systemAudio.play("uiHover"));
  });
  root.querySelectorAll("[data-sfx-click]").forEach((el) => {
    el.addEventListener("click", () => systemAudio.play("uiClick"));
  });
}

function wireAudioControls() {
  const masterBtn = document.getElementById("master-mute-btn");
  const masterIcon = masterBtn.querySelector(".audio-toggle-btn__icon");
  const musicFaderWrap = document.getElementById("music-fader-wrap");
  const musicFader = document.getElementById("music-fader");

  let masterMuted = false;
  // Tracks whether this tab is the frontmost, focused one. Separate from masterMuted
  // so backgrounding the tab never overwrites — or gets overwritten by — the user's
  // manual mute preference; the two combine via applyGlobalMute() below.
  let windowActive = document.hasFocus() && !document.hidden;

  function applyGlobalMute() {
    Howler.mute(masterMuted || !windowActive); // global — every Howler instance, system + theme alike
  }

  function syncMasterBtn() {
    masterBtn.classList.toggle("audio-toggle-btn--muted", masterMuted);
    masterBtn.setAttribute("aria-pressed", String(masterMuted));
    masterIcon.innerHTML = masterMuted ? "&#128263;" : "&#128266;";
    // Master Mute wins regardless of the fader's own position (Howler.mute() silences
    // musicMain along with everything else) — dim the fader so that's visually obvious.
    musicFaderWrap.classList.toggle("audio-fader--overridden", masterMuted);
  }

  function syncFaderFill() {
    musicFader.style.setProperty("--fader-fill", `${Math.round(Number(musicFader.value) * 100)}%`);
  }

  masterBtn.addEventListener("click", () => {
    masterMuted = !masterMuted;
    applyGlobalMute();
    syncMasterBtn();
  });

  musicFader.addEventListener("input", () => {
    themeAudio.setMusicVolume(Number(musicFader.value));
    syncFaderFill();
  });

  // Auto-mute whenever the tab isn't the active, focused one (backgrounded, minimized,
  // or another window/tab is on top) and unmute on return — layered on top of, never
  // overriding, the user's manual Master Mute toggle.
  const updateWindowActive = () => {
    windowActive = document.hasFocus() && !document.hidden;
    applyGlobalMute();
  };
  document.addEventListener("visibilitychange", updateWindowActive);
  window.addEventListener("focus", updateWindowActive);
  window.addEventListener("blur", updateWindowActive);

  // document.hasFocus() alone is too strict a proxy for "the player is here": a page
  // embedded in an outer app/pane (this whole game's actual delivery context) can be
  // the frontmost, visibly-hovered thing on screen while the outer app still holds
  // keyboard focus elsewhere — hasFocus() reports false the whole time, so every
  // hover/click sfx before the player's first click landed silently muted (the click
  // itself usually grants focus, masking the bug for click but not hover). A genuinely
  // backgrounded tab never receives pointer events at all, so any pointer activity
  // reaching this document is itself reliable evidence the player is actually looking
  // at it — treat it as "active" too, on top of (never instead of) the focus signal.
  const wakeOnPointerActivity = () => {
    if (windowActive) return;
    windowActive = true;
    applyGlobalMute();
  };
  document.addEventListener("pointermove", wakeOnPointerActivity);
  document.addEventListener("pointerdown", wakeOnPointerActivity);

  applyGlobalMute();
  syncMasterBtn();
  syncFaderFill();
}

function wireThemeSelect(themeTransition, devMixerPanel) {
  const themeSelect = document.getElementById("theme-select");
  themeSelect.addEventListener("change", async (event) => {
    // Disabled for the duration so a second switch can't fire mid-fade — the fade
    // overlay's transitionend wait assumes it's animating from 0, which a second
    // "already at opacity:1" activation wouldn't trigger.
    themeSelect.disabled = true;
    await themeTransition.swapTo(event.target.value);
    themeSelect.disabled = false;
    // Keeps the dev mixer showing the newly-active theme's bus mix even if it's
    // sitting open through a theme switch, not just the theme that was active when it
    // was last opened.
    devMixerPanel.refresh();
  });
}

// Strict, ordered set of valid bet sizes — the arrows step through this array one
// entry at a time (clamped at either end, not wrapping) rather than allowing an
// arbitrary typed value. Not yet wired into actual payout math (SpinSequence.js's
// tiers are still fixed amounts) — this is the UI/audio layer only, per the task
// this shipped under.
const BET_STEPS = [0.2, 0.5, 1.0, 2.0, 5.0, 10.0];
const DEFAULT_BET_INDEX = 2; // $1.00

// Renders the current bet value and wires the up/down arrows. Returns lock()/
// unlock() so wireGame()'s spinBtn handler can grey out + functionally disable the
// arrows for the exact duration of a spin (see the Spin Lock requirement) — native
// `disabled` already blocks clicks; css/styles.css's `:disabled` rule adds the 50%
// opacity + explicit pointer-events:none on top.
function wireBetSelector() {
  const valueEl = document.getElementById("bet-selector-value");
  const decreaseBtn = document.getElementById("bet-decrease-btn");
  const increaseBtn = document.getElementById("bet-increase-btn");

  // A stale cached index.html (missing this markup) served alongside a fresh main.js
  // would otherwise throw here and silently abort the rest of init() — including the
  // welcome screen's click listener, further down. Degrade instead of crashing.
  if (!valueEl || !decreaseBtn || !increaseBtn) {
    console.warn("[main] Bet selector elements not found — skipping wiring (stale index.html cache?).");
    return { lock() {}, unlock() {} };
  }

  let betIndex = DEFAULT_BET_INDEX;

  function render() {
    valueEl.textContent = `$ ${BET_STEPS[betIndex].toFixed(2)}`;
  }

  // Silent at either boundary — clicking "up" already at the max (or "down" at the
  // min) changes nothing, so it stays silent rather than confirming a click that had
  // no actual effect.
  function step(direction) {
    const nextIndex = betIndex + (direction === "up" ? 1 : -1);
    if (nextIndex < 0 || nextIndex >= BET_STEPS.length) return;
    betIndex = nextIndex;
    render();
    playBetClick(direction);
  }

  decreaseBtn.addEventListener("click", () => step("down"));
  increaseBtn.addEventListener("click", () => step("up"));

  render();

  return {
    lock() {
      decreaseBtn.disabled = true;
      increaseBtn.disabled = true;
    },
    unlock() {
      decreaseBtn.disabled = false;
      increaseBtn.disabled = false;
    },
  };
}

function wireGame() {
  const reelEls = Array.from(document.querySelectorAll(".reel"));
  const resultEl = document.getElementById("result-readout");
  const spinBtn = document.getElementById("spin-btn");
  const fastToggle = document.getElementById("fast-toggle-btn");
  const powerbetBtn = document.getElementById("powerbet-toggle-btn");
  const cabinetFrameEl = document.querySelector(".cabinet__frame");
  const winLineEl = document.getElementById("win-line");
  const celebrationOverlayEl = document.getElementById("celebration-overlay");
  const winCounterEl = document.getElementById("win-counter");
  const winCounterValueEl = document.getElementById("win-counter-value");
  const bigWinEls = {
    overlayEl: document.getElementById("big-win-overlay"),
    // The whole widget panel (not just the label+number) gets the rolling/big
    // classes, so the pulse animates the panel's own glow — more dramatic than
    // pulsing a background-less inline pair.
    counterEl: document.querySelector(".big-win-widget"),
    counterValueEl: document.getElementById("big-win-counter-value"),
    collectBtnEl: document.getElementById("big-win-collect-btn"),
    fountainEl: document.getElementById("coin-fountain"),
  };

  const game = new GameController(
    reelEls,
    resultEl,
    winLineEl,
    celebrationOverlayEl,
    winCounterEl,
    winCounterValueEl,
    bigWinEls
  );
  game.showInitial(getInitialDisplay());

  const betSelector = wireBetSelector();

  // Same click-toggle + aria-pressed pattern as powerbetBtn below, now that Fast is a
  // real <button> rather than a checkbox-driven switch — fastEnabled is the local
  // source of truth for the UI state, game.setFastMode() the one for gameplay.
  let fastEnabled = false;
  fastToggle.addEventListener("click", () => {
    fastEnabled = !fastEnabled;
    fastToggle.classList.toggle("fast-toggle--active", fastEnabled);
    fastToggle.setAttribute("aria-pressed", String(fastEnabled));
    game.setFastMode(fastEnabled);
  });

  // Purely visual/state sync, driven directly off spinSequencer.isForceArmed() (no
  // separate local boolean to risk desyncing from it). Deliberately not called while a
  // spin is in flight — see spinBtn's click handler below — so the toggle/glow stay
  // fully on through the *entire* Powerbet spin (reels, celebration, big win overlay,
  // roll-up, Collect), not just until the outcome is decided at spin start. That's
  // what makes the reset an actual auto-reset tied to the win sequence completing,
  // not an instant one tied to the spin merely starting.
  function syncPowerbetUI() {
    const armed = spinSequencer.isForceArmed();
    powerbetBtn.classList.toggle("powerbet-toggle--active", armed);
    powerbetBtn.setAttribute("aria-pressed", String(armed));
    cabinetFrameEl.classList.toggle("cabinet__frame--powerbet", armed);
  }

  powerbetBtn.addEventListener("click", () => {
    if (spinSequencer.isForceArmed()) {
      spinSequencer.disarmForcedBigWin();
      playPowerBetOff();
    } else {
      spinSequencer.forceBigWinNext();
      playPowerBetOn();
    }
    syncPowerbetUI();
  });

  spinBtn.addEventListener("click", async () => {
    spinBtn.disabled = true;
    powerbetBtn.disabled = true;
    betSelector.lock();
    await game.spin();
    // Auto-reset: only reached once the whole win sequence (if this was a Powerbet
    // spin) has fully played out and been collected — see the comment on
    // syncPowerbetUI() above for why this specific timing matters. The bet arrows
    // unlock on this same trailing edge, not a moment sooner.
    syncPowerbetUI();
    spinBtn.disabled = false;
    powerbetBtn.disabled = false;
    betSelector.unlock();
  });

  return game;
}

// Lets Space trigger a spin from anywhere on the page — a dedicated, exclusive Spin
// shortcut, not merely "Space activates whatever's focused" (that's already the
// browser's native per-control behavior, and relying on it is exactly the bug this
// fixes: after clicking Fast or Super Bet with the mouse, focus stays on that control,
// so a later Space re-toggled *it* instead of spinning). preventDefault() is called
// unconditionally, before any native per-control handling gets a chance to run, so
// Space always means Spin regardless of what currently has focus. Wired only at the
// end of init(), after the cabinet is actually playable, not from wireGame() —
// wireGame() runs before the welcome screen/startup terminal are dismissed, and a
// document-level key handler would fire straight through those gates' visual blocking
// (unlike a real click, which they'd intercept), attempting a spin before a theme is
// even chosen.
function wireSpinKeyboardShortcut(spinBtn) {
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;
    event.preventDefault();
    if (!spinBtn.disabled) spinBtn.click();
  });
}

async function init() {
  systemAudio.init();
  wireGlobalUISfx();
  wireAudioControls();

  const audioProfiler = new AudioProfiler(
    document.getElementById("audio-profiler"),
    document.getElementById("audio-profiler-list"),
    document.getElementById("audio-profiler-empty"),
    [
      { tag: "SYS", getHowl: () => systemAudio.howl },
      { tag: "THEME", getHowl: () => themeAudio.howl },
    ]
  );
  audioProfiler.start();

  const devMixerPanel = new DevMixerPanel(
    document.getElementById("dev-mixer"),
    document.getElementById("audio-profiler-header")
  );

  const themeSelect = document.getElementById("theme-select");
  populateThemeSelect(themeSelect);

  const themeTransition = new ThemeTransition(document.getElementById("fade-overlay"));
  wireThemeSelect(themeTransition, devMixerPanel);
  const game = wireGame();
  wireBackgroundGuard(game);

  // themeManager (ThemeManager.js) dispatches this the instant a theme's JSON config
  // resolves — during ThemeTransition's fade-to-black, before the backdrop/audio even
  // start loading. Redrawing the reels' resting symbols with the new theme's icon art
  // right here means the swap happens entirely behind the fade, same as the
  // background photo and the theme audio already do — never a visible pop once the
  // fade lifts.
  document.addEventListener("themeconfigloaded", () => game.refreshSymbolArt());

  // Gatekeeper: nothing thematic loads — no theme JSON fetch, no ThemeAudio Howl
  // construction/playback — until the player picks a theme in the startup terminal.
  // That click is the page's first user gesture, which is what makes the audio that
  // follows (gameAmbLP, gameStart -> musicMain) actually audible instead of silently
  // blocked by browser autoplay policy. The terminal's rows do play the same generic
  // system uiHover/uiClick sfx as the rest of the app, though — that's a separate,
  // already-loaded Howl (systemAudio), not the thematic bank this gate is actually about.
  const startupTerminal = new StartupTerminal(
    document.getElementById("startup-terminal"),
    document.getElementById("startup-terminal-list")
  );
  startupTerminal.render();
  wireGlobalUISfx(startupTerminal.listEl);

  // Master audio gate: loads visually on top of the terminal (already rendered and
  // wired above) and blocks it until the player drags its engine slider home. The
  // page's actual first user gesture is now the initial *grab* of that slider, not
  // this resolve — WelcomeScreen unlocks the AudioContext itself, from the thumb's own
  // pointerdown/touchstart, well before waitForStart() resolves (see WelcomeScreen.js's
  // class-level comment, Step 46). This call is a harmless, idempotent safety net for
  // the one case that path doesn't fire: _wireEngineSlider() guarding out on missing
  // markup. No systemAudio.play() here anymore either — the slider fires its own
  // lock/reveal sounds on unlock (playSliderLock()/playSliderReveal()); a generic
  // uiClick layered on top of those would just be clutter.
  const welcomeScreen = new WelcomeScreen(
    document.getElementById("welcome-screen"),
    document.getElementById("welcome-start-btn")
  );
  await welcomeScreen.waitForStart();
  unlockAudioContext();
  await welcomeScreen.dismiss();

  // Menu ambience: Vintage Arcade's gameAmbLP/gameStart (not its music) play as a
  // generic "lobby" atmosphere while the player is still choosing a theme below —
  // deliberately not awaited, so a fast selection isn't blocked on this load.
  // loadTheme()'s own in-flight-token guard already discards this cleanly if the
  // player picks before it resolves; if they pick Arcade itself, loadTheme()'s
  // "already loaded" branch starts its music on top instead of reloading the bank.
  themeAudio.loadTheme("arcade", { skipMusic: true });

  const chosenThemeId = await startupTerminal.waitForSelection();
  themeSelect.value = chosenThemeId;
  await themeTransition.enterFromTerminal(chosenThemeId, startupTerminal);
  devMixerPanel.refresh();

  // The reel grid's initial measurement (game.showInitial(), above) ran while the
  // terminal still covered the cabinet, before the browser was guaranteed to have
  // settled layout for the page's real final size — re-measure now that the cabinet
  // is actually visible, so a reel can never end up visually shrunk relative to its
  // own content because of that timing gap.
  game.refreshLayout();

  wireSpinKeyboardShortcut(document.getElementById("spin-btn"));
}

document.addEventListener("DOMContentLoaded", init);
