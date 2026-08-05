// D7: differential harness fidelity.
// The instrument must play the game the player plays. This runs ONE
// identical scripted fight down both paths, using the real shipped
// runFight for the harness side, and compares the outcome.
//
// The real failure it reproduces: the band harness stepped with
// useAbility + advanceTurn while the world stepped with combatAction,
// which honours free actions. Making Analyze free therefore moved no band.

import { runFight } from "../test/bots";
import * as W from "../src/world";

const SCRIPT = ["analyze", "tailStrike", "siltBurst", "tailStrike", "finSlash", "tailStrike"];
const SEED = 7;

function walk(w: any, x: number, y: number) {
  const area = w.area;
  let guard = 0;
  while ((w.pos.x !== x || w.pos.y !== y) && w.mode === "explore" && w.area === area && guard++ < 200) {
    if (w.pos.x < x) (W as any).step(w, "right");
    else if (w.pos.x > x) (W as any).step(w, "left");
    else if (w.pos.y < y) (W as any).step(w, "down");
    else (W as any).step(w, "up");
  }
}

function enterFirstFight() {
  const w = (W as any).createWorld(SEED);
  const H = (W as any).HUB;
  walk(w, H.dungeonEntrance.x, H.dungeonEntrance.y);
  walk(w, 8, 4);
  return w;
}

// PATH A: the world path. This is literally what pressing a number key does.
const wA = enterFirstFight();
if (!wA.combat) {
  console.log("D7: could not reach the teaching fight; inconclusive");
  process.exit(2);
}
// hold the combat object itself: the world nulls w.combat when the fight
// ends, and the final state is exactly what we need to compare
const cA = wA.combat;
let i = 0;
let guard = 0;
while (cA.outcome === "ongoing" && guard++ < 200) {
  (W as any).combatAction(wA, SCRIPT[i++ % SCRIPT.length]);
}
const last = {
  turns: cA.turn,
  hpLost: cA.player.maxHp - cA.player.hp,
  damageTaken: cA.damageTaken,
  win: cA.outcome === "victory",
};

// PATH B: the harness path, using the SHIPPED runFight on an identically
// seeded fight. Nothing is quoted or re-implemented here.
const wB = enterFirstFight();
let j = 0;
const harness = runFight(() => ({ ability: SCRIPT[j++ % SCRIPT.length] }) as any, SEED, () => wB.combat, 200);

console.log("D7 DIFFERENTIAL: world path versus harness path, identical scripted fight");
console.log("field           world     harness");
const rows: Array<[string, number | boolean, number | boolean]> = [
  ["turns", last.turns, harness.turns],
  ["hpLost", last.hpLost, harness.hpLost],
  ["damageTaken", last.damageTaken, harness.damageTaken],
  ["win", last.win, harness.win],
];
const diffs: string[] = [];
for (const [name, a, b] of rows) {
  const same = a === b;
  console.log(`${name.padEnd(15)} ${String(a).padStart(5)}   ${String(b).padStart(9)}   ${same ? "" : "<-- DIVERGES"}`);
  if (!same) diffs.push(`${name}: world ${a}, harness ${b}`);
}

console.log("");
if (!diffs.length) {
  console.log("D7: the judges play the game the player plays");
  process.exit(0);
}
console.log(`FINDING  HARNESS DRIFT: the judges measure a different game (${diffs.join("; ")})`);
console.log("D7: 1 finding");
process.exit(1);
