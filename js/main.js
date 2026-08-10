import { systemAudio } from "./audio/SystemAudio.js";
import { themeAudio } from "./audio/ThemeAudio.js";
import { unlockAudioContext } from "./audio/audioUtils.js";
import { playPowerBetOn, playPowerBetOff } from "./audio/audioHooks.js";
import { AudioProfiler } from "./audio/AudioProfiler.js";
import { ThemeTransition } from "./theme/ThemeTransition.js";
import { WelcomeScreen } from "./theme/WelcomeScreen.js";
import { StartupTerminal } from "./theme/StartupTerminal.js";
import { THEMES } from "./theme/themeRegistry.js";
import { GameController } from "./game/GameController.js";
import { getInitialDisplay, spinSequencer } from "./game/SpinSequence.js";

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

function wireThemeSelect(themeTransition) {
  const themeSelect = document.getElementById("theme-select");
  themeSelect.addEventListener("change", async (event) => {
    // Disabled for the duration so a second switch can't fire mid-fade — the fade
    // overlay's transitionend wait assumes it's animating from 0, which a second
    // "already at opacity:1" activation wouldn't trigger.
    themeSelect.disabled = true;
    await themeTransition.swapTo(event.target.value);
    themeSelect.disabled = false;
  });
}

function wireGame() {
  const reelEls = Array.from(document.querySelectorAll(".reel"));
  const resultEl = document.getElementById("result-readout");
  const spinBtn = document.getElementById("spin-btn");
  const fastToggle = document.getElementById("fast-spin-toggle");
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

  fastToggle.addEventListener("change", (event) => {
    game.setFastMode(event.target.checked);
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
    await game.spin();
    // Auto-reset: only reached once the whole win sequence (if this was a Powerbet
    // spin) has fully played out and been collected — see the comment on
    // syncPowerbetUI() above for why this specific timing matters.
    syncPowerbetUI();
    spinBtn.disabled = false;
    powerbetBtn.disabled = false;
  });

  return game;
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

  const themeSelect = document.getElementById("theme-select");
  populateThemeSelect(themeSelect);

  const themeTransition = new ThemeTransition(document.getElementById("fade-overlay"));
  wireThemeSelect(themeTransition);
  const game = wireGame();

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
  // wired above) and blocks it until this one deliberate click. That click is the
  // page's actual first user gesture — explicitly resuming the AudioContext here
  // rather than just relying on Howler's own automatic first-gesture unlock means
  // every hover/click sfx on the terminal underneath is guaranteed audible the
  // instant it's reachable, not just "probably fine by then."
  const welcomeScreen = new WelcomeScreen(
    document.getElementById("welcome-screen"),
    document.getElementById("welcome-start-btn")
  );
  await welcomeScreen.waitForStart();
  unlockAudioContext();
  systemAudio.play("uiClick");
  await welcomeScreen.dismiss();

  const chosenThemeId = await startupTerminal.waitForSelection();
  themeSelect.value = chosenThemeId;
  await themeTransition.enterFromTerminal(chosenThemeId, startupTerminal);

  // The reel grid's initial measurement (game.showInitial(), above) ran while the
  // terminal still covered the cabinet, before the browser was guaranteed to have
  // settled layout for the page's real final size — re-measure now that the cabinet
  // is actually visible, so a reel can never end up visually shrunk relative to its
  // own content because of that timing gap.
  game.refreshLayout();
}

document.addEventListener("DOMContentLoaded", init);
