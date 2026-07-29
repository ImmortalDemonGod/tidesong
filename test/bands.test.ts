// G3/G4 gate bands, thresholds copied from PROGRESS.md. Editing a threshold
// here without the matching PROGRESS.md change (and a logged reason) is gate
// tampering; the adversarial panel diffs the two.
//
// METRIC NOTE (00:55, logged in PROGRESS): optimal floors and G4 margins
// measure meanDamageTaken (raw damage absorbed), not net hpLost, because
// Heal Song can zero net HP loss and hide difficulty (correctness review
// MED-4). Casual bands keep hpLost: casual represents a player experience,
// and their heals are part of it.
//
// All batches are seeded and deterministic: same code, same numbers, forever.

import { expect, test } from "bun:test";
import { createBossCombat } from "../src/game";
import {
  ABILITY_KEYS,
  NO_CONDITION_KEYS,
  casualBot,
  optimalBot,
  runBatch,
  spamBot,
} from "./bots";

const casual = runBatch((seed) => casualBot(seed));
const optimal = runBatch(() => optimalBot());
const noCond = runBatch(() => optimalBot(NO_CONDITION_KEYS));
const blindOnly = runBatch(() => optimalBot(ABILITY_KEYS.filter((k) => k !== "finSlash")));
const slowOnly = runBatch(() => optimalBot(ABILITY_KEYS.filter((k) => k !== "siltBurst")));
const spams = ABILITY_KEYS.map((k) => ({ key: k, stats: runBatch(() => spamBot(k)) }));

const bossCasual = runBatch((seed) => casualBot(seed), createBossCombat);
const bossOptimal = runBatch(() => optimalBot(), createBossCombat);
const bossNoCond = runBatch(() => optimalBot(NO_CONDITION_KEYS), createBossCombat);
const bossSpams = ABILITY_KEYS.map((k) => ({
  key: k,
  stats: runBatch(() => spamBot(k), createBossCombat),
}));

// ---------- G3: difficulty band (regular encounter: vampire squid) ----------

test("G3: casual bot win rate 60 to 90 percent", () => {
  expect(casual.winRate).toBeGreaterThanOrEqual(0.6);
  expect(casual.winRate).toBeLessThanOrEqual(0.9);
});

test("G3: casual bot mean fight length 4 to 15 turns", () => {
  expect(casual.meanTurns).toBeGreaterThanOrEqual(4);
  expect(casual.meanTurns).toBeLessThanOrEqual(15);
});

test("G3: optimal bot averages at least 4 turns and absorbs at least 10 percent damage", () => {
  expect(optimal.meanTurns).toBeGreaterThanOrEqual(4);
  expect(optimal.meanDamageTaken).toBeGreaterThanOrEqual(10);
});

// ---------- G4: no dominant strategy ----------

test("G4: every single-ability spam bot underperforms mixed by 10 win points or 20 percent more damage", () => {
  for (const { key, stats } of spams) {
    const winGap = optimal.winRate - stats.winRate;
    const hpRatio = stats.meanDamageTaken / optimal.meanDamageTaken;
    const underperforms = winGap >= 0.1 || hpRatio >= 1.2;
    if (!underperforms) {
      throw new Error(
        `spam ${key} does not underperform: winGap ${winGap.toFixed(3)}, hpRatio ${hpRatio.toFixed(2)}`,
      );
    }
    expect(underperforms).toBe(true);
  }
});

test("G4: ignoring conditions costs at least 20 percent more damage", () => {
  expect(noCond.meanDamageTaken).toBeGreaterThanOrEqual(optimal.meanDamageTaken * 1.2);
});

test("G4: blind individually pays for its cost (blind-only beats no-conditions by 20 percent)", () => {
  expect(blindOnly.meanDamageTaken).toBeLessThanOrEqual(noCond.meanDamageTaken * 0.8);
});

test("G4: slow individually pays for its cost (slow-only beats no-conditions by 20 percent)", () => {
  expect(slowOnly.meanDamageTaken).toBeLessThanOrEqual(noCond.meanDamageTaken * 0.8);
});

// ---------- G3/G4: boss encounter (corrupted shark) ----------
// Boss bands added 00:40 with logged reason (see PROGRESS.md G3): a climax
// fight punishes random play harder and runs longer than a regular fight.

test("G3 boss: casual win rate 30 to 75 percent", () => {
  expect(bossCasual.winRate).toBeGreaterThanOrEqual(0.3);
  expect(bossCasual.winRate).toBeLessThanOrEqual(0.75);
});

test("G3 boss: casual mean fight length 6 to 26 turns", () => {
  expect(bossCasual.meanTurns).toBeGreaterThanOrEqual(6);
  expect(bossCasual.meanTurns).toBeLessThanOrEqual(26);
});

test("G3 boss: optimal absorbs at least 20 percent damage over at least 4 turns", () => {
  expect(bossOptimal.meanTurns).toBeGreaterThanOrEqual(4);
  expect(bossOptimal.meanDamageTaken).toBeGreaterThanOrEqual(20);
});

test("G4 boss: every spam bot underperforms mixed play", () => {
  for (const { key, stats } of bossSpams) {
    const winGap = bossOptimal.winRate - stats.winRate;
    const hpRatio = stats.meanDamageTaken / bossOptimal.meanDamageTaken;
    const underperforms = winGap >= 0.1 || hpRatio >= 1.2;
    if (!underperforms) {
      throw new Error(
        `boss spam ${key}: winGap ${winGap.toFixed(3)}, hpRatio ${hpRatio.toFixed(2)}`,
      );
    }
    expect(underperforms).toBe(true);
  }
});

test("G4 boss: ignoring conditions costs at least 20 percent more damage", () => {
  expect(bossNoCond.meanDamageTaken).toBeGreaterThanOrEqual(bossOptimal.meanDamageTaken * 1.2);
});
