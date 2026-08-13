import { themeAudio } from "./ThemeAudio.js";
import { devMixer } from "./DevMixer.js";
import { BUS_NAMES } from "./busRouting.js";

const TRIPLE_CLICK_WINDOW_MS = 500;
const EXPORT_STATUS_RESET_MS = 1800;

// Hidden developer tool: a per-theme bus-gain mixing console, revealed only by
// triple-clicking the Signal Monitor's header (see _wireReveal()). Not part of the
// player-facing experience and deliberately undocumented in the UI itself — a tuning
// aid for arriving at a value set to hardcode into the project once mixing is done,
// via Export Config.
export class DevMixerPanel {
  constructor(panelEl, revealTriggerEl) {
    this.panelEl = panelEl;
    this.themeLabelEl = panelEl.querySelector("#dev-mixer-theme");
    this.busesEl = panelEl.querySelector("#dev-mixer-buses");
    this.crossfadeRangeEl = panelEl.querySelector("#dev-mixer-crossfade-range");
    this.crossfadeValueEl = panelEl.querySelector("#dev-mixer-crossfade-value");
    this.exportBtn = panelEl.querySelector("#dev-mixer-export-btn");
    this.exportStatusEl = panelEl.querySelector("#dev-mixer-export-status");
    this.exportOutputEl = panelEl.querySelector("#dev-mixer-export-output");
    this.closeBtn = panelEl.querySelector("#dev-mixer-close-btn");
    this._statusTimer = null;

    this._buildBusRows();
    this._wireCrossfadeRow();
    this._wireReveal(revealTriggerEl);
    this.closeBtn.addEventListener("click", () => this.hide());
    this.exportBtn.addEventListener("click", () => this._handleExport());
  }

  _buildBusRows() {
    BUS_NAMES.forEach((bus) => {
      const row = document.createElement("div");
      row.className = "dev-mixer__bus-row";
      row.innerHTML = `
        <span class="dev-mixer__bus-label">${bus}</span>
        <input type="range" class="dev-mixer__bus-range" min="0" max="1" step="0.01" value="1" data-bus="${bus}" />
        <span class="dev-mixer__bus-value">100%</span>
      `;
      const range = row.querySelector(".dev-mixer__bus-range");
      const valueEl = row.querySelector(".dev-mixer__bus-value");
      range.addEventListener("input", () => {
        const value = Number(range.value);
        valueEl.textContent = `${Math.round(value * 100)}%`;
        devMixer.setBusVolume(themeAudio.currentTheme, bus, value);
        themeAudio.refreshBusLive(bus);
      });
      this.busesEl.appendChild(row);
    });
  }

  // Crossfade duration only takes effect on the *next* musicMain<->musicIntense
  // transition (see ThemeAudio._crossfadeToIntensity()) — unlike a bus row, there's
  // nothing continuously playing on it to live-refresh mid-drag.
  _wireCrossfadeRow() {
    this.crossfadeRangeEl.addEventListener("input", () => {
      const seconds = Number(this.crossfadeRangeEl.value);
      this.crossfadeValueEl.textContent = `${seconds.toFixed(1)}s`;
      devMixer.setCrossfadeMs(themeAudio.currentTheme, seconds * 1000);
    });
  }

  // Plain click-counter with a reset window, rather than relying on a browser
  // triple-click gesture (dblclick has no triple equivalent, and click events don't
  // carry a native "detail >= 3" guarantee consistently enough across browsers to
  // trust here) — three ordinary clicks within TRIPLE_CLICK_WINDOW_MS of each other.
  _wireReveal(triggerEl) {
    let clickCount = 0;
    let timer = null;
    triggerEl.addEventListener("click", () => {
      clickCount += 1;
      clearTimeout(timer);
      if (clickCount >= 3) {
        clickCount = 0;
        this.toggle();
        return;
      }
      timer = setTimeout(() => {
        clickCount = 0;
      }, TRIPLE_CLICK_WINDOW_MS);
    });
  }

  // Re-reads every bus slider from devMixer for whichever theme is currently active.
  // Called on every theme change (main.js), not just while the panel is visible, so
  // it's never stale by the time it's next opened.
  refresh() {
    const theme = themeAudio.currentTheme;
    this.themeLabelEl.textContent = theme ?? "—";
    const mix = theme ? devMixer.getThemeMix(theme) : {};
    this.busesEl.querySelectorAll(".dev-mixer__bus-row").forEach((row) => {
      const range = row.querySelector(".dev-mixer__bus-range");
      const valueEl = row.querySelector(".dev-mixer__bus-value");
      const value = mix[range.dataset.bus] ?? 1;
      range.value = String(value);
      valueEl.textContent = `${Math.round(value * 100)}%`;
    });

    const crossfadeSeconds = (theme ? devMixer.getCrossfadeMs(theme) : 1000) / 1000;
    this.crossfadeRangeEl.value = String(crossfadeSeconds);
    this.crossfadeValueEl.textContent = `${crossfadeSeconds.toFixed(1)}s`;
  }

  show() {
    this.refresh();
    this.panelEl.classList.add("dev-mixer--visible");
    this.panelEl.setAttribute("aria-hidden", "false");
  }

  hide() {
    this.panelEl.classList.remove("dev-mixer--visible");
    this.panelEl.setAttribute("aria-hidden", "true");
  }

  toggle() {
    if (this.panelEl.classList.contains("dev-mixer--visible")) {
      this.hide();
    } else {
      this.show();
    }
  }

  async _handleExport() {
    const json = devMixer.exportJSON();
    this.exportOutputEl.value = json;
    this.exportOutputEl.hidden = false;

    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(json);
        copied = true;
      }
    } catch {
      copied = false;
    }
    // Fallback for non-secure contexts / a denied clipboard permission: select the
    // textarea's content so a manual Ctrl+C still works with zero extra steps, rather
    // than leaving the user with a JSON blob and no way to grab it.
    if (!copied) this.exportOutputEl.select();

    this.exportStatusEl.textContent = copied ? "Copied to clipboard" : "Select + copy below";
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      this.exportStatusEl.textContent = "";
    }, EXPORT_STATUS_RESET_MS);
  }
}
