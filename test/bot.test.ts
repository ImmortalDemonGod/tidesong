import { expect, test } from "bun:test";
import {
  ABILITIES,
  BASE,
  advanceTurn,
  createCombat,
  getCondition,
  hasCondition,
  useAbility,
} from "../src/game";

// ---------- economy ----------

test("initial resources match the design baseline", () => {
  const s = createCombat();
  expect(s.player.hp).toBe(100);
  expect(s.player.sta).toBe(20);
  expect(s.healSongUses).toBe(2);
});

test("every action costs stamina", () => {
  const s = createCombat();
  useAbility(s, "tailStrike");
  expect(s.player.sta).toBe(BASE.playerSta - ABILITIES.tailStrike.staCost);
});

test("abilities fail cleanly without enough stamina", () => {
  const s = createCombat();
  s.player.sta = 1;
  expect(useAbility(s, "tailStrike")).toBe(false);
  expect(s.player.sta).toBe(1);
});

test("stamina regenerates each turn, capped at max", () => {
  const s = createCombat();
  s.enemy.conditions.push({ kind: "slow", level: 1, turns: 9 });
  s.player.sta = 5;
  advanceTurn(s);
  expect(s.player.sta).toBe(5 + BASE.staRegenPerTurn);
  s.player.sta = s.player.maxSta;
  advanceTurn(s);
  expect(s.player.sta).toBe(s.player.maxSta);
});

// ---------- condition levels (Glass_Goat's stacking) ----------

test("first application: level I plus stamina refund", () => {
  const s = createCombat();
  const before = s.player.sta;
  useAbility(s, "siltBurst");
  const c = getCondition(s.enemy, "blind");
  expect(c?.level).toBe(1);
  expect(s.player.sta).toBe(before - ABILITIES.siltBurst.staCost + BASE.disableRefund);
});

test("second application: level II, full price, no refund", () => {
  const s = createCombat();
  useAbility(s, "siltBurst");
  const before = s.player.sta;
  useAbility(s, "siltBurst");
  const c = getCondition(s.enemy, "blind");
  expect(c?.level).toBe(2);
  expect(s.player.sta).toBe(before - ABILITIES.siltBurst.staCost);
});

test("application at level II: refreshes duration only, stays II", () => {
  const s = createCombat();
  useAbility(s, "siltBurst");
  useAbility(s, "siltBurst");
  advanceTurn(s);
  const before = s.player.sta;
  useAbility(s, "siltBurst");
  const c = getCondition(s.enemy, "blind");
  expect(c?.level).toBe(2);
  expect(c?.turns).toBe(ABILITIES.siltBurst.inflictTurns);
  expect(s.player.sta).toBe(before - ABILITIES.siltBurst.staCost);
});

test("durations: N turns means N enemy action slots, then expiry", () => {
  const s = createCombat();
  useAbility(s, "siltBurst");
  advanceTurn(s);
  expect(hasCondition(s.enemy, "blind")).toBe(true);
  advanceTurn(s);
  expect(hasCondition(s.enemy, "blind")).toBe(false);
});

test("conditions always land even when damage is dodged", () => {
  const s = createCombat();
  s.enemy.dodge = 1;
  useAbility(s, "siltBurst");
  expect(s.enemy.hp).toBe(s.enemy.maxHp);
  expect(hasCondition(s.enemy, "blind")).toBe(true);
});

// ---------- blind ----------

test("blind I reduces enemy hits across seeded runs", () => {
  let lossBlind = 0;
  let lossNone = 0;
  for (let seed = 0; seed < 200; seed++) {
    const a = createCombat(seed);
    a.enemy.conditions.push({ kind: "blind", level: 1, turns: 1 });
    advanceTurn(a);
    lossBlind += a.player.maxHp - a.player.hp;
    const b = createCombat(seed);
    advanceTurn(b);
    lossNone += b.player.maxHp - b.player.hp;
  }
  expect(lossBlind).toBeLessThan(lossNone * 0.6);
});

test("blind II zeroes enemy dodge: player attacks always land", () => {
  const s = createCombat();
  s.enemy.dodge = 1;
  useAbility(s, "siltBurst");
  useAbility(s, "siltBurst");
  const hpBefore = s.enemy.hp;
  useAbility(s, "tailStrike");
  expect(s.enemy.hp).toBe(hpBefore - ABILITIES.tailStrike.damage);
});

