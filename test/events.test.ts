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

test("G7 victory: a plain combat win reaches the DELIVERED log (skeptic F1: the old version asserted the disconnected side)", () => {
  const w = createWorld(3);
  walk(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walk(w, 8, 4);
  w.combat!.enemy.dodge = 0;
  w.combat!.enemy.hp = 5;
  combatAction(w, "tailStrike");
  expect(w.mode).toBe("explore");
  expect(w.log.some((l) => classifyLogLine(l) === "victory")).toBe(true);
});

test("G7 note and jar: song-seal stones ring and jar audibly", () => {
  const w = createWorld(9);
  walk(w, HUB.stones[w.melody[0]].x, HUB.stones[w.melody[0]].y);
  interact(w);
  expect(w.log.some((l) => classifyLogLine(l) === "note")).toBe(true);
  interact(w); // same stone again: wrong continuation, seal jars
  expect(w.log.some((l) => classifyLogLine(l) === "jar")).toBe(true);
});

// ---- fun pass: per-ability voices and payoff events (all from REAL lines) ----

import { abilityCast } from "../src/events";
import { advanceTurn, enemyIntent } from "../src/game";

test("abilityCast maps every ability's real log line to its key, and nothing else", () => {
  const c = createCombat(5);
  c.enemy.dodge = 0;
  const startAt = () => c.log.length;
  const cases: Array<[string, string]> = [
    ["tailStrike", "tailStrike"],
    ["siltBurst", "siltBurst"],
    ["finSlash", "finSlash"],
    ["analyze", "analyze"],
    ["bubble", "bubble"],
  ];
  for (const [key, expected] of cases) {
    c.player.sta = c.player.maxSta;
    const at = startAt();
    useAbility(c, key);
    const line = c.log[at];
    expect(abilityCast(line)).toBe(expected);
  }
  c.player.hp = 40;
  c.player.sta = c.player.maxSta;
  const at = startAt();
  useAbility(c, "healSong");
  expect(abilityCast(c.log[at])).toBe("healSong");
  // enemy-slot and world lines never read as casts
  expect(abilityCast("enemy hits for 13")).toBe(null);
  expect(abilityCast("Bubble absorbed part of the hit")).toBe(null);
  expect(abilityCast("checkpoint: dungeon entrance (Heal Song restored)")).toBe(null);
  expect(abilityCast("memory fragment: \"x\"")).toBe(null);
});

test("G7 payoff: blind miss, slow skip, and bubble absorb all classify as payoff from real lines", () => {
  // slow skip: real fight, real slow, first slot skips
  const c1 = createCombat(11);
  c1.enemy.dodge = 0;
  useAbility(c1, "finSlash");
  const at1 = c1.log.length;
  advanceTurn(c1);
  const skipLine = c1.log.slice(at1).find((l) => l.includes("skips"));
  expect(skipLine).toBeDefined();
  expect(classifyLogLine(skipLine!)).toBe("payoff");

  // bubble absorb: real bubble, enemy acts through it
  const c2 = createCombat(12);
  useAbility(c2, "bubble");
  let absorbed: string | undefined;
  for (let i = 0; i < 20 && !absorbed; i++) {
    const at = c2.log.length;
    advanceTurn(c2);
    absorbed = c2.log.slice(at).find((l) => l.includes("Bubble absorbed"));
    if (c2.outcome !== "ongoing") break;
  }
  expect(absorbed).toBeDefined();
  expect(classifyLogLine(absorbed!)).toBe("payoff");

  // blind miss: real blind II, sweep seeds until a miss rolls
  let missLine: string | undefined;
  for (let seed = 1; seed < 60 && !missLine; seed++) {
    const c3 = createCombat(seed);
    c3.enemy.dodge = 0;
    c3.player.sta = c3.player.maxSta;
    useAbility(c3, "siltBurst");
    c3.player.sta = c3.player.maxSta;
    useAbility(c3, "siltBurst"); // level II: 80 percent miss
    const at = c3.log.length;
    advanceTurn(c3);
    missLine = c3.log.slice(at).find((l) => l.includes("missed (blind)"));
  }
  expect(missLine).toBeDefined();
  expect(classifyLogLine(missLine!)).toBe("payoff");
});

test("enemy intent telegraph is honest: what it announces is what the next slot does (300 hostile slots)", () => {
  let checked = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const c = createCombat(seed * 7);
    const bc = createBossCombat(seed * 13);
    for (const s of [c, bc]) {
      let guard = 0;
      while (s.outcome === "ongoing" && guard++ < 15) {
        // random-ish player action to churn conditions and bubble
        s.player.sta = s.player.maxSta;
        const pool = ["tailStrike", "siltBurst", "finSlash", "bubble", "analyze"];
        useAbility(s, pool[(seed + guard) % pool.length]);
        if (s.outcome !== "ongoing") break;
        const intent = enemyIntent(s);
        const at = s.log.length;
        advanceTurn(s);
        const lines = s.log.slice(at);
        checked++;
        if (intent.skip) {
          expect(lines.some((l) => l.includes("skips its action"))).toBe(true);
        } else if (lines.some((l) => l.includes("enemy hits for"))) {
          const dealt = Number(lines.find((l) => l.includes("enemy hits for"))!.match(/for (\d+)/)![1]);
          expect(dealt).toBe(intent.dmg);
        } else {
          // the only other outcome of a non-skip slot is a blind miss,
          // which intent must have flagged as possible
          expect(lines.some((l) => l.includes("missed (blind)"))).toBe(true);
          expect(intent.missChance).toBeGreaterThan(0);
        }
      }
    }
  }
  expect(checked).toBeGreaterThan(300);
});
