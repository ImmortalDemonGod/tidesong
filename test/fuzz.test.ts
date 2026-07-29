// G1 fuzz battery: hostile random inputs at the WORLD level. 50 seeds x 400
// actions = 20,000 actions (gate requires 10k+), invariants checked after
// every single action. Any throw fails the suite.

import { expect, test } from "bun:test";
import { ABILITIES, type PartKey } from "../src/game";
import { AREAS, HUB, combatAction, combatPass, createWorld, interact, step, type Dir } from "../src/world";

const DIRS: Dir[] = ["up", "down", "left", "right"];
const PARTS: (PartKey | undefined)[] = ["jaw", "eye", "fin", "tail", undefined];
const KEYS = Object.keys(ABILITIES);

function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("G1 fuzz: 20,000 hostile actions across 50 seeds hold every invariant", () => {
  let actions = 0;
  for (let seed = 0; seed < 50; seed++) {
    const w = createWorld(seed);
    const r = rng(seed ^ 0xf022);
    for (let i = 0; i < 400; i++) {
      actions += 1;
      const roll = r();
      if (w.mode === "combat") {
        if (roll < 0.75) {
          combatAction(w, KEYS[Math.floor(r() * KEYS.length)], PARTS[Math.floor(r() * PARTS.length)]);
        } else {
          combatPass(w);
        }
      } else if (w.mode === "explore") {
        if (roll < 0.85) step(w, DIRS[Math.floor(r() * DIRS.length)]);
        else interact(w);
      } else {
        break; // victory: this seed is done
      }

      // invariants, every action
      expect(w.hp).toBeGreaterThanOrEqual(0);
      expect(w.hp).toBeLessThanOrEqual(w.maxHp);
      expect(w.healSongUses).toBeGreaterThanOrEqual(0);
      expect(w.healSongUses).toBeLessThanOrEqual(2);
      const bounds = AREAS[w.area];
      expect(w.pos.x).toBeGreaterThanOrEqual(0);
      expect(w.pos.x).toBeLessThan(bounds.w);
      expect(w.pos.y).toBeGreaterThanOrEqual(0);
      expect(w.pos.y).toBeLessThan(bounds.h);
      if (w.area === "hub" && w.pos.x >= HUB.barrierX) {
        expect(w.hasTideRelic).toBe(true);
      }
      if (w.combat) {
        expect(w.combat.player.sta).toBeGreaterThanOrEqual(0);
        expect(w.combat.player.sta).toBeLessThanOrEqual(w.combat.player.maxSta);
        expect(w.combat.player.hp).toBeGreaterThanOrEqual(0);
        for (const c of w.combat.enemy.conditions) {
          expect(c.turns).toBeGreaterThan(0);
          expect(c.level === 1 || c.level === 2).toBe(true);
        }
        if (w.combat.boss) {
          for (const p of w.combat.boss.parts) {
            expect(p.durability).toBeGreaterThanOrEqual(0);
            if (p.durability === 0) expect(p.broken).toBe(true);
          }
        }
      }
    }
  }
  expect(actions).toBeGreaterThanOrEqual(10000);
});

// Dungeon 2 coverage: a random walker cannot cross the full route, so these
// starts are seeded inside the second ruin with the relic held (closing the
// coverage gap noted in the morning-report draft).
test("G1 fuzz: 12,000 hostile actions seeded inside dungeon 2", () => {
  let actions = 0;
  for (let seed = 100; seed < 130; seed++) {
    const w = createWorld(seed);
    w.hasTideRelic = true;
    w.area = "dungeon2";
    w.pos = { x: 4, y: 4 };
    w.checkpoint = { area: "dungeon2", pos: { x: 1, y: 4 } };
    const r = rng(seed ^ 0xd2f);
    for (let i = 0; i < 400; i++) {
      actions += 1;
      const roll = r();
      if (w.mode === "combat") {
        if (roll < 0.75) {
          combatAction(w, KEYS[Math.floor(r() * KEYS.length)], PARTS[Math.floor(r() * PARTS.length)]);
        } else {
          combatPass(w);
        }
      } else if (w.mode === "explore") {
        if (roll < 0.85) step(w, DIRS[Math.floor(r() * DIRS.length)]);
        else interact(w);
      } else {
        // victory inside dungeon 2 is only legal once the eel is down
        expect(w.encounters.find((e) => e.kind === "boss2")?.defeated).toBe(true);
        break;
      }
      expect(w.hp).toBeGreaterThanOrEqual(0);
      expect(w.hp).toBeLessThanOrEqual(w.maxHp);
      const bounds = AREAS[w.area];
      expect(w.pos.x).toBeGreaterThanOrEqual(0);
      expect(w.pos.x).toBeLessThan(bounds.w);
      expect(w.pos.y).toBeGreaterThanOrEqual(0);
      expect(w.pos.y).toBeLessThan(bounds.h);
      if (w.combat?.boss) {
        for (const p of w.combat.boss.parts) {
          expect(p.durability).toBeGreaterThanOrEqual(0);
          if (p.durability === 0) expect(p.broken).toBe(true);
        }
        expect(["shark", "eel"]).toContain(w.combat.boss.kind);
      }
    }
  }
  expect(actions).toBeGreaterThanOrEqual(10000);
});
