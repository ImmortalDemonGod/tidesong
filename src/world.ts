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
  createBoss2Combat,
  createBossCombat,
  createCombat,
  createElderCombat,
  createInkCombat,
  useAbility,
  type CombatState,
  type PartKey,
} from "./game";

export type AreaKey = "hub" | "dungeon1" | "dungeon2";
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
  kind: "squid" | "elder" | "ink" | "boss" | "boss2";
  defeated: boolean;
}

export const AREAS: Record<AreaKey, { w: number; h: number }> = {
  hub: { w: 22, h: 8 },
  dungeon1: { w: 24, h: 8 },
  dungeon2: { w: 24, h: 8 },
};

// Hub landmarks. The current barrier occupies x >= BARRIER_X; the mouth of
// dungeon 2 (slice end) is at MOUTH. The trench is the rectangle TRENCH.
export const HUB = {
  start: { x: 2, y: 4 },
  npc: { x: 4, y: 4 },
  door: { x: 10, y: 2 },
  alcove: { x: 10, y: 0 },
  stones: [
    { name: "dusk", x: 8, y: 3 },
    { name: "dawn", x: 10, y: 4 },
    { name: "tide", x: 12, y: 3 },
  ],
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

export const D2 = {
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
  healRestored: Record<"dungeon1" | "dungeon2", boolean>;
  hasTideRelic: boolean;
  fragments: Fragment[];
  encounters: Encounter[];
  deaths: number;
  // pity ladder counts COMBAT deaths only; hazard suicide may not climb it
  pityDeaths: number;
  // HP held when the player last crossed INTO the trench: hazard respawns
  // cap here, so a fight-free death can never return more HP than was
  // carried into the hazard (confirmation seat A refuted the previous
  // checkpoint-HP cap: it was written only on dungeon entry and went
  // stale-high, leaving trench suicide a repeatable net-positive heal)
  trenchEntryHp: number;
  steps: number;
  // one contextual teaching line for the death veil, chosen from the
  // fatal fight's state (playtest: deaths refunded HP but taught nothing)
  lastDeathHint?: string;
  checkpoint: { area: AreaKey; pos: Vec };
  combat?: CombatState;
  activeEncounter?: number;
  npcLine?: string;
  // Song-seal puzzle: the door hums a seeded 3-note order; echo it on the
  // stones to open the alcove (stretch item 8; sketch shows the 3 glyphs).
  melody: number[];
  attempt: number[];
  doorOpen: boolean;
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
    healRestored: { dungeon1: false, dungeon2: false },
    hasTideRelic: false,
    fragments: [
      // Draft verses (placeholder-marked for Marc: an arc he can keep,
      // rewrite, or discard). The five lines tell the fall and the
      // return: the choir, the dark, the guardian, the keepers, the
      // swallowed name. Filled in Jul 29 under the playtest mandate.
      { id: 1, area: "hub", x: 7, y: 5, collected: false, verse: "(placeholder) we sang the tides their names, and the tides came when we called" },
      { id: 2, area: "hub", x: 14, y: 7, collected: false, verse: "(placeholder) when the songs thinned, the low dark learned to swallow the brave" },
      { id: 3, area: "dungeon1", x: 11, y: 6, collected: false, verse: "(placeholder) the guardian kept his post long after the music left his mind" },
      { id: 4, area: "hub", x: HUB.alcove.x, y: HUB.alcove.y, collected: false, verse: "(placeholder) the keepers hid their brightest verse for the one who would come singing" },
      { id: 5, area: "dungeon2", x: 11, y: 2, collected: false, verse: "(placeholder) last of all the eel drank down the name of the sea itself" },
    ],
    encounters: [
      { id: 1, area: "dungeon1", x: 8, y: 4, kind: "squid", defeated: false },
      // moved off the corridor to guard the ruin's verse (playtest: a
      // duplicate corridor fight gated the shark, the build's best screen)
      { id: 2, area: "dungeon1", x: 12, y: 6, kind: "squid", defeated: false },
      { id: 3, area: "dungeon1", x: 21, y: 4, kind: "boss", defeated: false },
      { id: 4, area: "dungeon2", x: 8, y: 4, kind: "elder", defeated: false },
      // enemy type 2 (Jul 29, playtest fun mandate): the second ruin's
      // second fight introduces the ink squid before the eel
      { id: 5, area: "dungeon2", x: 14, y: 4, kind: "ink", defeated: false },
      { id: 6, area: "dungeon2", x: 21, y: 4, kind: "boss2", defeated: false },
    ],
    deaths: 0,
    pityDeaths: 0,
    trenchEntryHp: 100,
    steps: 0,
    checkpoint: { area: "hub", pos: { ...HUB.start } },
    melody: shuffledMelody(seed | 0),
    attempt: [],
    doorOpen: false,
    seed: seed | 0,
    log: [],
  };
}

