import { expect, test } from "bun:test";
import { D1, D2, HUB, combatAction, combatPass, chooseEnding, createWorld, interact, nextObjective, optionalHere, step, type WorldState } from "../src/world";

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
  expect(w.npcLine!.toLowerCase()).toContain("verses"); // she points you at the song
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
  // Finish the fight WITHOUT the top-up helper so the HP sync is real
  // (correctness review round 1, MED-8: the old assertion was a tautology).
  w.combat!.enemy.hp = 5;
  w.combat!.enemy.dodge = 0;
  w.combat!.player.sta = 20;
  const hpAtKill = w.combat!.player.hp;
  combatAction(w, "tailStrike");
  expect(w.mode).toBe("explore");
  expect(w.encounters.find((e) => e.id === 1)?.defeated).toBe(true);
  expect(w.hp).toBe(hpAtKill);
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

test("heals spent in a fatal fight stay spent after respawn", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  expect(w.mode).toBe("combat");
  w.combat!.player.hp = 50;
  w.combat!.player.sta = 20;
  combatAction(w, "healSong");
  expect(w.combat!.healSongUses).toBe(1);
  w.combat!.player.hp = 1;
  let guard = 0;
  while (w.mode === "combat" && guard++ < 100) combatPass(w);
  expect(w.deaths).toBe(1);
  expect(w.healSongUses).toBe(1);
});

test("a failed combat input does not cost a turn", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  w.combat!.player.sta = 1;
  const hp = w.combat!.player.hp;
  const turn = w.combat!.turn;
  expect(combatAction(w, "tailStrike")).toBe(false);
  expect(w.combat!.player.hp).toBe(hp);
  expect(w.combat!.turn).toBe(turn);
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

test("song-seal: door blocks the alcove, hums its order, wrong note resets, right order opens", () => {
  const w = createWorld(9);
  walkTo(w, HUB.alcove.x, HUB.door.y + 1);
  step(w, "up");
  expect(w.pos.y).toBe(HUB.door.y + 1);
  expect(w.log.some((l) => l.includes("seal holds"))).toBe(true);

  interact(w); // near door: hums the order
  expect(w.log.some((l) => l.includes("door hums"))).toBe(true);

  // Correct first note, then the same stone again: a wrong continuation.
  walkTo(w, HUB.stones[w.melody[0]].x, HUB.stones[w.melody[0]].y);
  interact(w);
  expect(w.attempt.length).toBe(1);
  interact(w);
  expect(w.attempt.length).toBe(0);
  expect(w.log.some((l) => l.includes("seal resets"))).toBe(true);

  for (const idx of w.melody) {
    walkTo(w, HUB.stones[idx].x, HUB.stones[idx].y);
    interact(w);
  }
  expect(w.doorOpen).toBe(true);
  walkTo(w, HUB.alcove.x, HUB.door.y + 1);
  step(w, "up");
  step(w, "up");
  step(w, "up");
  expect(w.pos.y).toBe(HUB.alcove.y);
  expect(w.fragments.find((f) => f.id === 4)?.collected).toBe(true);
});

test("song-seal: melody order varies by seed but is deterministic", () => {
  const a1 = createWorld(1).melody.join("");
  const a2 = createWorld(1).melody.join("");
  expect(a1).toBe(a2);
  const others = [2, 3, 4, 5, 6].map((s) => createWorld(s).melody.join(""));
  expect(others.some((m) => m !== a1)).toBe(true);
});

test("boss 1 grants the relic; the mouth opens dungeon 2; boss 2 is victory", () => {
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
  w.healSongUses = 0;
  walkTo(w, HUB.mouth.x, HUB.mouth.y);
  expect(w.area).toBe("dungeon2");
  expect(w.healSongUses).toBe(2);
  expect(w.checkpoint.area).toBe("dungeon2");
  walkTo(w, 8, 4);
  expect(w.combat?.enemy.name).toBe("ink squid"); // the gullet guard is enemy type 2 now
  winFight(w);
  walkTo(w, 14, 4);
  winFight(w);
  walkTo(w, 21, 4);
  expect(w.combat?.enemy.name).toBe("corrupted eel");
  winFight(w);
  expect(w.mode).toBe("victory");
  expect(w.log.some((l) => l.includes("spills out of it"))).toBe(true);
});

test("boss 2 key part wanders by seed but is deterministic", () => {
  const { createBoss2Combat } = require("../src/game");
  const k1 = createBoss2Combat(1).boss.keyPartByPhase[1];
  const k1b = createBoss2Combat(1).boss.keyPartByPhase[1];
  expect(k1).toBe(k1b);
  const keys = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s2) => createBoss2Combat(s2).boss.keyPartByPhase[1]));
  expect(keys.size).toBeGreaterThan(1);
  for (const k of keys) expect(["eye", "fin", "tail"]).toContain(k);
});

