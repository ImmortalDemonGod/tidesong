// Ability usage histograms: casual and optimal across all four encounters.
// A button nobody presses is a design smell G4's spam checks cannot see.
import { ABILITIES, advanceTurn, createBossCombat, createBoss2Combat, createCombat, createElderCombat, useAbility } from "../src/game";
import { casualBot, optimalBot, type Bot } from "../test/bots";

const echo = (make: (s: number) => any) => (s: number) => { const c = make(s); c.relicEcho = true; return c; };
const encounters = [
  ["squid", createCombat],
  ["shark", createBossCombat],
  ["elder", echo(createElderCombat)],
  ["eel", echo(createBoss2Combat)],
] as const;

for (const [name, make] of encounters) {
  for (const [botName, makeBot] of [["casual", (s: number) => casualBot(s)], ["optimal", () => optimalBot()]] as const) {
    const counts: Record<string, number> = {};
    for (const k of Object.keys(ABILITIES)) counts[k] = 0;
    for (let seed = 0; seed < 300; seed++) {
      const s = (make as any)(seed);
      const bot: Bot = (makeBot as any)(seed);
      let guard = 0;
      while (s.outcome === "ongoing" && guard++ < 60) {
        const a = bot(s);
        if (a && useAbility(s, a.ability, a.part)) counts[a.ability]++;
        if (s.outcome === "ongoing") advanceTurn(s);
      }
    }
    const total = Object.values(counts).reduce((x, y) => x + y, 0);
    const line = Object.entries(counts).map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`).join(" ");
    console.log(`${name.padEnd(6)} ${botName.padEnd(8)}: ${line}`);
  }
}
