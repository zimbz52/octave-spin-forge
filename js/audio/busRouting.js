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
  { bus: "busWinsSmall", test: (name) => name.startsWith("winSmall") },
  // winSymbol01-04/winSymbolWild/winSymbolScatter (the symbol04 legacy fallback, see
  // ThemeAudio.playSymbolWin) all share this one bus — same "symbol-specific win" role.
  { bus: "busWinsSymbol", test: (name) => name.startsWith("winSymbol") },
  // winBigRiser/winBigRiserEnd/winBigT1 plus powerBetOn/powerBetOff — everything tied
  // to the Grand Win / Powerbet climax shares one bus.
  { bus: "busWinsBig", test: (name) => name.startsWith("winBig") || name.startsWith("powerBet") },
];

export const BUS_NAMES = BUS_RULES.map((rule) => rule.bus);

// Returns the bus a given sprite name belongs to, or null if it doesn't match any
// known family (e.g. a future sprite added without a corresponding rule here).
export function getBusForSprite(name) {
  const rule = BUS_RULES.find((r) => r.test(name));
  return rule ? rule.bus : null;
}
