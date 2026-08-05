// D3b: hint-versus-winner cross-check.
// For every claim the game makes to the player, a bot that checks the claim
// is true. Analyze names a "best disable"; measure which disable is actually
// best and assert they agree.

import * as G from "../src/game";
import { ABILITY_KEYS, optimalBot, runBatch } from "../test/bots";

function encounters(): Array<[string, (s: number) => any]> {
  const g = G as any;
  const e: Array<[string, (s: number) => any]> = [["squid", g.createCombat]];
  if (g.createElderCombat) e.push(["elder", g.createElderCombat]);
  if (g.createInkCombat) e.push(["ink", g.createInkCombat]);
  e.push(["shark", g.createBossCombat]);
  if (g.createBoss2Combat) e.push(["eel", g.createBoss2Combat]);
  return e;
}

const noSilt = ABILITY_KEYS.filter((k) => k !== "siltBurst"); // slow-only kit
const noFin = ABILITY_KEYS.filter((k) => k !== "finSlash"); // blind-only kit
const SEEDS = Number(process.argv[2] ?? 300);
const findings: string[] = [];

console.log(`D3b HINT VERSUS MEASURED WINNER (${SEEDS} seeds per kit per encounter)`);
console.log("encounter   claimed   slow dmg   blind dmg   measured   verdict");
for (const [name, make] of encounters()) {
  const slow = (runBatch as any)(() => optimalBot(noSilt), make, SEEDS).meanDamageTaken;
  const blind = (runBatch as any)(() => optimalBot(noFin), make, SEEDS).meanDamageTaken;
  const measured = blind < slow ? "blind" : "slow";
  const claimed = make(1).enemy.analyzeHint;
  const ok = claimed === measured;
  const margin = Math.abs(slow - blind).toFixed(1);
  console.log(
    `${name.padEnd(11)} ${String(claimed).padEnd(9)} ${slow.toFixed(1).padStart(8)} ${blind
      .toFixed(1)
      .padStart(11)}   ${measured.padEnd(10)} ${ok ? "ok" : `LIES (by ${margin} dmg)`}`,
  );
  if (!ok) findings.push(`ANALYZE LIES on ${name}: claims ${claimed}, ${measured} wins by ${margin} damage taken`);
}

console.log("");
if (findings.length) {
  for (const f of findings) console.log(`FINDING  ${f}`);
  console.log(`D3b: ${findings.length} finding(s)`);
  process.exit(1);
}
console.log("D3b: every hint matches its measurement");
