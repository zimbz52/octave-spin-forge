// The master audio gate: a full-screen overlay that loads before even the startup
// terminal, so the very first thing a player can do on this page is the one deliberate
// click that unlocks audio. Sits above the terminal (z-index 400 vs 300) and simply
// covers it until dismissed — the terminal underneath is already rendered and wired,
// this just blocks it from being reachable a moment longer.
export class WelcomeScreen {
  constructor(rootEl, startBtnEl) {
    this.rootEl = rootEl;
    this.startBtnEl = startBtnEl;
  }

  // Resolves once the player clicks (or Enter/Space-activates) the start button.
  waitForStart() {
    return new Promise((resolve) => {
      const settle = () => {
        this.startBtnEl.removeEventListener("click", onClick);
        resolve();
      };
      const onClick = () => settle();
      this.startBtnEl.addEventListener("click", onClick);
    });
  }

  // Fades out over the CSS transition, then permanently removes itself — never comes
  // back for the rest of the session, same as the terminal.
  dismiss() {
    return new Promise((resolve) => {
      const onEnd = (event) => {
        if (event.propertyName !== "opacity") return;
        this.rootEl.removeEventListener("transitionend", onEnd);
        this.rootEl.remove();
        resolve();
      };
      this.rootEl.addEventListener("transitionend", onEnd);
      this.rootEl.classList.add("welcome-screen--fading");
    });
  }
}