test("THE PIPE: combat lines land in the world log the UI drains (skeptic F1)", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  expect(w.mode).toBe("combat");
  expect(w.combat!.log).toBe(w.log);
  const before = w.log.length;
  w.combat!.enemy.dodge = 0;
  combatAction(w, "tailStrike");
  expect(w.log.length).toBeGreaterThan(before);
  expect(w.log.some((l) => l.includes("Tail Strike"))).toBe(true);
});

test("trench suicide is never net-positive: hazard respawn capped at trench-entry HP (seat A HIGH, refuting the stale checkpoint cap)", () => {
  // seat A's exact exploit path: enter the dungeon HEALTHY (the old
  // checkpoint cap recorded 100 here and went stale), come out low,
  // and trench-suicide; the respawn must never beat the HP carried
  // into the trench
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y); // cpHp era: 100
  walkTo(w, D1.exitX, 4); // back to hub
  w.hp = 12; // fought low
  let guard = 0;
  while (w.deaths === 0 && guard++ < 200) {
    walkTo(w, 13, 6);
    step(w, "down");
    step(w, "up");
  }
  expect(w.deaths).toBe(1);
  expect(w.hp).toBeLessThanOrEqual(12);
  expect(w.pityDeaths).toBe(0);
});

test("trench suicide sweep: respawn never exceeds the HP carried in, at any HP, even after a combat death", () => {
  for (const hpBefore of [3, 9, 25, 41, 59, 80, 100]) {
    const w = createWorld();
    walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
    walkTo(w, D1.exitX, 4);
    w.hp = hpBefore;
    let guard = 0;
    while (w.deaths === 0 && guard++ < 300) {
      walkTo(w, 13, 6);
      step(w, "down");
      step(w, "up");
    }
    expect(w.deaths).toBe(1);
    expect(w.hp).toBeLessThanOrEqual(hpBefore);
    expect(w.hp).toBeLessThanOrEqual(60); // the 60 percent cap also holds
    expect(w.pityDeaths).toBe(0);
  }
  // seat A's combined seam: a combat death first (pity floor 60) must not
  // re-arm the trench as a heal afterwards
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4); // first squid
  w.combat!.player.hp = 1;
  let g = 0;
  while (w.mode === "combat" && g++ < 100) combatPass(w);
  expect(w.pityDeaths).toBe(1); // respawned at 60 by pity
  walkTo(w, D1.exitX, 4);
  w.hp = 9;
  let g2 = 0;
  while (w.deaths === 1 && g2++ < 200) {
    walkTo(w, 13, 6);
    step(w, "down");
    step(w, "up");
  }
  expect(w.deaths).toBe(2);
  expect(w.hp).toBeLessThanOrEqual(9);
  expect(w.pityDeaths).toBe(1); // hazard death still never climbs pity
});

test("pity ladder climbs on combat deaths only", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  w.combat!.player.hp = 1;
  let guard = 0;
  while (w.mode === "combat" && guard++ < 100) combatPass(w);
  expect(w.pityDeaths).toBe(1);
  expect(w.hp).toBe(60);
});

