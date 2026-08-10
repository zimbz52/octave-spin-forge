// Drives the glowing "win line" that sweeps across the reels' middle row, connecting
// the 3 winning symbols. All 3 payline symbols sit at the same height across every
// reel, so a single horizontal line spanning the full width does the job.
export class WinLineController {
  constructor(lineEl) {
    this.lineEl = lineEl;
  }

  // Instantly hides the line with no animation — used when a new spin starts, in
  // case a previous win's line hadn't finished fading yet.
  reset() {
    this.lineEl.style.transition = "none";
    this.lineEl.style.transform = "translateY(-50%) scaleX(0)";
    this.lineEl.style.opacity = "0";
  }

  // Aligns the line's vertical center to a payline symbol's actual on-screen center.
  // A plain CSS `top: 50%` looked close but was consistently a few px off — the
  // reel's own box height (set from measured content) doesn't leave room for its own
  // padding, so the reel box's midpoint doesn't quite land on the visible symbols'
  // midpoint. Measuring the real symbol rect sidesteps that entirely.
  alignTo(symbolEl) {
    const symbolRect = symbolEl.getBoundingClientRect();
    const containerRect = this.lineEl.parentElement.getBoundingClientRect();
    const centerY = symbolRect.top + symbolRect.height / 2 - containerRect.top;
    this.lineEl.style.top = `${centerY}px`;
  }

  // Rapidly draws the line from nothing to fully connecting all 3 reels. Resolves
  // once it's fully extended.
  dash(symbolEl) {
    return new Promise((resolve) => {
      this.alignTo(symbolEl);
      this.reset();
      void this.lineEl.offsetWidth; // force reflow so the reset above isn't animated

      // Linear, and driving only scaleX (opacity is on from frame one) — a strong
      // ease-out here front-loads almost the entire sweep into the first couple of
      // frames, which reads as an instant pop instead of a visible fast draw.
      const anim = this.lineEl.animate(
        [
          { transform: "translateY(-50%) scaleX(0)", opacity: 1 },
          { transform: "translateY(-50%) scaleX(1)", opacity: 1 },
        ],
        { duration: 200, easing: "linear", fill: "forwards" }
      );

      anim.finished
        .then(() => {
          anim.cancel();
          this.lineEl.style.transform = "translateY(-50%) scaleX(1)";
          this.lineEl.style.opacity = "1";
          resolve();
        })
        .catch(() => resolve());
    });
  }

  // Fades the line back out once the celebration has run its course.
  hide() {
    return new Promise((resolve) => {
      const anim = this.lineEl.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 300,
        easing: "ease-in",
        fill: "forwards",
      });

      anim.finished
        .then(() => {
          anim.cancel();
          this.lineEl.style.opacity = "0";
          resolve();
        })
        .catch(() => resolve());
    });
  }
}
