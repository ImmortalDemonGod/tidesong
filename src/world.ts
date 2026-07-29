// World layer: hub reef, dungeon 1, relic gate, fragments, death rule.
// Pure simulation like game.ts: no DOM, no timers, fully bot-drivable.
//
// Decisions logged (per PROGRESS.md rules; sources cited):
// - Trench (Glass_Goat's "don't swim low"): entering a trench tile chips
//   2 HP per step, and one memory fragment sits inside it: risk for reward.
// - Heal Song uses restore on FIRST dungeon entry only; walking out and
//   back in does not refill (prevents a doorway-refill loop that would
//   erase the sacred-HP economy). Death respawn does not restore (DESIGN).
// - Fragments auto-collect on step-over (readable for bots and players);
//   NPC and the sealed door use the interact action.
// - Verse texts are PLACEHOLDER for Marc's story, marked as such.

import {
  advanceTurn,
  createBossCombat,
  createCombat,
  useAbility,
  type CombatState,
  type PartKey,
} from "./game";

export type AreaKey = "hub" | "dungeon1";
export type Mode = "explore" | "combat" | "victory";
export type Dir = "up" | "down" | "left" | "right";

export interface Vec {
  x: number;
  y: number;
}

export interface Fragment {
  id: number;
  area: AreaKey;
  x: number;
  y: number;
  collected: boolean;
  verse: string;
}

export interface Encounter {
  id: number;
  area: AreaKey;
  x: number;
  y: number;
  kind: "squid" | "boss";
  defeated: boolean;
}

export const AREAS: Record<AreaKey, { w: number; h: number }> = {
  hub: { w: 22, h: 8 },
  dungeon1: { w: 24, h: 8 },
};

// Hub landmarks. The current barrier occupies x >= BARRIER_X; the mouth of
// dungeon 2 (slice end) is at MOUTH. The trench is the rectangle TRENCH.
export const HUB = {
  start: { x: 2, y: 4 },
  npc: { x: 4, y: 4 },
  door: { x: 10, y: 2 },
  dungeonEntrance: { x: 18, y: 2 },
  barrierX: 20,
  mouth: { x: 21, y: 4 },
  trench: { x0: 12, x1: 15, y0: 6, y1: 7 },
  trenchChip: 2,
};

export const D1 = {
  entrance: { x: 1, y: 4 },
  exitX: 0,
};

export interface WorldState {
  mode: Mode;
  area: AreaKey;
  pos: Vec;
  hp: number;
  maxHp: number;
  healSongUses: number;
  healRestoredOnce: boolean;
  hasTideRelic: boolean;
  fragments: Fragment[];
  encounters: Encounter[];
  deaths: number;
  steps: number;
  checkpoint: { area: AreaKey; pos: Vec };
  combat?: CombatState;
  activeEncounter?: number;
  npcLine?: string;
  seed: number;
  log: string[];
}

export function createWorld(seed = 1): WorldState {
  return {
    mode: "explore",
    area: "hub",
    pos: { ...HUB.start },
    hp: 100,
    maxHp: 100,
    healSongUses: 2,
    healRestoredOnce: false,
    hasTideRelic: false,
    fragments: [
      // Verses are placeholder for Marc's story.
      { id: 1, area: "hub", x: 7, y: 5, collected: false, verse: "(placeholder) when the choir hall still sang" },
      { id: 2, area: "hub", x: 14, y: 7, collected: false, verse: "(placeholder) the low dark took the bravest first" },
      { id: 3, area: "dungeon1", x: 11, y: 6, collected: false, verse: "(placeholder) the shark was a guardian once" },
    ],
    encounters: [
      { id: 1, area: "dungeon1", x: 8, y: 4, kind: "squid", defeated: false },
      { id: 2, area: "dungeon1", x: 14, y: 4, kind: "squid", defeated: false },
      { id: 3, area: "dungeon1", x: 21, y: 4, kind: "boss", defeated: false },
    ],
    deaths: 0,
    steps: 0,
    checkpoint: { area: "hub", pos: { ...HUB.start } },
    seed: seed | 0,
    log: [],
  };
}

function inTrench(area: AreaKey, p: Vec): boolean {
  return (
    area === "hub" &&
    p.x >= HUB.trench.x0 &&
    p.x <= HUB.trench.x1 &&
    p.y >= HUB.trench.y0 &&
    p.y <= HUB.trench.y1
  );
}

// Pity escalator (added 01:05 after softlock data: flat 60 percent respawn
// with burned heals left 20 percent of casual runs death-looping forever,
// the exact compounding-punishment spiral the merge cut from the exhaustion
// system). 60 -> 75 -> 90 percent, capped: converges for a struggling
// player, still costs HP on a first death, and a deliberate death costs a
// lost fight, so it is never the efficient heal.
function applyDeath(w: WorldState): void {
  w.deaths += 1;
  const frac = Math.min(0.6 + 0.15 * (w.deaths - 1), 0.9);
  w.hp = Math.round(w.maxHp * frac);
  w.area = w.checkpoint.area;
  w.pos = { ...w.checkpoint.pos };
  w.mode = "explore";
  w.combat = undefined;
  w.activeEncounter = undefined;
  w.log.push(`death ${w.deaths}: respawn at checkpoint with ${w.hp} HP (heal uses kept: ${w.healSongUses})`);
}

