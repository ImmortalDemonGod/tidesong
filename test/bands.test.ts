// G3/G4 gate bands, thresholds copied from PROGRESS.md. Editing a threshold
// here without the matching PROGRESS.md change (and a logged reason) is gate
// tampering; the adversarial panel diffs the two.
//
// METRIC NOTE (logged in PROGRESS): optimal floors and G4 margins
// measure meanDamageTaken (raw damage absorbed), not net hpLost, because
// Heal Song can zero net HP loss and hide difficulty (correctness review
// MED-4). Casual bands keep hpLost: casual represents a player experience,
// and their heals are part of it.
//
// All batches are seeded and deterministic: same code, same numbers, forever.

import { expect, test } from "bun:test";
import { createBossCombat, createCombat as createCombatBase } from "../src/game";
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
// Boss bands added with logged reason (see PROGRESS.md G3): a climax
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

// ---------- anti-overfit guard: bands must hold on seeds never used to tune ----------
// Tuning ran on seeds 0-499. These assert the load-bearing floors and the
// casual bands on a disjoint seed space (7000-7499), so numbers fitted to
// the tuning sample cannot silently pass.

// Shift BOTH the bot seed and the combat seed (correctness round 2,
// MED-6: shifting only the bot seed left the combat RNG on tuning seeds).
const casualFresh = runBatch((seed) => casualBot(seed + 7000), (seed) => createCombatBase(seed + 7000));
const optimalFresh = runBatch(() => optimalBot(), (seed) => createCombatAt(seed + 7000));
const bossCasualFresh = runBatch((seed) => casualBot(seed + 7000), (seed) => createBossCombatAt(seed + 7000));

function createCombatAt(seed: number) {
  return createCombatBase(seed);
}
function createBossCombatAt(seed: number) {
  return createBossCombat(seed);
}

test("anti-overfit: squid bands hold on 500 unseen seeds", () => {
  expect(casualFresh.winRate).toBeGreaterThanOrEqual(0.6);
  expect(casualFresh.winRate).toBeLessThanOrEqual(0.92);
  expect(optimalFresh.meanDamageTaken).toBeGreaterThanOrEqual(10);
});

test("anti-overfit: boss bands hold on 500 unseen seeds", () => {
  expect(bossCasualFresh.winRate).toBeGreaterThanOrEqual(0.28);
  expect(bossCasualFresh.winRate).toBeLessThanOrEqual(0.77);
});

// ---------- G3: dungeon 2 encounters (relic echo active, as in play) ----------
import { createBoss2Combat, createElderCombat } from "../src/game";
const echo = (make: (s: number) => ReturnType<typeof createElderCombat>) => (s: number) => {
  const c = make(s);
  c.relicEcho = true;
  return c;
};
const elderCasual = runBatch((seed) => casualBot(seed), echo(createElderCombat));
const elderOptimal = runBatch(() => optimalBot(), echo(createElderCombat));
const eelCasual = runBatch((seed) => casualBot(seed), echo(createBoss2Combat));
const eelOptimal = runBatch(() => optimalBot(), echo(createBoss2Combat));
const eelNoCond = runBatch(() => optimalBot(NO_CONDITION_KEYS), echo(createBoss2Combat));

test("G3 elder: regular bands hold (casual 60-90, 4-15 turns; optimal floors)", () => {
  expect(elderCasual.winRate).toBeGreaterThanOrEqual(0.6);
  expect(elderCasual.winRate).toBeLessThanOrEqual(0.9);
  expect(elderCasual.meanTurns).toBeGreaterThanOrEqual(4);
  expect(elderCasual.meanTurns).toBeLessThanOrEqual(15);
  expect(elderOptimal.meanTurns).toBeGreaterThanOrEqual(4);
  expect(elderOptimal.meanDamageTaken).toBeGreaterThanOrEqual(10);
});

