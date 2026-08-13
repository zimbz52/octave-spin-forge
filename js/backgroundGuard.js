import { flushAllRhythmTimers } from "./audio/rhythmTimers.js";
import { themeAudio } from "./audio/ThemeAudio.js";

// Protects rhythm-quantized timers (Turbo reel-stop snaps, Big Win anticipation
// delays — see rhythmTimers.js) and reel spin animations from browser background-tab
// throttling: a hidden tab can delay a setTimeout by seconds, or keep a CSS animation
// silently running the whole time it's not visible, either of which reads as a
// jarring desync the instant the player tabs back in.
//
// Deliberately does NOT touch Howler.mute() — main.js's wireAudioControls() already
// mutes/unmutes on visibilitychange (layered with the user's own manual Master Mute
// toggle via its windowActive/masterMuted combination). Duplicating that here would
// risk a second, cruder mute call incorrectly overriding the user's manual
// preference the instant the tab becomes visible again.
export function wireBackgroundGuard(game) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      flushAllRhythmTimers();
      game.pauseAllReelAnimations();
    } else {
      game.resumeAllReelAnimations();
      // Corrects any drift in musicMain/musicIntense's live volume that crept in
      // while backgrounded (e.g. a crossfade's own setTimeout settle firing late) —
      // Howler's actual playback position is unaffected by JS throttling, only our
      // side's bookkeeping of it could have lagged.
      themeAudio.refreshMusicVolume();
    }
  });
}
