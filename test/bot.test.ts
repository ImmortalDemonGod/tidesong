import { expect, test } from "bun:test";
import { ABILITIES, BASE, createCombat, endTurn, hasCondition, useAbility } from "../src/game";

test("initial resources match the agreed design baseline", () => {
  const s = createCombat();
  expect(s.player.hp).toBe(100);
  expect(s.player.sta).toBe(20);
});

test("every action costs stamina", () => {
  const s = createCombat();
  useAbility(s, "tailStrike");
  expect(s.player.sta).toBe(BASE.playerSta - ABILITIES.tailStrike.staCost);
});

test("a landed disable inflicts the condition and refunds stamina", () => {
  const s = createCombat();
  const before = s.player.sta;
  useAbility(s, "siltBurst");
  expect(hasCondition(s.enemy, "blind")).toBe(true);
  expect(s.player.sta).toBe(before - ABILITIES.siltBurst.staCost + BASE.disableRefund);
});

test("re-applying an existing condition does not refund again", () => {
  const s = createCombat();
  useAbility(s, "siltBurst");
  const before = s.player.sta;
  useAbility(s, "siltBurst");
  expect(s.player.sta).toBe(before - ABILITIES.siltBurst.staCost);
});

test("re-applying refreshes the condition's duration", () => {
  const s = createCombat();
  useAbility(s, "siltBurst");
  endTurn(s);
  useAbility(s, "siltBurst");
  endTurn(s);
  expect(hasCondition(s.enemy, "blind")).toBe(true);
  endTurn(s);
  expect(hasCondition(s.enemy, "blind")).toBe(false);
});

test("conditions tick down and expire; stamina regenerates each turn", () => {
  const s = createCombat();
  useAbility(s, "siltBurst");
  endTurn(s);
  expect(hasCondition(s.enemy, "blind")).toBe(true);
  endTurn(s);
  expect(hasCondition(s.enemy, "blind")).toBe(false);
  expect(s.player.sta).toBeGreaterThan(0);
  expect(s.player.sta).toBeLessThanOrEqual(s.player.maxSta);
});

test("abilities fail cleanly without enough stamina", () => {
  const s = createCombat();
  s.player.sta = 1;
  expect(useAbility(s, "tailStrike")).toBe(false);
  expect(s.player.sta).toBe(1);
});
