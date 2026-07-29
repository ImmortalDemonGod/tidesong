import { expect, test } from "bun:test";
import { D1, HUB, combatAction, combatPass, createWorld, interact, step, type WorldState } from "../src/world";

function walkTo(w: WorldState, x: number, y: number, cap = 200): void {
  // Stops on any area or mode change: entering a dungeon or a fight is a
  // route event the test must handle explicitly, not walk through.
  const area = w.area;
  let guard = 0;
  while (
    (w.pos.x !== x || w.pos.y !== y) &&
    w.mode === "explore" &&
    w.area === area &&
    guard++ < cap
  ) {
    if (w.pos.x < x) step(w, "right");
    else if (w.pos.x > x) step(w, "left");
    else if (w.pos.y < y) step(w, "down");
    else step(w, "up");
  }
}

// Beat the active fight quickly and deterministically for world-flow tests.
function winFight(w: WorldState): void {
  // Flow helper, not a balance probe: tops up STA and HP so world-flow
  // tests never depend on combat tuning (bands.test.ts owns balance).
  let guard = 0;
  while (w.mode === "combat" && guard++ < 200) {
    w.combat!.player.sta = w.combat!.player.maxSta;
    w.combat!.player.hp = w.combat!.player.maxHp;
    combatAction(w, "tailStrike");
  }
  if (w.mode === "explore") w.hp = w.maxHp;
}

test("world starts in the hub with full resources", () => {
  const w = createWorld();
  expect(w.mode).toBe("explore");
  expect(w.area).toBe("hub");
  expect(w.hp).toBe(100);
  expect(w.healSongUses).toBe(2);
  expect(w.hasTideRelic).toBe(false);
});

test("movement clamps to area bounds", () => {
  const w = createWorld();
  for (let i = 0; i < 30; i++) step(w, "left");
  expect(w.pos.x).toBe(0);
});

test("fragments auto-collect on step-over and log their verse", () => {
  const w = createWorld();
  walkTo(w, 7, 5);
  expect(w.fragments.find((f) => f.id === 1)?.collected).toBe(true);
  expect(w.log.some((l) => l.includes("memory fragment"))).toBe(true);
});

test("the trench chips HP per step (don't swim low)", () => {
  const w = createWorld();
  walkTo(w, 13, 5);
  const hp = w.hp;
  step(w, "down");
  expect(w.hp).toBe(hp - HUB.trenchChip);
});

test("G1 invariant: the barrier is impassable without the relic", () => {
  const w = createWorld();
  walkTo(w, HUB.barrierX - 1, 4);
  for (let i = 0; i < 10; i++) step(w, "right");
  expect(w.pos.x).toBe(HUB.barrierX - 1);
  expect(w.mode).toBe("explore");
  expect(w.log.some((l) => l.includes("Tide Relic"))).toBe(true);
});

test("npc talks and the sealed door hums", () => {
  const w = createWorld();
  walkTo(w, 4, 4);
  expect(interact(w)).toBe(true);
  expect(w.npcLine).toContain("fragments");
  walkTo(w, 10, 3);
  expect(interact(w)).toBe(true);
  expect(w.log.some((l) => l.includes("song-seal"))).toBe(true);
});

test("dungeon entry sets the checkpoint and restores Heal Song once only", () => {
  const w = createWorld();
  w.healSongUses = 0;
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  expect(w.area).toBe("dungeon1");
  expect(w.checkpoint.area).toBe("dungeon1");
  expect(w.healSongUses).toBe(2);
  w.healSongUses = 0;
  walkTo(w, D1.exitX, 4);
  expect(w.area).toBe("hub");
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  expect(w.healSongUses).toBe(0);
});

test("encounters trigger combat carrying persistent HP, victory syncs back", () => {
  const w = createWorld();
  w.hp = 77;
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  expect(w.mode).toBe("combat");
  expect(w.combat?.player.hp).toBe(77);
  winFight(w);
  expect(w.mode).toBe("explore");
  expect(w.encounters.find((e) => e.id === 1)?.defeated).toBe(true);
  expect(w.hp).toBe(w.combat?.player.hp ?? w.hp);
});

test("death: respawn at checkpoint with 60 percent HP, heals kept, encounter resets", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  w.healSongUses = 1;
  walkTo(w, 8, 4);
  expect(w.mode).toBe("combat");
  w.combat!.player.hp = 1;
  let guard = 0;
  while (w.mode === "combat" && guard++ < 100) combatPass(w);
  expect(w.deaths).toBe(1);
  expect(w.hp).toBe(60);
  expect(w.pos.x).toBe(D1.entrance.x);
  expect(w.healSongUses).toBe(1);
  expect(w.encounters.find((e) => e.id === 1)?.defeated).toBe(false);
});

test("pity escalator: respawn HP climbs 60, 75, 90 and caps at 90", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  const observed: number[] = [];
  for (let i = 0; i < 4; i++) {
    walkTo(w, 8, 4);
    w.combat!.player.hp = 1;
    let guard = 0;
    while (w.mode === "combat" && guard++ < 100) combatPass(w);
    observed.push(w.hp);
  }
  expect(observed).toEqual([60, 75, 90, 90]);
});

test("boss victory grants the Tide Relic; the barrier parts; slice victory", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  winFight(w);
  walkTo(w, 14, 4);
  winFight(w);
  walkTo(w, 21, 4);
  expect(w.mode).toBe("combat");
  winFight(w);
  expect(w.hasTideRelic).toBe(true);
  walkTo(w, D1.exitX, 4);
  expect(w.area).toBe("hub");
  walkTo(w, HUB.mouth.x, HUB.mouth.y);
  expect(w.mode).toBe("victory");
});
