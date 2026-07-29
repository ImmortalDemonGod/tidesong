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
  expect(s.enemy.hp).toBe(26 + 22 + 12 + 12);
});

test("damage with no target routes to the current key part", () => {
  const s = createBossCombat();
  useAbility(s, "tailStrike");
  expect(getPart(s, "jaw")!.durability).toBe(26 - 8);
  expect(s.enemy.hp).toBe(72 - 8);
});

test("breaking a utility part reduces boss damage, never ends a phase", () => {
  const s = createBossCombat();
  expect(bossDamage(s)).toBe(14);
  smash(s, "fin");
  expect(s.boss?.phase).toBe(1);
  expect(bossDamage(s)).toBe(11);
  const hp = s.player.hp;
  advanceTurn(s);
  expect(hp - s.player.hp).toBe(11);
});

test("breaking the jaw ends phase 1: FRENZY begins, key part becomes eye, damage rises", () => {
  const s = createBossCombat();
  smash(s, "jaw");
  expect(s.boss?.phase).toBe(2);
  expect(s.boss?.phaseName).toBe("FRENZY");
  expect(currentKeyPart(s)).toBe("eye");
  expect(bossDamage(s)).toBe(17);
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
  // 3 hits of 8 stay under the jaw's 26 durability, so no overkill clamp.
  const s = createBossCombat(3);
  for (let i = 0; i < 3; i++) {
    s.player.sta = s.player.maxSta;
    const before = s.enemy.hp;
    useAbility(s, "tailStrike");
    expect(s.enemy.hp).toBe(before - 8);
  }
});
