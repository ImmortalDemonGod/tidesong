import { createBoss2Combat } from "../src/game";
import { casualBot, optimalBot, runBatch } from "../test/bots";
import type { PartKey } from "../src/game";

// Partition 3000 seeds by which key part they roll, then band each cohort.
const cohorts: Record<string, number[]> = { eye: [], fin: [], tail: [] };
for (let seed = 0; seed < 3000; seed++) {
  const key = createBoss2Combat(seed).boss!.keyPartByPhase[1];
  cohorts[key].push(seed);
}
for (const [key, seeds] of Object.entries(cohorts)) {
  const make = (i: number) => {
    const c = createBoss2Combat(seeds[i % seeds.length]);
    c.relicEcho = true;
    return c;
  };
  const c = runBatch((i) => casualBot(i), make, Math.min(seeds.length, 900));
  const o = runBatch(() => optimalBot(), make, Math.min(seeds.length, 900));
  console.log(`${key.padEnd(4)} (${seeds.length} seeds): casual win ${(c.winRate * 100).toFixed(1)}% turns ${c.meanTurns.toFixed(1)}; optimal turns ${o.meanTurns.toFixed(1)} dmgTaken ${o.meanDamageTaken.toFixed(1)}`);
}
