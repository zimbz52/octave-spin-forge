// Shared audio math used across both the system and theme Howler instances.

// Decibels (a log scale) to the linear gain Howler's volume()/fade() actually expect.
export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

// Used by parseBpmFromPath() below whenever a source path has no BPM embedded in its
// filename — true of every theme's bank today (each is one shared spritesheet file,
// e.g. "arcadeSounds.mp3", not a per-track file named with its tempo).
export const DEFAULT_BPM = 120;

// Extracts a BPM from an audio source path/filename, e.g. "musicMain_124.mp3" -> 124
// — looks for a 2-3 digit number immediately before the extension, conventionally
// separated from the rest of the name by "_" or "-". Falls back to DEFAULT_BPM if no
// such number is found.
export function parseBpmFromPath(path) {
  if (!path) return DEFAULT_BPM;
  const match = path.match(/[_-](\d{2,3})(?=\.[a-z0-9]+$)/i);
  return match ? Number(match[1]) : DEFAULT_BPM;
}

// The BPM embedded directly in a music sprite's own name, e.g. "musicMain_114" -> 114
// — the convention Arcade's v02 bank introduced (per-sprite, not per-file). Returns
// null (not DEFAULT_BPM) if the name has no such suffix, e.g. the plain "musicMain",
// so callers can tell "no BPM here" apart from "this sprite really is 120 BPM" and
// fall back to parseBpmFromPath()/DEFAULT_BPM themselves.
export function bpmFromSpriteName(name) {
  const match = name.match(/_(\d{2,3})$/);
  return match ? Number(match[1]) : null;
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