test("mercy rung: from the third pity death an empty Heal Song regains one charge, never before, never when charged", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  w.healSongUses = 0;
  for (let d = 1; d <= 5; d++) {
    walkTo(w, 8, 4);
    if (w.mode !== "combat") {
      // first squid may already be dead from a prior win; force the fight
      w.encounters[0].defeated = false;
      walkTo(w, 8, 4);
    }
    w.combat!.player.hp = 1;
    w.healSongUses = 0;
    w.combat!.healSongUses = 0;
    let g = 0;
    while (w.mode === "combat" && g++ < 200) combatPass(w);
    expect(w.pityDeaths).toBe(d);
    expect(w.healSongUses).toBe(d >= 3 ? 1 : 0);
  }
  // charged players get nothing from the rung
  w.healSongUses = 2;
  w.encounters[0].defeated = false;
  walkTo(w, 8, 4);
  w.combat!.player.hp = 1;
  let g2 = 0;
  while (w.mode === "combat" && g2++ < 200) combatPass(w);
  expect(w.healSongUses).toBe(2);
});

test("boss death returns one Heal Song charge when empty; trash deaths wait for the pity rung", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  winFight(w);
  walkTo(w, 12, 6);
  if (w.mode === "combat") winFight(w);
  walkTo(w, 21, 4); // the shark
  expect(w.mode).toBe("combat");
  w.healSongUses = 0;
  w.combat!.healSongUses = 0;
  w.combat!.player.hp = 1;
  let g = 0;
  while (w.mode === "combat" && g++ < 300) combatPass(w);
  expect(w.deaths).toBe(1);
  expect(w.healSongUses).toBe(1); // the boss loop is one-more-try
  expect(w.log.some((l) => l.includes("takes pity"))).toBe(true);
});

test("verses pay a dividend: each collected fragment is +1 max stamina in combat", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  expect(w.combat!.player.maxSta).toBe(20); // no verses gathered
  expect(w.combat!.player.sta).toBe(20);
  winFight(w);

  const w2 = createWorld();
  walkTo(w2, 7, 5); // hub verse 1
  expect(w2.fragments[0].collected).toBe(true);
  walkTo(w2, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w2, 8, 4);
  expect(w2.combat!.player.maxSta).toBe(21);
  expect(w2.combat!.player.sta).toBe(21);
});

test("the objective line always names a next step, and it changes with progress", () => {
  const w = createWorld();
  const seen = new Set<string>();
  seen.add(nextObjective(w));
  expect(nextObjective(w)).toContain("first ruin");
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  expect(w.area).toBe("dungeon1");
  seen.add(nextObjective(w));
  expect(nextObjective(w)).toContain("guardian");
  // clear the ruin: the objective must point HOME, not deeper
  for (const e of w.encounters) if (e.area === "dungeon1") e.defeated = true;
  w.hasTideRelic = true;
  seen.add(nextObjective(w));
  expect(nextObjective(w)).toContain("west");
  walkTo(w, D1.exitX, 4);
  expect(w.area).toBe("hub");
  seen.add(nextObjective(w));
  expect(nextObjective(w)).toContain("second ruin");
  expect(seen.size).toBe(4); // every stage speaks differently
  for (const line of seen) expect(line.length).toBeGreaterThan(8);
});

test("optional treasure is never silently missable: each area names what it still hides", () => {
  const w = createWorld(9);
  // hub opens with the sealed verse called out
  expect(optionalHere(w)).toBe("a sealed verse: sing the stones");
  walkTo(w, 7, 5); // take the open reef verse
  expect(optionalHere(w)).toBe("a sealed verse: sing the stones");
  // solve the seal: the line changes to say the way is open
  for (const idx of w.melody) {
    walkTo(w, HUB.stones[idx].x, HUB.stones[idx].y);
    interact(w);
  }
  expect(w.doorOpen).toBe(true);
  expect(optionalHere(w)).toBe("the alcove stands open: a verse waits");
  walkTo(w, HUB.alcove.x, HUB.door.y + 1);
  step(w, "up");
  step(w, "up");
  step(w, "up");
  expect(w.fragments.find((f) => f.id === 4)!.collected).toBe(true);
  // only the trench verse remains in the hub
  expect(optionalHere(w)).toBe("a verse in the low dark");
  // and a swept area says nothing at all
  const w2 = createWorld();
  for (const f of w2.fragments) f.collected = true;
  expect(optionalHere(w2)).toBe(null);
});