function startCombat(w: WorldState, enc: Encounter): void {
  const seed = (w.seed * 31 + enc.id * 101 + w.deaths * 7) | 0;
  const c = enc.kind === "boss" ? createBossCombat(seed) : createCombat(seed);
  c.player.hp = w.hp;
  c.healSongUses = w.healSongUses;
  w.combat = c;
  w.activeEncounter = enc.id;
  w.mode = "combat";
  w.log.push(`combat: ${c.enemy.name}`);
}

function endCombat(w: WorldState): void {
  const c = w.combat!;
  if (c.outcome === "victory") {
    w.hp = c.player.hp;
    w.healSongUses = c.healSongUses;
    const enc = w.encounters.find((e) => e.id === w.activeEncounter)!;
    enc.defeated = true;
    if (enc.kind === "boss") {
      w.hasTideRelic = true;
      w.log.push("the Tide Relic is yours: the currents will part");
    }
    w.mode = "explore";
    w.combat = undefined;
    w.activeEncounter = undefined;
  } else if (c.outcome === "defeat") {
    applyDeath(w);
  }
}

export function combatAction(w: WorldState, ability: string, part?: PartKey): boolean {
  if (w.mode !== "combat" || !w.combat) return false;
  useAbility(w.combat, ability, part);
  if (w.combat.outcome === "ongoing") advanceTurn(w.combat);
  if (w.combat.outcome !== "ongoing") endCombat(w);
  return true;
}

// Pass the turn in combat without acting (not enough stamina, or a bot pass).
export function combatPass(w: WorldState): boolean {
  if (w.mode !== "combat" || !w.combat) return false;
  advanceTurn(w.combat);
  if (w.combat.outcome !== "ongoing") endCombat(w);
  return true;
}

const DELTAS: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function step(w: WorldState, dir: Dir): boolean {
  if (w.mode !== "explore") return false;
  w.steps += 1;
  const d = DELTAS[dir];
  const { w: aw, h: ah } = AREAS[w.area];
  const next = {
    x: Math.min(aw - 1, Math.max(0, w.pos.x + d.x)),
    y: Math.min(ah - 1, Math.max(0, w.pos.y + d.y)),
  };

  if (w.area === "hub" && next.x >= HUB.barrierX && !w.hasTideRelic) {
    w.pos.x = HUB.barrierX - 1;
    w.log.push("the current shoves you back: you need the Tide Relic");
    return true;
  }

  w.pos = next;

  if (w.area === "hub" && w.pos.x === HUB.dungeonEntrance.x && w.pos.y === HUB.dungeonEntrance.y) {
    w.area = "dungeon1";
    w.pos = { ...D1.entrance };
    w.checkpoint = { area: "dungeon1", pos: { ...D1.entrance } };
    if (!w.healRestoredOnce) {
      w.healSongUses = 2;
      w.healRestoredOnce = true;
      w.log.push("checkpoint: dungeon entrance (Heal Song restored)");
    } else {
      w.log.push("checkpoint: dungeon entrance");
    }
    return true;
  }

  if (w.area === "dungeon1" && w.pos.x <= D1.exitX) {
    w.area = "hub";
    w.pos = { ...HUB.dungeonEntrance };
    w.log.push("back to the hub reef");
    return true;
  }

  if (inTrench(w.area, w.pos)) {
    w.hp = Math.max(0, w.hp - HUB.trenchChip);
    w.log.push(`the low dark bites: -${HUB.trenchChip} HP`);
    if (w.hp <= 0) {
      applyDeath(w);
      return true;
    }
  }

  for (const f of w.fragments) {
    if (!f.collected && f.area === w.area && f.x === w.pos.x && f.y === w.pos.y) {
      f.collected = true;
      w.log.push(`memory fragment: "${f.verse}"`);
    }
  }

  for (const e of w.encounters) {
    if (
      !e.defeated &&
      e.area === w.area &&
      Math.abs(e.x - w.pos.x) + Math.abs(e.y - w.pos.y) <= 1
    ) {
      startCombat(w, e);
      return true;
    }
  }

  if (w.area === "hub" && w.hasTideRelic && w.pos.x >= HUB.mouth.x && w.pos.y === HUB.mouth.y) {
    w.mode = "victory";
    w.log.push("the currents part: the way to the second ruin lies open");
  }

  return true;
}

export function interact(w: WorldState): boolean {
  if (w.mode !== "explore") return false;
  const near = (p: { x: number; y: number }) =>
    Math.abs(p.x - w.pos.x) + Math.abs(p.y - w.pos.y) <= 1;
  if (w.area === "hub" && near(HUB.npc)) {
    w.npcLine = "Follow the fragments, little one. The songs remember the way.";
    w.log.push(`npc: ${w.npcLine}`);
    return true;
  }
  if (w.area === "hub" && near(HUB.door)) {
    w.log.push("the song-seal door hums, unmoved. (its melody is not yet known)");
    return true;
  }
  return false;
}
