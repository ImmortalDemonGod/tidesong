// D3a: usage histogram as standard output.
// An ability at 0 percent of optimal play is a dead option. This ran as a
// one-off investigation at hour 18 and found Bubble and Analyze at zero;
// it should have been printed by every band run from hour one.
// Version-tolerant on purpose: it runs against old commits unchanged.

import * as G from "../src/game";
import { ABILITY_KEYS, optimalBot } from "../test/bots";

const isFree: (s: any, k: string) => boolean = (G as any).isFreeAction ?? (() => false);

function encounters(): Array<[string, (s: number) => any]> {
  const g = G as any;
  const e: Array<[string, (s: number) => any]> = [["squid", g.createCombat]];
  if (g.createElderCombat) e.push(["elder", g.createElderCombat]);
  if (g.createInkCombat) e.push(["ink", g.createInkCombat]);
  e.push(["shark", g.createBossCombat]);
  if (g.createBoss2Combat) e.push(["eel", g.createBoss2Combat]);
  return e;
}

function histogram(make: (s: number) => any, seeds: number) {
  const counts: Record<string, number> = {};
  for (const k of ABILITY_KEYS) counts[k] = 0;
  let total = 0;
  const bot = optimalBot();
  for (let s = 1; s <= seeds; s++) {
    const st = make(s);
    let guard = 0;
    while (st.outcome === "ongoing" && guard++ < 80) {
      const a = bot(st);
      if (!a) break;
      const free = isFree(st, a.ability);
      const landed = (G as any).useAbility(st, a.ability, a.part);
      if (landed) {
        counts[a.ability] = (counts[a.ability] ?? 0) + 1;
        total++;
      }
      if (st.outcome === "ongoing" && !(landed && free)) (G as any).advanceTurn(st);
    }
  }
  return { counts, total };
}

const SEEDS = Number(process.argv[2] ?? 300);
const findings: string[] = [];
const everUsed: Record<string, boolean> = {};
for (const k of ABILITY_KEYS) everUsed[k] = false;

console.log(`D3a USAGE HISTOGRAM (optimal bot, ${SEEDS} seeds per encounter)`);
console.log(`encounter  ` + ABILITY_KEYS.map((k) => k.padStart(11)).join(""));
for (const [name, make] of encounters()) {
  const { counts, total } = histogram(make, SEEDS);
  const row = ABILITY_KEYS.map((k) => {
    const pct = total ? (counts[k] / total) * 100 : 0;
    if (pct > 0) everUsed[k] = true;
    return `${pct.toFixed(1)}%`.padStart(11);
  }).join("");
  console.log(name.padEnd(11) + row);
}

// Honest limit of this detector, found by running it: the optimal bot is a
// greedy state-evaluator, so it can never value an INFORMATION ability. It
// will report Analyze at 0 percent forever, in a build where Analyze is
// good and in one where it is broken. Information abilities are printed and
// excluded from findings; whether they earn their slot is a D2 question,
// asked of a reader, not a D3 question asked of a bot.
const A = (G as any).ABILITIES;
const info = ABILITY_KEYS.filter((k) => A[k]?.analyze);
for (const k of ABILITY_KEYS) {
  if (everUsed[k]) continue;
  if (info.includes(k)) {
    console.log(`NOTE     ${k} is an information ability; a greedy bot cannot value it. Defer to D2.`);
    continue;
  }
  findings.push(`DEAD OPTION: ${k} is never chosen by optimal play on ANY encounter`);
}

console.log("");
if (findings.length) {
  for (const f of findings) console.log(`FINDING  ${f}`);
  console.log(`D3a: ${findings.length} finding(s)`);
  process.exit(1);
}
console.log("D3a: no dead options");
