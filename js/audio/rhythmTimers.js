// A tiny registry for setTimeout delays used specifically to snap audio/visual events
// onto a musical grid (Turbo reel stops, Big Win anticipation — see ThemeAudio.js/
// GameController.js). Exists so backgroundGuard.js can flush every pending one the
// instant the tab is hidden, rather than letting the browser's background-tab timer
// throttling delay them arbitrarily (sometimes by seconds) and have them all land in
// a jarring burst the moment the player returns. Not for general-purpose timers —
// only ones whose delay exists to hit a precise musical moment.
const pendingTimers = new Map(); // real setTimeout id -> callback

export function setRhythmTimeout(callback, delayMs) {
  const id = setTimeout(() => {
    pendingTimers.delete(id);
    callback();
  }, delayMs);
  pendingTimers.set(id, callback);
  return id;
}

// Runs every pending rhythmic timer's callback immediately and cancels its real
// setTimeout, rather than silently dropping it — the underlying game action (a reel
// locking into place, a Big Win entering) still needs to happen even though the tab
// is hidden; only the "wait for the precise beat-aligned millisecond" nicety is
// skipped, since nothing about that would be perceptible while backgrounded anyway.
export function flushAllRhythmTimers() {
  const pending = [...pendingTimers.entries()];
  pendingTimers.clear();
  pending.forEach(([id, callback]) => {
    clearTimeout(id);
    callback();
  });
}
