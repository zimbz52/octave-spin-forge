// Shared audio math used across both the system and theme Howler instances.

// Decibels (a log scale) to the linear gain Howler's volume()/fade() actually expect.
export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

// Explicitly resumes the shared Howler AudioContext if it's suspended (the state
// every browser starts it in until a genuine user gesture arrives). Howler already
// does this automatically on its own first-gesture listeners, so this is normally
// redundant — but the welcome screen's whole reason for existing is to *be* that
// first gesture as deliberately and immediately as possible, not to rely on whichever
// element happens to get clicked first. Safe to call from anywhere, any number of
// times: no-ops if Howler hasn't constructed a context yet (nothing to resume) or if
// it's already running.
export function unlockAudioContext() {
  if (window.Howler && Howler.ctx && Howler.ctx.state === "suspended") {
    Howler.ctx.resume();
  }
}
