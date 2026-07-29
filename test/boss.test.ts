import { expect, test } from "bun:test";
import {
  advanceTurn,
  bossDamage,
  createBossCombat,
  currentKeyPart,
  getPart,
  useAbility,
  type CombatState,
  type PartKey,
} from "../src/game";

function smash(s: CombatState, part: PartKey): void {
  let guard = 0;
  while (!getPart(s, part)!.broken && s.outcome === "ongoing" && guard++ < 50) {
    s.player.sta = s.player.maxSta;
    useAbility(s, "tailStrike", part);
  }
}

test("boss creation: 4 parts, phase 1 CRUSH, key part jaw, hp mirrors durability", () => {
  const s = createBossCombat();
  expect(s.boss?.parts.length).toBe(4);
  expect(s.boss?.phase).toBe(1);
  expect(s.boss?.phaseName).toBe("CRUSH");
  expect(currentKeyPart(s)).toBe("jaw");
  expect(s.enemy.hp).toBe(22 + 18 + 12 + 12);
});

test("damage with no target drifts to a random unbroken part", () => {
  const s = createBossCombat(11);
  useAbility(s, "tailStrike");
  expect(s.enemy.hp).toBe(64 - 8);
  const damaged = s.boss!.parts.filter((p) => p.durability < p.maxDurability);
  expect(damaged.length).toBe(1);
});

test("aimed damage hits exactly the chosen part", () => {
  const s = createBossCombat();
  useAbility(s, "tailStrike", "tail");
  expect(getPart(s, "tail")!.durability).toBe(12 - 8);
  expect(getPart(s, "jaw")!.durability).toBe(22);
});

test("breaking a utility part reduces boss damage, never ends a phase", () => {
  const s = createBossCombat();
  expect(bossDamage(s)).toBe(12);
  smash(s, "fin");
  expect(s.boss?.phase).toBe(1);
  expect(bossDamage(s)).toBe(9);
  const hp = s.player.hp;
  advanceTurn(s);
  expect(hp - s.player.hp).toBe(9);
});

test("breaking the jaw ends phase 1: FRENZY begins, key part becomes eye, damage rises", () => {
  const s = createBossCombat();
  smash(s, "jaw");
  expect(s.boss?.phase).toBe(2);
  expect(s.boss?.phaseName).toBe("FRENZY");
  expect(currentKeyPart(s)).toBe("eye");
  expect(bossDamage(s)).toBe(15);
  expect(s.outcome).toBe("ongoing");
});

test("breaking the eye in phase 2 is victory", () => {
  const s = createBossCombat();
  smash(s, "jaw");
  smash(s, "eye");
  expect(s.outcome).toBe("victory");
});

test("pre-breaking the eye in phase 1 cascades to victory at the phase break", () => {
  const s = createBossCombat();
  smash(s, "eye");
  expect(s.outcome).toBe("ongoing");
  smash(s, "jaw");
  expect(s.outcome).toBe("victory");
});

test("analyze names the current phase's key part", () => {
  const s = createBossCombat();
  useAbility(s, "analyze");
  expect(s.log.some((l) => l.includes("target the jaw"))).toBe(true);
  smash(s, "jaw");
  s.player.sta = s.player.maxSta;
  useAbility(s, "analyze");
  expect(s.log.some((l) => l.includes("target the eye"))).toBe(true);
});

test("slow works on the boss: first affected slot is skipped", () => {
  const s = createBossCombat();
  useAbility(s, "finSlash");
  const hp = s.player.hp;
  advanceTurn(s);
  expect(s.player.hp).toBe(hp);
});

test("the boss cannot dodge: player damage always lands", () => {
  // Aimed at the jaw explicitly: untargeted damage drifts randomly, and
  // 2 hits of 8 stay under the jaw's durability, so no overkill clamp
  // (correctness review 00:47, MED-7: the drift version passed by seed
  // lottery).
  const s = createBossCombat(3);
  for (let i = 0; i < 2; i++) {
    s.player.sta = s.player.maxSta;
    const before = s.enemy.hp;
    useAbility(s, "tailStrike", "jaw");
    expect(s.enemy.hp).toBe(before - 8);
  }
});
