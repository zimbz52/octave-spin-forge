// A continuous burst of coins erupting from the center of the big win widget and
// falling past the bottom of the screen. Purely a cosmetic particle effect — the
// randomness here has nothing to do with spin outcomes (those stay fully
// deterministic), it's just trajectory variation so the fountain doesn't look
// mechanically identical coin after coin.
const SPAWN_INTERVAL_MS = 200;
const COINS_PER_BURST = [5, 8]; // inclusive min/max

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export class CoinFountain {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.intervalId = null;
    this.activeCoins = new Set();
  }

  start() {
    this.stop();

    const spawnBurst = () => {
      const count = Math.round(randomBetween(COINS_PER_BURST[0], COINS_PER_BURST[1]));
      for (let i = 0; i < count; i++) this._spawnCoin();
    };

    spawnBurst();
    this.intervalId = setInterval(spawnBurst, SPAWN_INTERVAL_MS);
  }

  // Stops spawning and immediately clears every coin currently in flight — an
  // outright hard stop, used for dismissal (Collect / backdrop click), where the
  // whole widget is going away and lingering coins shouldn't survive it.
  stop() {
    this.stopSpawning();
    this.activeCoins.forEach((coin) => coin.remove());
    this.activeCoins.clear();
  }

  // Stops spawning NEW coins but leaves whatever's already in flight alone — their
  // own fall animations (already running, see _spawnCoin()) carry them the rest of
  // the way off the bottom of the screen and clean themselves up via anim.finished,
  // same as always ("gravity bleed": no instant destroy). Used at the exact instant
  // the win counter settles (see WinCounter.rollUp()'s onClimaxSettle), as opposed
  // to stop() above.
  stopSpawning() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  _spawnCoin() {
    const coin = document.createElement("div");
    coin.className = "coin-fountain__coin";

    const size = randomBetween(12, 22);
    const originXPct = randomBetween(-6, 6); // small horizontal jitter around center
    const burstX = randomBetween(-60, 60); // px, initial upward-burst drift
    const burstUp = randomBetween(70, 150); // px, how high the initial burst goes
    const fallDriftX = burstX + randomBetween(-80, 80); // continues drifting as it falls
    const fallDistance = window.innerHeight * randomBetween(0.75, 1.15);
    const spin = (Math.random() < 0.5 ? -1 : 1) * randomBetween(320, 760);
    const duration = randomBetween(1600, 2600);
    const delay = randomBetween(0, 120);

    coin.style.width = `${size}px`;
    coin.style.height = `${size}px`;
    coin.style.marginLeft = `${-size / 2}px`;
    coin.style.marginTop = `${-size / 2}px`;
    coin.style.left = `calc(50% + ${originXPct}%)`;

    this.containerEl.appendChild(coin);
    this.activeCoins.add(coin);

    const anim = coin.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 0 },
        { transform: `translate(${burstX * 0.5}px, ${-burstUp}px) rotate(${spin * 0.25}deg)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${fallDriftX}px, ${fallDistance}px) rotate(${spin}deg)`, opacity: 1, offset: 0.88 },
        { transform: `translate(${fallDriftX}px, ${fallDistance + 30}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration, delay, easing: "cubic-bezier(0.32, 0, 0.67, 1)" }
    );

    const cleanup = () => {
      coin.remove();
      this.activeCoins.delete(coin);
    };
    anim.finished.then(cleanup).catch(cleanup);
  }
}