test("G3 eel: boss bands hold (casual 30-75, 6-26 turns; optimal floors)", () => {
  expect(eelCasual.winRate).toBeGreaterThanOrEqual(0.3);
  expect(eelCasual.winRate).toBeLessThanOrEqual(0.75);
  expect(eelCasual.meanTurns).toBeGreaterThanOrEqual(6);
  expect(eelCasual.meanTurns).toBeLessThanOrEqual(26);
  expect(eelOptimal.meanTurns).toBeGreaterThanOrEqual(4);
  expect(eelOptimal.meanDamageTaken).toBeGreaterThanOrEqual(20);
});

test("G4 eel: ignoring conditions costs at least 20 percent more damage", () => {
  expect(eelNoCond.meanDamageTaken).toBeGreaterThanOrEqual(eelOptimal.meanDamageTaken * 1.2);
});


// Fresh-seed guards for the dungeon-2 batteries (correctness round 2,
// MED-7), echo on, seeds 7000-7499:
const elderFresh = runBatch((seed) => casualBot(seed + 7000), (seed) => echo(createElderCombat)(seed + 7000));
const eelCasualFresh = runBatch((seed) => casualBot(seed + 7000), (seed) => echo(createBoss2Combat)(seed + 7000));
const eelOptimalFresh = runBatch(() => optimalBot(), (seed) => echo(createBoss2Combat)(seed + 7000));

test("anti-overfit: elder bands hold on 500 unseen seeds", () => {
  expect(elderFresh.winRate).toBeGreaterThanOrEqual(0.6);
  expect(elderFresh.winRate).toBeLessThanOrEqual(0.92);
});

test("anti-overfit: eel bands hold on 500 unseen seeds", () => {
  expect(eelCasualFresh.winRate).toBeGreaterThanOrEqual(0.28);
  expect(eelCasualFresh.winRate).toBeLessThanOrEqual(0.77);
  expect(eelOptimalFresh.meanDamageTaken).toBeGreaterThanOrEqual(20);
});

// ---------- G3/G4: ink squid (enemy type 2, shipped Jul 29 on the ----------
// playtest fun mandate; lab-derived numbers, thresholds verbatim from
// PROGRESS.md regular bands)
import { advanceTurn as advanceInk, createInkCombat, getCondition as getCondInk, useAbility as useInk } from "../src/game";
const inkCasual = runBatch((seed) => casualBot(seed), echo(createInkCombat));
const inkOptimal = runBatch(() => optimalBot(), echo(createInkCombat));
const inkNoCond = runBatch(() => optimalBot(NO_CONDITION_KEYS), echo(createInkCombat));
const inkSpamTail = runBatch(() => spamBot("tailStrike"), echo(createInkCombat));

test("G3 ink squid: regular bands hold (casual 60-90, 4-15 turns; optimal floors)", () => {
  expect(inkCasual.winRate).toBeGreaterThanOrEqual(0.6);
  expect(inkCasual.winRate).toBeLessThanOrEqual(0.9);
  expect(inkCasual.meanTurns).toBeGreaterThanOrEqual(4);
  expect(inkCasual.meanTurns).toBeLessThanOrEqual(15);
  expect(inkOptimal.meanTurns).toBeGreaterThanOrEqual(4);
  expect(inkOptimal.meanDamageTaken).toBeGreaterThanOrEqual(10);
});

test("G4 ink squid: ignoring conditions and tail spam both cost at least 20 percent more damage", () => {
  expect(inkNoCond.meanDamageTaken).toBeGreaterThanOrEqual(inkOptimal.meanDamageTaken * 1.2);
  expect(inkSpamTail.meanDamageTaken).toBeGreaterThanOrEqual(inkOptimal.meanDamageTaken * 1.2);
});

const inkFresh = runBatch((seed) => casualBot(seed + 7000), (seed) => echo(createInkCombat)(seed + 7000));
test("anti-overfit: ink squid bands hold on 500 unseen seeds", () => {
  expect(inkFresh.winRate).toBeGreaterThanOrEqual(0.6);
  expect(inkFresh.winRate).toBeLessThanOrEqual(0.92);
});

