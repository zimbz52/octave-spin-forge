import { THEMES } from "./themeRegistry.js";

// The gatekeeper screen: a text-only overlay that fully covers the cabinet until the
// player picks a theme. Its click/keypress doubles as the guaranteed first user gesture
// browsers require before any audio can play. Its rows carry the same generic
// data-sfx-hover/data-sfx-click UI sfx as the rest of the app (systemAudio's uiHover/
// uiClick, wired by main.js) — systemAudio is a separate Howl from the theme bank this
// screen exists to gate, so playing those doesn't compromise the "no theme audio before
// selection" rule. Renders its rows from THEMES, so it scales to however many themes
// exist without any changes here.
export class StartupTerminal {
  constructor(rootEl, listEl) {
    this.rootEl = rootEl;
    this.listEl = listEl;
  }

  render() {
    this.listEl.innerHTML = "";
    THEMES.forEach((theme, index) => {
      const item = document.createElement("li");
      item.className = "startup-terminal__item";
      item.setAttribute("role", "option");
      item.setAttribute("tabindex", "0");
      item.setAttribute("data-sfx-hover", "");
      item.setAttribute("data-sfx-click", "");
      item.dataset.themeId = theme.id;
      item.innerHTML = `
        <span class="startup-terminal__item-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="startup-terminal__item-label">${theme.label}</span>
        <span class="startup-terminal__item-arrow" aria-hidden="true">&gt;</span>
      `;
      this.listEl.appendChild(item);
    });
  }

  // Resolves with the chosen theme id on the first click or Enter/Space on a row. This
  // is a separate listener from the data-sfx-click wiring above — both fire off the same
  // native click, one plays a sound, this one drives the actual selection/transition.
  waitForSelection() {
    return new Promise((resolve) => {
      const settle = (themeId) => {
        this.listEl.removeEventListener("click", onClick);
        this.listEl.removeEventListener("keydown", onKeydown);
        resolve(themeId);
      };
      const onClick = (event) => {
        const item = event.target.closest(".startup-terminal__item");
        if (!item) return;
        settle(item.dataset.themeId);
      };
      const onKeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const item = event.target.closest(".startup-terminal__item");
        if (!item) return;
        event.preventDefault();
        settle(item.dataset.themeId);
      };
      this.listEl.addEventListener("click", onClick);
      this.listEl.addEventListener("keydown", onKeydown);
    });
  }

  // Permanent — once dismissed, the terminal never comes back for the rest of the session.
  dismiss() {
    this.rootEl.remove();
  }
}