test("the ending is a choice, answerable once, and it reflects how much song came back", () => {
  const w = createWorld();
  expect(w.ending).toBeUndefined();
  expect(chooseEnding(w, "sung")).toBe(false); // not won yet
  w.mode = "victory";
  for (const f of w.fragments) f.collected = true;
  expect(chooseEnding(w, "sung")).toBe(true);
  expect(w.ending).toBe("sung");
  expect(w.log.some((l) => l.includes("whole name back"))).toBe(true);
  expect(w.log.some((l) => l.includes("the deep heard it too"))).toBe(true);
  expect(chooseEnding(w, "released")).toBe(false); // answered once, for good
  expect(w.ending).toBe("sung");

  // a thin song and the other answer read differently
  const w2 = createWorld();
  w2.mode = "victory";
  w2.fragments[0].collected = true;
  expect(chooseEnding(w2, "sung")).toBe(true);
  expect(w2.log.some((l) => l.includes("does not quite wake"))).toBe(true);

  const w3 = createWorld();
  w3.mode = "victory";
  for (const f of w3.fragments) f.collected = true;
  expect(chooseEnding(w3, "released")).toBe(true);
  expect(w3.log.some((l) => l.includes("let the name go"))).toBe(true);
  expect(w3.log.some((l) => l.includes("will not be called again"))).toBe(true);
});

test("every verse carries a lesson as well as a stat: understanding and power both", () => {
  const w = createWorld();
  for (const f of w.fragments) {
    expect(f.title.length).toBeGreaterThan(3);
    expect(f.lesson).toContain("(placeholder)");
    expect(f.lesson.length).toBeGreaterThan(60); // a real teaching, not a tag
    expect(f.verse).toContain("(placeholder)");
  }
  // the keepers' verse carries the inciting incident: why the songs faded
  const keepers = w.fragments.find((f) => f.title.includes("KEEPERS"))!;
  expect(keepers.lesson).toContain("on purpose");
});

test("the keeper answers what you carry: her line changes with the verses you hold", () => {
  const w = createWorld();
  walkTo(w, HUB.npc.x, HUB.npc.y);
  interact(w);
  const cold = w.npcLine!;
  expect(cold).toContain("came in singing"); // she establishes who you are

  const lines = new Set<string>([cold]);
  for (const id of [2, 3, 4, 5]) {
    w.fragments.find((f) => f.id === id)!.collected = true;
    interact(w);
    lines.add(w.npcLine!);
  }
  expect(lines.size).toBe(5); // a distinct answer per verse held
  expect(w.npcLine).toContain("what a name is for"); // the heaviest one wins
  // and every line stays marked for Marc
  for (const line of lines) expect(line).toContain("(placeholder)");
});

test("the first enemy of a ruin holds the corridor; every other enemy can be slipped past", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  expect(w.area).toBe("dungeon1");
  // try to swim around the guard at (8,4) along the top edge
  walkTo(w, 1, 0);
  let guard = 0;
  while (w.pos.x < 12 && w.mode === "explore" && guard++ < 40) step(w, "right");
  expect(w.mode).toBe("combat"); // the column is barred at any depth
  expect(w.combat!.enemy.name).toBe("vampire squid");
  expect(w.pos.x).toBe(8);
  winFight(w);

  // the SECOND squid guards a verse and is dodgeable by depth
  const before = w.encounters.find((e) => e.id === 2)!;
  expect(before.defeated).toBe(false);
  walkTo(w, 12, 3); // two tiles above it at (12,6)
  expect(w.mode).toBe("explore");
  let g2 = 0;
  while (w.pos.x < 19 && w.mode === "explore" && g2++ < 40) step(w, "right");
  expect(w.mode).toBe("explore"); // slipped past on purpose
  expect(w.encounters.find((e) => e.id === 2)!.defeated).toBe(false);
});