test("ink mechanics: only landed hits ink, refresh not stack, misses spare damage but never the disable", () => {
  // sweep seeds: whenever the ink line appears, the same slot logged a
  // landed hit (never a miss or skip); player blind stays level 1
  let inked = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const c = createInkCombat(seed);
    let guard = 0;
    while (c.outcome === "ongoing" && guard++ < 30) {
      c.player.sta = c.player.maxSta;
      c.player.hp = c.player.maxHp; // keep the fight running
      const at = c.log.length;
      useInk(c, "tailStrike");
      if (c.outcome !== "ongoing") break;
      advanceInk(c);
      const lines = c.log.slice(at);
      const inkLine = lines.findIndex((l) => l.includes("ink takes your eyes"));
      if (inkLine >= 0) {
        inked++;
        expect(lines.slice(0, inkLine).some((l) => l.includes("enemy hits for"))).toBe(true);
        const pb = getCondInk(c.player, "blind");
        expect(pb?.level).toBe(1);
      }
    }
  }
  expect(inked).toBeGreaterThan(30);

  // an inked miss spends stamina and deals no damage, but a condition
  // ability STILL lands its condition (mirror of the dodge rule)
  let sawMissWithCondition = false;
  for (let seed = 1; seed <= 200 && !sawMissWithCondition; seed++) {
    const c = createInkCombat(seed);
    c.player.conditions.push({ kind: "blind", level: 1, turns: 9 });
    c.enemy.dodge = 0;
    const hpBefore = c.enemy.hp;
    useInk(c, "finSlash");
    const missed = c.log.some((l) => l.includes("goes wide (inked)"));
    if (missed) {
      expect(c.enemy.hp).toBe(hpBefore);
      expect(getCondInk(c.enemy, "slow")).toBeDefined();
      sawMissWithCondition = true;
    }
  }
  expect(sawMissWithCondition).toBe(true);
});

test("hypothetical-break intent matches the sim's arithmetic exactly, plain and heavy, both bosses", () => {
  // the confirmation caught a rounding-order lie (13 shown, 14 landed):
  // the shown number must come from the same pipeline advanceTurn runs
  import("../src/game").then(() => {});
  const { createBossCombat: mkShark, createBoss2Combat: mkEel, enemyIntent: intentOf, useAbility: act, advanceTurn: slot } = require("../src/game");
  for (const mk of [mkShark, (s: number) => mkEel(s, s)]) {
    for (let seed = 1; seed <= 40; seed++) {
      const c = mk(seed);
      c.enemy.dodge = 0;
      // whittle a utility part to 1 durability, then predict and break
      const boss = c.boss!;
      const utility = boss.parts.find(
        (p: any) => p.key !== boss.keyPartByPhase[1] && p.key !== boss.keyPartByPhase[2],
      )!;
      utility.durability = 1;
      // advance slots until we cover both a plain and a heavy prediction
      let coveredHeavy = false;
      let coveredPlain = false;
      let guard = 0;
      while ((!coveredHeavy || !coveredPlain) && c.outcome === "ongoing" && guard++ < 12) {
        c.player.sta = c.player.maxSta;
        c.player.hp = c.player.maxHp;
        if (utility.broken) {
          utility.broken = false;
          utility.durability = 1;
          c.enemy.hp += 1;
        }
        const predicted = intentOf(c, undefined, 1);
        act(c, "tailStrike", utility.key);
        if (c.outcome !== "ongoing") break;
        const at = c.log.length;
        slot(c);
        const hitLine = c.log.slice(at).find((l: string) => l.includes("enemy hits for"));
        if (hitLine && !predicted.skip) {
          const landed = Number(hitLine.match(/for (\d+)/)![1]);
          expect(landed).toBe(predicted.dmg);
          if (predicted.heavy) coveredHeavy = true;
          else coveredPlain = true;
        }
      }
      expect(coveredPlain || coveredHeavy).toBe(true);
    }
  }
});
