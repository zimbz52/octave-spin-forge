// Deterministic outcome system — NO RNG. Every spin's result comes from a fixed,
// cyclical sequence so every symbol and win tier gets showcased in a predictable order.

export const SYMBOL_META = {
  symbol01: { className: "symbol--01", label: "01" },
  symbol02: { className: "symbol--02", label: "02" },
  symbol03: { className: "symbol--03", label: "03" },
  wild: { className: "symbol--wild", label: "WILD" },
  scatter: { className: "symbol--scatter", label: "SCATTER" },
};

export const SYMBOLS = Object.keys(SYMBOL_META);

// The 4 small-win tiers that make up the base deterministic loop. The asset pipeline
// is fixed at 5 generic symbols (Symbol01-03, Wild, Scatter) — there's no "Symbol04" —
// so the 4th small win stands in as a Wild-assist combo instead of a 4th plain symbol.
// winAmount is hardcoded per tier (no RNG), fed straight into the win counter roll-up.
export const SMALL_WIN_TIERS = [
  { id: "small1", label: "Small Win — Symbol01 x3", payline: ["symbol01", "symbol01", "symbol01"], winAmount: 50 },
  { id: "small2", label: "Small Win — Symbol02 x3", payline: ["symbol02", "symbol02", "symbol02"], winAmount: 90 },
  { id: "small3", label: "Small Win — Symbol03 x3", payline: ["symbol03", "symbol03", "symbol03"], winAmount: 130 },
  { id: "small4", label: "Small Win — Wild Assist", payline: ["wild", "symbol01", "symbol01"], winAmount: 200 },
];

// Forced-only outcome — never appears in the natural cycle, only via the "Force Big
// Win" debug button. A full 9-tile blackout of a single symbol, top to bottom.
const BIG_WIN_AMOUNT = 25000;

// SYMBOL_META's label is the short on-tile text ("01", "WILD") — fine on a symbol
// itself, but "GRAND WIN — 01 Blackout!" reads oddly. This mirrors the small-win
// tiers' "Symbol01 x3" convention for a proper win-tier label.
const SYMBOL_DISPLAY_NAME = {
  symbol01: "Symbol01",
  symbol02: "Symbol02",
  symbol03: "Symbol03",
  wild: "Wild",
  scatter: "Scatter",
};

// Every big win can land on any of the 5 symbols, but not with equal weight: Scatter
// is deliberately the most frequent, cycling deterministically (no RNG) as
// Scatter, any, any, Scatter, any, any, ... The "any" slots cycle through the 4
// non-Scatter symbols in order rather than repeating one.
const BIG_WIN_NON_SCATTER_SYMBOLS = ["symbol01", "symbol02", "symbol03", "wild"];

// Hardcoded non-matching paylines for loss spins, cycled deterministically.
const LOSS_PATTERNS = [
  ["symbol01", "symbol02", "symbol03"],
  ["symbol02", "wild", "scatter"],
  ["symbol03", "symbol01", "wild"],
  ["scatter", "symbol02", "symbol01"],
];

// Derives the non-payline (top/bottom) symbols for each reel, deterministically —
// no randomness involved. The reel index is folded into the offset so that when a
// win repeats the same symbol across all 3 reels (e.g. the Wild-assist combo), the
// top and bottom rows still vary per reel instead of lining up into their own win.
function buildReelTargets(payline) {
  return payline.map((sym, reelIndex) => {
    const idx = SYMBOLS.indexOf(sym);
    const top = SYMBOLS[(idx + 1 + reelIndex) % SYMBOLS.length];
    const bottom = SYMBOLS[(idx + 3 + reelIndex) % SYMBOLS.length];
    return [top, sym, bottom];
  });
}

// Hardcoded pattern: 2 losses, then 1 small win, cycling through all 4 small-win
// tiers, then looping forever — exactly: Loss, Loss, Small1, Loss, Loss, Small2,
// Loss, Loss, Small3, Loss, Loss, Small4, Loss, Loss, Small1, ...
const SPIN_SEQUENCE = [];
SMALL_WIN_TIERS.forEach((tier) => {
  SPIN_SEQUENCE.push("loss", "loss", tier.id);
});

function buildBlackoutOutcome(symbolId) {
  const payline = [symbolId, symbolId, symbolId];
  const tier = {
    id: `big_blackout_${symbolId}`,
    label: `GRAND WIN — ${SYMBOL_DISPLAY_NAME[symbolId]} Blackout!`,
    size: "big",
    winAmount: BIG_WIN_AMOUNT,
  };
  return {
    isWin: true,
    isBlackout: true,
    tier,
    payline,
    reelTargets: [
      [symbolId, symbolId, symbolId],
      [symbolId, symbolId, symbolId],
      [symbolId, symbolId, symbolId],
    ],
  };
}

class SpinSequencer {
  constructor() {
    this.spinIndex = 0;
    this.lossIndex = 0;
    this.forcedOutcome = null;
    this._bigWinCount = 0; // how many big wins have been armed so far
    this._bigWinAnyIndex = 0; // position within the non-Scatter cycle
  }

  // Deterministic Scatter/any/any cadence: the 1st, 4th, 7th, ... big win is Scatter;
  // the rest cycle through the 4 non-Scatter symbols in order.
  _nextBigWinSymbol() {
    const isScatterTurn = this._bigWinCount % 3 === 0;
    this._bigWinCount += 1;
    if (isScatterTurn) return "scatter";
    const symbol = BIG_WIN_NON_SCATTER_SYMBOLS[this._bigWinAnyIndex % BIG_WIN_NON_SCATTER_SYMBOLS.length];
    this._bigWinAnyIndex += 1;
    return symbol;
  }

  // Debug hook: arms a forced outcome for the very next spin only. Doesn't touch the
  // underlying loss/small-win indices, so the deterministic cycle resumes exactly
  // where it left off once the forced spin is consumed.
  forceBigWinNext() {
    this.forcedOutcome = buildBlackoutOutcome(this._nextBigWinSymbol());
  }

  isForceArmed() {
    return this.forcedOutcome !== null;
  }

  next() {
    if (this.forcedOutcome) {
      const outcome = this.forcedOutcome;
      this.forcedOutcome = null;
      return outcome;
    }

    const key = SPIN_SEQUENCE[this.spinIndex % SPIN_SEQUENCE.length];
    this.spinIndex += 1;

    if (key === "loss") {
      const payline = LOSS_PATTERNS[this.lossIndex % LOSS_PATTERNS.length];
      this.lossIndex += 1;
      return {
        isWin: false,
        isBlackout: false,
        tier: null,
        payline,
        reelTargets: buildReelTargets(payline),
      };
    }

    const tier = SMALL_WIN_TIERS.find((t) => t.id === key);
    return {
      isWin: true,
      isBlackout: false,
      tier,
      payline: tier.payline,
      reelTargets: buildReelTargets(tier.payline),
    };
  }
}

export const spinSequencer = new SpinSequencer();

// Static resting grid shown before the first spin. Doesn't touch the sequencer's
// counters, so the deterministic sequence still starts at Spin 1 on first click.
export function getInitialDisplay() {
  return { reelTargets: buildReelTargets(LOSS_PATTERNS[0]) };
}