// ---------- slow ----------

test("slow skips every other enemy action", () => {
  const s = createCombat(7);
  s.enemy.conditions.push({ kind: "slow", level: 1, turns: 4 });
  const losses: number[] = [];
  for (let i = 0; i < 4; i++) {
    const hp = s.player.hp;
    advanceTurn(s);
    losses.push(hp - s.player.hp);
  }
  expect(losses[0]).toBe(0);
  expect(losses[1]).toBeGreaterThan(0);
  expect(losses[2]).toBe(0);
  expect(losses[3]).toBeGreaterThan(0);
});

test("slow II reduces enemy damage when it does act", () => {
  const s = createCombat();
  s.enemy.conditions.push({ kind: "slow", level: 2, turns: 2 });
  advanceTurn(s);
  expect(s.player.hp).toBe(s.player.maxHp);
  advanceTurn(s);
  expect(s.player.maxHp - s.player.hp).toBe(
    Math.round(s.enemy.attackDamage * BASE.slowDamageMult),
  );
});

// ---------- heal song / bubble / analyze ----------

test("heal song: +40 capped at max, exactly 2 uses", () => {
  const s = createCombat();
  s.enemy.conditions.push({ kind: "slow", level: 1, turns: 99 });
  s.player.hp = 30;
  useAbility(s, "healSong");
  expect(s.player.hp).toBe(70);
  s.player.hp = 90;
  s.player.sta = 20;
  useAbility(s, "healSong");
  expect(s.player.hp).toBe(100);
  s.player.sta = 20;
  expect(useAbility(s, "healSong")).toBe(false);
});

test("bubble reduces the next landing hit and is consumed", () => {
  const s = createCombat();
  useAbility(s, "bubble");
  advanceTurn(s);
  const firstLoss = s.player.maxHp - s.player.hp;
  expect(firstLoss).toBe(Math.round(s.enemy.attackDamage * (1 - BASE.bubbleReduction)));
  const hp = s.player.hp;
  advanceTurn(s);
  expect(hp - s.player.hp).toBe(s.enemy.attackDamage);
});

test("analyze sets the analyzed flag for 1 STA", () => {
  const s = createCombat();
  useAbility(s, "analyze");
  expect(s.analyzed).toBe(true);
  expect(s.player.sta).toBe(BASE.playerSta - 1);
});

// ---------- outcomes ----------

test("victory at enemy 0 HP; no actions afterward", () => {
  const s = createCombat();
  s.enemy.dodge = 0;
  s.enemy.hp = 5;
  useAbility(s, "tailStrike");
  expect(s.outcome).toBe("victory");
  expect(useAbility(s, "tailStrike")).toBe(false);
});

test("defeat at player 0 HP", () => {
  const s = createCombat();
  s.player.hp = 5;
  advanceTurn(s);
  expect(s.player.hp).toBe(0);
  expect(s.outcome).toBe("defeat");
});

// ---------- invariants under fuzz (G1 seed) ----------

// Deterministic round-robin invariant sweep, combat layer only. The real
// randomized fuzz (world level, hostile inputs) lives in test/fuzz.test.ts.
test("invariant sweep: deterministic round-robin across 100 seeds", () => {
  const keys = Object.keys(ABILITIES);
  for (let seed = 0; seed < 100; seed++) {
    const s = createCombat(seed);
    let guard = 0;
    while (s.outcome === "ongoing" && guard++ < 200) {
      const pick = keys[Math.floor((guard * 7 + seed * 13) % keys.length)];
      useAbility(s, pick);
      advanceTurn(s);
      expect(s.player.sta).toBeGreaterThanOrEqual(0);
      expect(s.player.sta).toBeLessThanOrEqual(s.player.maxSta);
      expect(s.player.hp).toBeGreaterThanOrEqual(0);
      expect(s.player.hp).toBeLessThanOrEqual(s.player.maxHp);
      expect(s.enemy.hp).toBeGreaterThanOrEqual(0);
      for (const c of s.enemy.conditions) {
        expect(c.turns).toBeGreaterThan(0);
        expect(c.level === 1 || c.level === 2).toBe(true);
      }
    }
    expect(s.outcome === "ongoing" && guard >= 200).toBe(false);
  }
});