test("beating a corrupted thing gives it its name back: the reason to fight what you could dodge", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  expect(w.mode).toBe("combat");
  winFight(w);
  expect(w.log.some((l) => l.includes("its name back") && l.includes("vampire squid"))).toBe(true);
  // bosses do not get the line: they get their own deaths
  const bossLines = w.log.filter((l) => l.includes("its name back"));
  expect(bossLines.length).toBe(1);
});

test("either ending is reachable by choice alone, and answering is final", () => {
  // the UI routes arrows/A/D/Enter/Space/1/2/click into this one call,
  // so the sim-level contract is what every input path must satisfy
  for (const pick of ["sung", "released"] as const) {
    const w = createWorld();
    w.mode = "victory";
    w.fragments[0].collected = true;
    expect(chooseEnding(w, pick)).toBe(true);
    expect(w.ending).toBe(pick);
    const other = pick === "sung" ? "released" : "sung";
    expect(chooseEnding(w, other)).toBe(false);
    expect(w.ending).toBe(pick);
  }
});

test("pillar: the low dark is a world rule that rises, not a hub gimmick", () => {
  // hub: a bounded trench you can walk around
  const w = createWorld();
  walkTo(w, 13, 5);
  const hpBefore = w.hp;
  step(w, "down");
  expect(w.hp).toBe(hpBefore - HUB.trenchChip);

  // first ruin: the collapsed floor, bottom row only
  const w2 = createWorld();
  walkTo(w2, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  expect(w2.area).toBe("dungeon1");
  walkTo(w2, 3, 6);
  const safe = w2.hp;
  step(w2, "up"); // y=5, still safe
  expect(w2.hp).toBe(safe);
  walkTo(w2, 3, 6);
  step(w2, "down"); // y=7, the dark
  expect(w2.hp).toBeLessThan(safe);

  // gullet: it has RISEN a row, so the band is narrower
  const w3 = createWorld();
  w3.area = "dungeon2";
  w3.pos = { x: 3, y: 5 };
  const clear = w3.hp;
  step(w3, "down"); // y=6 is dark here but was safe in ruin 1
  expect(w3.hp).toBeLessThan(clear);
});

test("pillar: the song-seal recurs in the gullet, harder, and combines with the dark", () => {
  const w = createWorld(4);
  w.area = "dungeon2";
  w.pos = { ...D2.entrance };
  expect(w.melody2.length).toBe(4); // four notes, not three
  // two of its stones sit inside the low dark
  const deep = D2.stones.filter((st) => st.y >= 6);
  expect(deep.length).toBe(2);
  // the seal blocks its alcove until answered
  w.pos = { x: D2.seal.x, y: D2.seal.y };
  step(w, "up");
  expect(w.pos.y).toBe(D2.seal.y);
  expect(w.log.some((l) => l.includes("the gullet wants its song"))).toBe(true);
  // answering it in order opens the way to the verse
  for (const idx of w.melody2) {
    const st = D2.stones[idx];
    w.pos = { x: st.x, y: st.y };
    interact(w);
  }
  expect(w.seal2Open).toBe(true);
  w.pos = { x: D2.seal.x, y: D2.seal.y };
  step(w, "up");
  step(w, "up");
  expect(w.fragments.find((f) => f.id === 5)!.collected).toBe(true);
});

test("the two charged abilities have different scopes: heals span a ruin, guards reset per fight", () => {
  const w = createWorld();
  walkTo(w, HUB.dungeonEntrance.x, HUB.dungeonEntrance.y);
  walkTo(w, 8, 4);
  expect(w.mode).toBe("combat");
  // spend a guard and a heal in fight one
  w.combat!.player.hp = 40;
  w.combat!.player.sta = 20;
  combatAction(w, "bubble");
  expect(w.combat!.bubbleUses).toBe(1);
  w.combat!.player.sta = 20;
  combatAction(w, "healSong");
  expect(w.combat!.healSongUses).toBe(1);
  winFight(w);
  expect(w.healSongUses).toBe(1); // the heal stays spent for the ruin

  // fight two: the guard is back, the heal is not
  walkTo(w, 12, 6);
  expect(w.mode).toBe("combat");
  expect(w.combat!.bubbleUses).toBe(2); // per fight
  expect(w.combat!.healSongUses).toBe(1); // per ruin
});
