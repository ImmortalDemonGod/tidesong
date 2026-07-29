// Nav bot per the pinned policy in PROGRESS.md: axis-greedy stepping toward
// the current objective in a FIXED objective order; fights use the casual
// combat policy (softlock checks) or optimal (scripted full-run clear).
// No pathfinding smarter than axis-greedy, by design.

import { D1, D2, HUB, combatAction, combatPass, step, type AreaKey, type WorldState } from "../src/world";
import type { Bot } from "./bots";

interface Objective {
  area: AreaKey;
  target: { x: number; y: number };
  done: (w: WorldState) => boolean;
}

export function fullRoute(): Objective[] {
  return [
    { area: "hub", target: { x: 7, y: 5 }, done: (w) => w.fragments[0].collected },
    { area: "hub", target: { x: 14, y: 7 }, done: (w) => w.fragments[1].collected },
    { area: "dungeon1", target: { x: 8, y: 4 }, done: (w) => w.encounters[0].defeated },
    { area: "dungeon1", target: { x: 11, y: 6 }, done: (w) => w.fragments[2].collected },
    // squid 2 moved to guard the verse at (12,6) (playtest round: the
    // duplicate corridor fight gated the shark); waypoint is world DATA,
    // the pinned axis-greedy policy is unchanged
    { area: "dungeon1", target: { x: 12, y: 6 }, done: (w) => w.encounters[1].defeated },
    { area: "dungeon1", target: { x: 21, y: 4 }, done: (w) => w.encounters[2].defeated },
    { area: "hub", target: { x: HUB.mouth.x, y: HUB.mouth.y }, done: (w) => w.area === "dungeon2" || w.mode === "victory" },
    { area: "dungeon2", target: { x: 8, y: 4 }, done: (w) => w.encounters[3].defeated },
    // the gullet's verse now sits behind its own song-seal (pillar
    // audit), so the axis-greedy route skips it exactly as it already
    // skips the hub's sealed verse: bots do not solve puzzles

    { area: "dungeon2", target: { x: 14, y: 4 }, done: (w) => w.encounters[4].defeated },
    { area: "dungeon2", target: { x: 21, y: 4 }, done: (w) => w.mode === "victory" },
  ];
}

function stepToward(w: WorldState, t: { x: number; y: number }): void {
  if (w.pos.x < t.x) step(w, "right");
  else if (w.pos.x > t.x) step(w, "left");
  else if (w.pos.y < t.y) step(w, "down");
  else if (w.pos.y > t.y) step(w, "up");
}

export interface WorldRunResult {
  victory: boolean;
  actions: number;
  deaths: number;
  fragmentsCollected: number;
}

export function runWorld(
  w: WorldState,
  combatBotFactory: (fightIndex: number) => Bot,
  maxActions = 5000,
): WorldRunResult {
  const route = fullRoute();
  let actions = 0;
  let fightIndex = 0;
  let bot: Bot | null = null;
  while (w.mode !== "victory" && actions < maxActions) {
    actions += 1;
    if (w.mode === "combat" && w.combat) {
      if (!bot) bot = combatBotFactory(fightIndex++);
      const a = bot(w.combat);
      if (a) combatAction(w, a.ability, a.part);
      else combatPass(w);
      if (w.mode !== "combat") bot = null;
      continue;
    }
    const obj = route.find((o) => !o.done(w));
    if (!obj) break;
    if (obj.area !== w.area) {
      let transition: { x: number; y: number };
      if (w.area === "hub") {
        transition = obj.area === "dungeon2" ? HUB.mouth : HUB.dungeonEntrance;
      } else if (w.area === "dungeon1") {
        transition = { x: D1.exitX, y: D1.entrance.y };
      } else {
        transition = { x: D2.exitX, y: D2.entrance.y };
      }
      stepToward(w, transition);
    } else {
      stepToward(w, obj.target);
    }
  }
  return {
    victory: w.mode === "victory",
    actions,
    deaths: w.deaths,
    fragmentsCollected: w.fragments.filter((f) => f.collected).length,
  };
}
