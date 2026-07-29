// Deepened playtests for the morning report: 5x casual softlock scale and
// band stability on a wide fresh seed space.
import { createWorld } from "../src/world";
import { runWorld } from "../test/nav";
import { casualBot, optimalBot, runBatch } from "../test/bots";
import { createCombat, createBossCombat, createBoss2Combat, createElderCombat } from "../src/game";

let wins = 0, worst = 0, deaths = 0;
for (let seed = 0; seed < 500; seed++) {
  const r = runWorld(createWorld(seed), (fi) => casualBot(seed * 991 + fi * 97));
  if (r.victory) wins++;
  worst = Math.max(worst, r.actions);
  deaths += r.deaths;
}
console.log(`casual x500: ${wins}/500 within 5000, worst ${worst}, deaths ${deaths}`);

const echo = (make: (s: number) => any) => (s: number) => { const c = make(s); c.relicEcho = true; return c; };
for (const [name, make] of [["squid", createCombat], ["shark", createBossCombat], ["elder", echo(createElderCombat)], ["eel", echo(createBoss2Combat)]] as const) {
  const c = runBatch((seed) => casualBot(seed + 20000), (seed) => (make as any)(seed + 20000), 2000);
  const o = runBatch(() => optimalBot(), (seed) => (make as any)(seed + 20000), 2000);
  console.log(`${name} x2000 fresh: casual win ${(c.winRate * 100).toFixed(1)}% turns ${c.meanTurns.toFixed(1)}; optimal dmgTaken ${o.meanDamageTaken.toFixed(1)}`);
}
