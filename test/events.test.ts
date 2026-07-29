// G7 wiring proof: every named audio event classifies from REAL sim log
// lines, produced by actually playing the sim (not hand-written strings
// pretending to be logs). The classifier is what main.ts feeds the synth,
// so classification == wiring.

import { expect, test } from "bun:test";
import { classifyLogLine } from "../src/events";
import { createBossCombat, createCombat, useAbility } from "../src/game";
import { HUB, combatAction, combatPass, createWorld, interact, step } from "../src/world";
import { walk } from "./helpers";

test("G7 hit: a landed attack log line classifies as hit", () => {
  const s = createCombat(3);
  s.enemy.dodge = 0;
  useAbility(s, "tailStrike");
  const line = s.log.at(-1)!;
  expect(classifyLogLine(line)).toBe("hit");
});

test("G7 disable: a landed disable classifies as disable", () => {
  const s = createCombat();
  useAbility(s, "siltBurst");
  expect(s.log.some((l) => classifyLogLine(l) === "disable")).toBe(true);
});

test("G7 phase break: breaking a part classifies as phaseBreak", () => {
  const s = createBossCombat();
  let guard = 0;
  while (!s.boss!.parts[0].broken && guard++ < 50) {
    s.player.sta = s.player.maxSta;
    useAbility(s, "tailStrike", "jaw");
  }
  expect(s.log.some((l) => classifyLogLine(l) === "phaseBreak")).toBe(true);
});

test("G7 pickup: collecting a fragment classifies as pickup", () => {
  const w = createWorld();
  walk(w, 7, 5);
  expect(w.log.some((l) => classifyLogLine(l) === "pickup")).toBe(true);
});

test("G7 death: dying classifies as death", () => {
  const w = createWorld();
  walk(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walk(w, 8, 4);
  w.combat!.player.hp = 1;
  let guard = 0;
  while (w.mode === "combat" && guard++ < 100) combatPass(w);
  expect(w.log.some((l) => classifyLogLine(l) === "death")).toBe(true);
});

test("G7 rebuff: the barrier shove classifies as rebuff", () => {
  const w = createWorld();
  walk(w, HUB.barrierX - 1, 4);
  step(w, "right");
  expect(w.log.some((l) => classifyLogLine(l) === "rebuff")).toBe(true);
});

test("G7 victory: parting the currents classifies as victory", () => {
  const w = createWorld();
  w.hasTideRelic = true;
  walk(w, HUB.mouth.x, HUB.mouth.y);
  expect(w.log.some((l) => classifyLogLine(l) === "victory")).toBe(true);
});

test("G7 victory: the eel's fall classifies as victory (extended slice ending)", () => {
  const w = createWorld(3);
  w.hasTideRelic = true;
  w.area = "dungeon2";
  for (const e of w.encounters) if (e.kind !== "boss2") e.defeated = true;
  w.pos = { x: 20, y: 4 };
  w.checkpoint = { area: "dungeon2", pos: { x: 1, y: 4 } };
  step(w, "right");
  let guard = 0;
  while (w.mode === "combat" && w.combat && guard++ < 300) {
    w.combat.player.sta = w.combat.player.maxSta;
    w.combat.player.hp = w.combat.player.maxHp;
    combatAction(w, "tailStrike");
  }
  expect(w.mode).toBe("victory");
  expect(w.log.some((l) => classifyLogLine(l) === "victory")).toBe(true);
});

test("G7 victory: a plain combat win classifies as victory (win-edge fix)", () => {
  const s = createCombat(3);
  s.enemy.dodge = 0;
  s.enemy.hp = 5;
  useAbility(s, "tailStrike");
  expect(s.outcome).toBe("victory");
  expect(s.log.some((l) => classifyLogLine(l) === "victory")).toBe(true);
});

test("G7 note and jar: song-seal stones ring and jar audibly", () => {
  const w = createWorld(9);
  walk(w, HUB.stones[w.melody[0]].x, HUB.stones[w.melody[0]].y);
  interact(w);
  expect(w.log.some((l) => classifyLogLine(l) === "note")).toBe(true);
  interact(w); // same stone again: wrong continuation, seal jars
  expect(w.log.some((l) => classifyLogLine(l) === "jar")).toBe(true);
});
