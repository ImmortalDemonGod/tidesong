// The night watch: maximum-depth verification for the morning report.
import { createWorld } from "../src/world";
import { runWorld } from "../test/nav";
import { casualBot, optimalBot, runBatch } from "../test/bots";
import { createCombat, createBossCombat, createBoss2Combat, createElderCombat } from "../src/game";

console.log("== mega-sim: 20,000 casual full runs ==");
let wins = 0, worst = 0, deaths = 0;
const fails: number[] = [];
for (let seed = 0; seed < 20000; seed++) {
  const r = runWorld(createWorld(seed), (fi) => casualBot(seed * 991 + fi * 97));
  if (r.victory) wins++;
  else fails.push(seed);
  worst = Math.max(worst, r.actions);
  deaths += r.deaths;
}
console.log(`casual x20000: ${wins}/20000, worst ${worst}, deaths ${deaths}, fails: ${fails.slice(0, 10).join(",") || "none"}`);

console.log("== band stability: five disjoint fresh seed spaces ==");
const echo = (make: (s: number) => any) => (s: number) => { const c = make(s); c.relicEcho = true; return c; };
const encounters = [["squid", createCombat], ["shark", createBossCombat], ["elder", echo(createElderCombat)], ["eel", echo(createBoss2Combat)]] as const;
for (const base of [30000, 50000, 70000, 90000, 110000]) {
  const line: string[] = [];
  for (const [name, make] of encounters) {
    const c = runBatch((seed) => casualBot(seed + base), (seed) => (make as any)(seed + base), 500);
    const o = runBatch(() => optimalBot(), (seed) => (make as any)(seed + base), 500);
    line.push(`${name} ${(c.winRate * 100).toFixed(0)}%/${o.meanDamageTaken.toFixed(0)}d`);
  }
  console.log(`seeds ${base}+: ${line.join("  ")}`);
}
