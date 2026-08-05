// D3c: the taught-line bot.
// A bot that plays exactly what the tutorial teaches must beat a bot that
// mashes the biggest attack. If it does not, the game's instruction is
// worse than ignoring it, and every teaching moment in the build is a lie.

import * as G from "../src/game";
import { ABILITY_KEYS, runBatch, type Bot } from "../test/bots";

const isFree: (s: any, k: string) => boolean = (G as any).isFreeAction ?? (() => false);
const A = (G as any).ABILITIES;

const has = (k: string) => ABILITY_KEYS.includes(k);
const afford = (s: any, k: string) => has(k) && s.player.sta >= A[k].staCost;

// What the build teaches, in order: look first, apply the named condition,
// guard the telegraphed heavy, heal when low, otherwise hit the key part.
function taughtBot(): Bot {
  return (s: any) => {
    const aimed = s.boss ? (G as any).currentKeyPart?.(s) : undefined;
    if (!s.analyzed && afford(s, "analyze")) return { ability: "analyze" };
    const hint = s.enemy.analyzeHint;
    const condKey = hint === "blind" ? "siltBurst" : "finSlash";
    const lvl = s.enemy.conditions?.[hint]?.level ?? 0;
    if (lvl === 0 && afford(s, condKey)) return { ability: condKey };
    const intent = (G as any).enemyIntent?.(s);
    if (intent?.heavy && !intent.skip && afford(s, "bubble") && (s.player.bubbleUses ?? 1) > 0)
      return { ability: "bubble" };
    if (s.player.hp <= s.player.maxHp * 0.4 && afford(s, "healSong")) return { ability: "healSong" };
    if (afford(s, "tailStrike")) return { ability: "tailStrike", part: aimed };
    return null;
  };
}

// The naive line: hit the thing with the biggest number, heal if about to die.
function masherBot(): Bot {
  return (s: any) => {
    const aimed = s.boss ? (G as any).currentKeyPart?.(s) : undefined;
    if (s.player.hp <= s.player.maxHp * 0.25 && afford(s, "healSong")) return { ability: "healSong" };
    if (afford(s, "tailStrike")) return { ability: "tailStrike", part: aimed };
    return null;
  };
}

function encounters(): Array<[string, (s: number) => any]> {
  const g = G as any;
  const e: Array<[string, (s: number) => any]> = [["squid", g.createCombat]];
  if (g.createElderCombat) e.push(["elder", g.createElderCombat]);
  if (g.createInkCombat) e.push(["ink", g.createInkCombat]);
  e.push(["shark", g.createBossCombat]);
  if (g.createBoss2Combat) e.push(["eel", g.createBoss2Combat]);
  return e;
}

const SEEDS = Number(process.argv[2] ?? 400);
const findings: string[] = [];
console.log(`D3c TAUGHT LINE VERSUS NAIVE MASHER (${SEEDS} seeds per encounter)`);
console.log("encounter   taught win  taught dmg  taught turns   mash win  mash dmg  mash turns   verdict");
for (const [name, make] of encounters()) {
  const t = (runBatch as any)(() => taughtBot(), make, SEEDS);
  const m = (runBatch as any)(() => masherBot(), make, SEEDS);
  // the taught line must take less damage, or win more often
  const better = t.meanDamageTaken < m.meanDamageTaken || t.winRate > m.winRate + 0.02;
  console.log(
    `${name.padEnd(11)} ${(t.winRate * 100).toFixed(1).padStart(9)}% ${t.meanDamageTaken
      .toFixed(1)
      .padStart(11)} ${t.meanTurns.toFixed(1).padStart(13)} ${(m.winRate * 100).toFixed(1).padStart(10)}% ${m.meanDamageTaken
      .toFixed(1)
      .padStart(9)} ${m.meanTurns.toFixed(1).padStart(11)}   ${better ? "ok" : "TEACHING LOSES"}`,
  );
  if (!better)
    findings.push(
      `TEACHING LOSES on ${name}: taught takes ${t.meanDamageTaken.toFixed(1)} damage, mashing takes ${m.meanDamageTaken.toFixed(1)}`,
    );
}

console.log("");
if (findings.length) {
  for (const f of findings) console.log(`FINDING  ${f}`);
  console.log(`D3c: ${findings.length} finding(s)`);
  process.exit(1);
}
console.log("D3c: the taught line pays everywhere");
