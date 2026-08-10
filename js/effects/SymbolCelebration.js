// Each reel clips its strip with overflow:hidden (so scrolling filler symbols don't
// spill out during a spin) — which means a winning symbol can't just scale past 100%
// in place, it'd get cut off at the reel's edge. To let it genuinely "break the plane"
// of the reel, we clone it into an unclipped, absolute-position overlay matched to its
// exact document position, animate the clone there, then swap back to the original.
export class SymbolCelebration {
  constructor(overlayEl) {
    this.overlayEl = overlayEl;
  }

  // Resolves once the celebration animation finishes and the original symbol is
  // visible again.
  celebrate(symbolEl) {
    return new Promise((resolve) => {
      // getBoundingClientRect() is viewport-relative; the overlay is positioned
      // absolute (document-relative), so scroll offset has to be added in by hand —
      // otherwise the clone would render offset by however far the page had scrolled,
      // and visibly drift away from the real symbol if the page scrolled again while
      // it was animating (it's fixed in the DOM the instant it's created, mid-scroll).
      const rect = symbolEl.getBoundingClientRect();
      const left = rect.left + window.scrollX;
      const top = rect.top + window.scrollY;
      const clone = symbolEl.cloneNode(true);
      clone.classList.add("symbol--celebrating");
      clone.style.position = "absolute";
      clone.style.left = `${left}px`;
      clone.style.top = `${top}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
      clone.style.margin = "0";

      symbolEl.style.visibility = "hidden";
      this.overlayEl.appendChild(clone);

      // Scale up, glow, and twitch (a couple of small over-rotations) before settling.
      const anim = clone.animate(
        [
          { transform: "scale(1) rotate(0deg)", filter: "brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0))" },
          {
            transform: "scale(1.32) rotate(-3deg)",
            filter: "brightness(1.6) drop-shadow(0 0 20px rgba(255,255,255,0.9))",
            offset: 0.3,
          },
          {
            transform: "scale(1.12) rotate(3deg)",
            filter: "brightness(1.35) drop-shadow(0 0 14px rgba(212,175,55,0.85))",
            offset: 0.5,
          },
          {
            transform: "scale(1.24) rotate(-2deg)",
            filter: "brightness(1.5) drop-shadow(0 0 18px rgba(212,175,55,0.9))",
            offset: 0.7,
          },
          {
            transform: "scale(1) rotate(0deg)",
            filter: "brightness(1) drop-shadow(0 0 0 rgba(212,175,55,0))",
            offset: 1,
          },
        ],
        { duration: 650, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
      );

      const finish = () => {
        clone.remove();
        symbolEl.style.visibility = "";
        resolve();
      };

      anim.finished.then(finish).catch(finish);
    });
  }
}
