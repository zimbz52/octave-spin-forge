// Shared audio math used across both the system and theme Howler instances.

// Decibels (a log scale) to the linear gain Howler's volume()/fade() actually expect.
export function dbToGain(db) {
  return Math.pow(10, db / 20);
}
