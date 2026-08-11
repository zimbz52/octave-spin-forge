// Single source of truth mapping a Howler sprite name to its dev-mixer "bus" — used by
// ThemeAudio (to look up a per-theme gain multiplier whenever a sprite plays) and by
// DevMixerPanel (to know which buses exist and render one slider per bus). Prefix-based
// since indexed sprite variants (reelStart01-05, winSmall01-04, etc.) all belong to the
// same bus as their un-indexed family — adding a new indexed sprite to an existing
// family (e.g. a 6th reelStart) needs no change here.
const BUS_RULES = [
  { bus: "busReelsTurbo", test: (name) => name.startsWith("reelTurbo") },
  { bus: "busReelsNormal", test: (name) => name.startsWith("reelStart") || name.startsWith("reelStop") },
  { bus: "busMusic", test: (name) => name === "musicMain" },
  { bus: "busAtmosphere", test: (name) => name === "gameAmbLP" || name === "gameStart" },
  // winSmall01-04 (the flavor layer) and winSmallDigits/winSmallDigitsEnd (the counter
  // roll-up bed + its completion sting, see "Adding China" below) share this bus — both
  // are "small win" audio, just different roles within it.
  { bus: "busWinsSmall", test: (name) => name.startsWith("winSmall") },
  // winSymbol01-04/winSymbolWild/winSymbolScatter (the symbol04 legacy fallback, see
  // ThemeAudio.playSymbolWin) all share this one bus — same "symbol-specific win" role.
  { bus: "busWinsSymbol", test: (name) => name.startsWith("winSymbol") },
  // winBigRiser/winBigRiserEnd/winBigT1 — the Grand Win climax only, now that Powerbet
  // has its own dedicated bus below rather than sharing this one.
  { bus: "busWinsBig", test: (name) => name.startsWith("winBig") },
  // powerBetOn/powerBetOff split out from busWinsBig into their own bus — the toggle's
  // on/off cue is a distinct, player-facing control sound, not part of the win climax.
  { bus: "busPowerBet", test: (name) => name.startsWith("powerBet") },
];

export const BUS_NAMES = BUS_RULES.map((rule) => rule.bus);

// Returns the bus a given sprite name belongs to, or null if it doesn't match any
// known family (e.g. a future sprite added without a corresponding rule here).
export function getBusForSprite(name) {
  const rule = BUS_RULES.find((r) => r.test(name));
  return rule ? rule.bus : null;
}
