const POLL_INTERVAL_MS = 200;
// Must match the CSS transition duration on .audio-profiler__row--leaving.
const EXIT_ANIMATION_MS = 260;

// A passive readout, nothing more — polls Howler's own internal `_sounds` arrays (there
// is no dedicated "now playing" API) for each given bank and renders one row per
// actively-playing sound. Never calls into any audio API; only ever reads state.
export class AudioProfiler {
  // sources: [{ tag: "SYS", getHowl: () => systemAudio.howl }, ...] — a function per
  // bank rather than a direct Howl reference, since ThemeAudio's `.howl` is torn down
  // and replaced on every theme switch.
  constructor(panelEl, listEl, emptyEl, sources) {
    this.panelEl = panelEl;
    this.listEl = listEl;
    this.emptyEl = emptyEl;
    this.sources = sources;
    this.rows = new Map(); // "<tag>:<soundId>" -> { el, leaving }
    this._timer = null;
  }

  start() {
    if (this._timer) return;
    this._tick();
    this._timer = setInterval(() => this._tick(), POLL_INTERVAL_MS);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  _collectActive() {
    const active = new Map();
    this.sources.forEach(({ tag, getHowl }) => {
      const howl = getHowl();
      if (!howl || !howl._sounds) return;
      howl._sounds.forEach((sound) => {
        if (sound._paused) return;
        active.set(`${tag}:${sound._id}`, {
          tag,
          name: sound._sprite || "?",
          volume: typeof sound._volume === "number" ? sound._volume : 1,
          muted: !!sound._muted,
        });
      });
    });
    return active;
  }

  _tick() {
    const active = this._collectActive();

    // Sounds that stopped since the last tick fade off rather than vanishing instantly.
    this.rows.forEach((row, key) => {
      if (active.has(key) || row.leaving) return;
      row.leaving = true;
      row.el.classList.remove("audio-profiler__row--active");
      row.el.classList.add("audio-profiler__row--leaving");
      setTimeout(() => {
        row.el.remove();
        this.rows.delete(key);
      }, EXIT_ANIMATION_MS);
    });

    active.forEach((info, key) => {
      let row = this.rows.get(key);
      if (!row) {
        const el = document.createElement("div");
        el.className = "audio-profiler__row";
        // The tag slot (SYS/THEME) is intentionally left blank for now — reserved for
        // something more useful than the bank name, not removed from the layout.
        el.innerHTML = `
          <span class="audio-profiler__row-tag"></span>
          <span class="audio-profiler__row-name"></span>
          <span class="audio-profiler__row-meter"><span class="audio-profiler__row-meter-fill"></span></span>
        `;
        this.listEl.appendChild(el);
        row = { el, leaving: false };
        this.rows.set(key, row);
        // Added on the next frame so the class change is a genuine transition, not the
        // element's very first paint (which wouldn't animate).
        requestAnimationFrame(() => el.classList.add("audio-profiler__row--active"));
      }

      row.el.querySelector(".audio-profiler__row-name").textContent = info.name;
      row.el.querySelector(".audio-profiler__row-meter-fill").style.width =
        `${Math.round(Math.max(0, Math.min(1, info.volume)) * 100)}%`;
      row.el.classList.toggle("audio-profiler__row--muted", info.muted);
    });

    this.emptyEl.hidden = this.rows.size > 0;
    this.panelEl.classList.toggle("audio-profiler--silenced", !!(window.Howler && Howler._muted));
  }
}