// Seeded Fisher-Yates over [0,1,2]: the note order differs per run but is
// deterministic per seed (bots and tests stay reproducible).
function shuffledMelody(seed: number): number[] {
  const order = [0, 1, 2];
  let s = (seed ^ 0x5019) | 0;
  for (let i = order.length - 1; i > 0; i--) {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const j = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * (i + 1) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
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

// Pity escalator (added after softlock data: flat 60 percent respawn
// with burned heals left 20 percent of casual runs death-looping forever,
// the exact compounding-punishment spiral the merge cut from the exhaustion
// system). 60 -> 75 -> 90 percent, capped: converges for a struggling
// player, still costs HP on a first death, and a deliberate death costs a
// lost fight, so it is never the efficient heal.
function applyDeath(w: WorldState, cause: "combat" | "hazard" = "combat"): void {
  w.deaths += 1;
  if (cause === "combat") {
    // the pity escalator exists for repeated COMBAT failure
    w.pityDeaths += 1;
    const frac = Math.min(0.6 + 0.15 * (w.pityDeaths - 1), 0.9);
    w.hp = Math.round(w.maxHp * frac);
  } else {
    // hazard deaths are fight-free: respawn HP is capped at what you
    // carried into the trench THIS excursion, so suicide can never be
    // net-positive (confirmation seat A: the checkpoint-HP cap went
    // stale-high and the exploit survived; entry HP has no stale state)
    w.hp = Math.min(Math.round(w.maxHp * 0.6), Math.max(1, w.trenchEntryHp));
  }
  w.area = w.checkpoint.area;
  w.pos = { ...w.checkpoint.pos };
  w.mode = "explore";
  w.combat = undefined;
  w.activeEncounter = undefined;
  w.log.push(`death ${w.deaths}: respawn at checkpoint with ${w.hp} HP (heal uses kept: ${w.healSongUses})`);
}

function startCombat(w: WorldState, enc: Encounter): void {
  const seed = (w.seed * 31 + enc.id * 101 + w.deaths * 7) | 0;
  const c =
    enc.kind === "boss"
      ? createBossCombat(seed)
      : enc.kind === "boss2"
        ? createBoss2Combat(seed, w.seed)
        : enc.kind === "elder"
          ? createElderCombat(seed)
          : enc.kind === "ink"
            ? createInkCombat(seed)
            : createCombat(seed);
  c.player.hp = w.hp;
  c.healSongUses = w.healSongUses;
  c.relicEcho = w.hasTideRelic;
  // THE PIPE: combat pushes its lines into the world log the UI drains.
  // Without this line every combat sound, floater, and ticker entry is
  // dead in the played game (skeptic round F1, CRITICAL: verified zero
  // oscillator starts across an entire fought fight).
  c.log = w.log;
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
    if (enc.kind === "boss2") {
      w.mode = "victory";
      w.log.push("the second ruin falls silent: the sea remembers its song");
      w.combat = undefined;
      w.activeEncounter = undefined;
      return;
    }
    w.mode = "explore";
    w.combat = undefined;
    w.activeEncounter = undefined;
  } else if (c.outcome === "defeat") {
    // Sync heals SPENT in the fatal fight before respawning; without this,
    // death un-spends Heal Song, the exact refund the death rule forbids
    // (found by fidelity review round 1, HIGH).
    w.healSongUses = c.healSongUses;
    // one teaching line for the veil, chosen from what the fatal fight
    // never used (masher playtest: the pity ladder escalates HP; this
    // escalates knowledge with it)
    w.lastDeathHint =
      c.boss && !c.analyzed
        ? "Analyze (5) would have named its weak part"
        : c.conditionsApplied === 0
          ? "the corruption fears song: Silt Burst (2) blinds, Fin Slash (3) slows"
          : c.boss && c.aimedHits === 0
            ? "aim with up/down: drifting strikes feed it"
            : "the sea forgives: press on";
    applyDeath(w);
  }
}

// UI-facing split: the player's beat and the enemy's beat are separate so
// the played game shows a visible exchange instead of both resolving in
// one keypress (user-found during the run: "it's not an API, it's a
// game"). The sim stays synchronous; pacing lives in the UI layer.
export function playerAct(w: WorldState, ability: string, part?: PartKey): boolean {
  if (w.mode !== "combat" || !w.combat) return false;
  // A failed input (not enough stamina, no heal uses) must NOT cost a turn;
  // combatPass is the only explicit pass (fidelity review round 1, MED).
  if (!useAbility(w.combat, ability, part)) return false;
  if (w.combat.outcome !== "ongoing") endCombat(w);
  return true;
}

export function enemySlot(w: WorldState): boolean {
  if (w.mode !== "combat" || !w.combat) return false;
  advanceTurn(w.combat);
  if (w.combat.outcome !== "ongoing") endCombat(w);
  return true;
}

// Bot/test composition: identical behavior to the original combatAction.
export function combatAction(w: WorldState, ability: string, part?: PartKey): boolean {
  if (!playerAct(w, ability, part)) return false;
  if (w.mode === "combat") enemySlot(w);
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

  // The sealed alcove: the door tile and everything above it are blocked
  // until the song opens it.
  if (w.area === "hub" && !w.doorOpen && next.x === HUB.alcove.x && next.y <= HUB.door.y) {
    w.log.push("the seal holds: the door wants its song");
    return true;
  }

  const moved = next.x !== w.pos.x || next.y !== w.pos.y;
  const wasInTrench = inTrench(w.area, w.pos);
  w.pos = next;
  // A wall bump that goes nowhere triggers no tile effects (correctness
  // review round 1, LOW-10: trench chipped HP on no-op bumps).
  if (!moved) return true;

  if (w.area === "hub" && w.pos.x === HUB.dungeonEntrance.x && w.pos.y === HUB.dungeonEntrance.y) {
    enterDungeon(w, "dungeon1", D1.entrance);
    return true;
  }

  if (w.area === "dungeon1" && w.pos.x <= D1.exitX) {
    w.area = "hub";
    w.pos = { ...HUB.dungeonEntrance };
    w.log.push("back to the hub reef");
    return true;
  }

  if (w.area === "dungeon2" && w.pos.x <= D2.exitX) {
    w.area = "hub";
    w.pos = { x: HUB.barrierX - 1, y: HUB.mouth.y };
    w.log.push("back to the hub reef");
    return true;
  }

  if (inTrench(w.area, w.pos)) {
    // the hazard death cap tracks the LOWEST pre-chip HP held inside the
    // trench this excursion: recorded at the crossing and ratcheted down
    // on every step inside, so no entry path (or state poke) can leave it
    // stale-high the way the old checkpoint cap was
    w.trenchEntryHp = wasInTrench ? Math.min(w.trenchEntryHp, w.hp) : w.hp;
    w.hp = Math.max(0, w.hp - HUB.trenchChip);
    w.log.push(`the low dark bites: -${HUB.trenchChip} HP`);
    if (w.hp <= 0) {
      applyDeath(w, "hazard");
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
    w.log.push("the currents part: the second ruin opens before you");
    enterDungeon(w, "dungeon2", D2.entrance);
  }

  return true;
}

function enterDungeon(w: WorldState, area: "dungeon1" | "dungeon2", entrance: Vec): void {
  w.area = area;
  w.pos = { ...entrance };
  w.checkpoint = { area, pos: { ...entrance } };
  if (!w.healRestored[area]) {
    w.healSongUses = 2;
    w.healRestored[area] = true;
    w.log.push("checkpoint: dungeon entrance (Heal Song restored)");
    // the same current mends wounds ONCE per dungeon: a legitimate
    // recovery point so a deliberate death is never the best plan and
    // the second gauntlet is not entered broken (both the tactician and
    // the masher playtests hit this from opposite directions)
    if (w.hp < 65) {
      w.hp = 65;
      w.log.push("the entrance current mends your wounds");
    }
  } else {
    w.log.push("checkpoint: dungeon entrance");
  }
}

export function interact(w: WorldState): boolean {
  if (w.mode !== "explore") return false;
  const near = (p: { x: number; y: number }) =>
    Math.abs(p.x - w.pos.x) + Math.abs(p.y - w.pos.y) <= 1;
  if (w.area === "hub" && near(HUB.npc)) {
    // The guide notices your progress (all lines placeholder for Marc's
    // story; the UI strips the mark into a tag). Story delivery was
    // under-staged: one line forever (fun diagnosis, agent 3 MED).
    const frags = w.fragments.filter((f) => f.collected).length;
    w.npcLine = w.hasTideRelic
      ? "(placeholder) The relic hums against your scales. The second ruin's mouth waits past the parted current."
      : w.doorOpen
        ? "(placeholder) You gave the door its song back. The first ruin lies east; its guardian forgot its own name."
        : frags >= 2
          ? "(placeholder) The verses gather around you. The stones by the door know their order; sing it to them."
          : "Follow the fragments, little one. The songs remember the way.";
    w.log.push(`npc: ${w.npcLine}`);
    return true;
  }
  if (w.area === "hub" && near(HUB.door)) {
    if (w.doorOpen) {
      w.log.push("the song-seal door stands open, its song spent");
    } else {
      const names = w.melody.map((i) => HUB.stones[i].name).join(", ");
      w.log.push(`the song-seal door hums: ${names}`);
    }
    return true;
  }
  if (w.area === "hub" && !w.doorOpen) {
    const idx = HUB.stones.findIndex((st) => near(st));
    if (idx >= 0) {
      w.attempt.push(idx);
      const upTo = w.attempt.length;
      const matches = w.melody.slice(0, upTo).every((n, i) => n === w.attempt[i]);
      if (!matches) {
        w.attempt = [];
        w.log.push(`the ${HUB.stones[idx].name} stone jars against the song: the seal resets`);
      } else if (upTo === w.melody.length) {
        w.doorOpen = true;
        w.attempt = [];
        w.log.push("the three notes align: the song-seal door BREAKS open");
      } else {
        w.log.push(`the ${HUB.stones[idx].name} stone rings true (${upTo}/${w.melody.length})`);
      }
      return true;
    }
  }
  return false;
}
