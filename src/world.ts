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
  BASE,
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
  // What this verse TEACHES: the understanding half of a collectible
  // (Marc's doc: "collectibles should deepen the player's understanding
  // of the world"). Read on the song screen and by the merfolk.
  title: string;
  lesson: string;
}

export interface Encounter {
  id: number;
  area: AreaKey;
  x: number;
  y: number;
  kind: "squid" | "elder" | "ink" | "boss" | "boss2";
  defeated: boolean;
  // A corridor guard fills the passage: you cannot slip past it at any
  // depth. Exactly one per ruin, the first one, because that fight is
  // where the systems are taught (played report: "am I supposed to be
  // able to bypass the other enemies and go straight to the shark?").
  // Everything else stays skippable ON PURPOSE: dodging is a real
  // tactical choice, and the enemies worth fighting guard verses.
  blocks?: boolean;
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
  // Marc's central question, made playable: with the eel dead the sea's
  // name is loose. Sing it back and the sea can be called again, by
  // anyone. Let it go and the sea stays safe, and smaller. Undefined
  // until the player answers; the run is won either way.
  ending?: "sung" | "released";
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
      {
        id: 1,
        area: "hub",
        x: 7,
        y: 5,
        collected: false,
        title: "THE NAMING",
        verse: "(placeholder) we sang the tides their names, and the tides came when we called",
        lesson: "(placeholder) To name a thing was to hold it. The merfolk sang the sea into order, current by current.",
      },
      {
        id: 2,
        area: "hub",
        x: 14,
        y: 7,
        collected: false,
        title: "THE THINNING",
        verse: "(placeholder) when the songs thinned, the low dark learned to swallow the brave",
        lesson: "(placeholder) A thing left unsung loses its name, and what has no name the dark can take. Corruption is not a force. It is an absence with teeth.",
      },
      {
        id: 3,
        area: "dungeon1",
        x: 11,
        y: 6,
        collected: false,
        title: "THE GUARDIAN",
        verse: "(placeholder) the guardian kept his post long after the music left his mind",
        lesson: "(placeholder) The shark was set to guard the choir hall and never told to stop. He forgot the song, then the hall, then himself. He is still standing his post.",
      },
      {
        id: 4,
        area: "hub",
        x: HUB.alcove.x,
        y: HUB.alcove.y,
        collected: false,
        title: "THE KEEPERS' CHOICE",
        verse: "(placeholder) the keepers hid their brightest verse for the one who would come singing",
        lesson: "(placeholder) The songs did not fade on their own. The keepers let them go, on purpose, so the deep could not learn the sea's name from hearing it sung. They sealed one verse behind a song, betting someone would still know how to answer.",
      },
      {
        id: 5,
        area: "dungeon2",
        x: 11,
        y: 2,
        collected: false,
        title: "THE THEFT",
        verse: "(placeholder) last of all the eel drank down the name of the sea itself",
        lesson: "(placeholder) The silence came too late. The eel swallowed the sea's name whole and carried it down the gullet. Kill it and the name is loose again: yours to sing back, or to let go for good.",
      },
    ],
    encounters: [
      { id: 1, area: "dungeon1", x: 8, y: 4, kind: "squid", defeated: false, blocks: true },
      // moved off the corridor to guard the ruin's verse (playtest: a
      // duplicate corridor fight gated the shark, the build's best screen)
      { id: 2, area: "dungeon1", x: 12, y: 6, kind: "squid", defeated: false },
      { id: 3, area: "dungeon1", x: 21, y: 4, kind: "boss", defeated: false },
      { id: 4, area: "dungeon2", x: 8, y: 4, kind: "elder", defeated: false, blocks: true },
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
    // the mercy rung (Jul 29, deepsoak x5000 found seed 1932: a
    // 147-death eel treadmill; the ladder converges HP but heals stayed
    // spent forever, so the floor experience diverged under heavies).
    // From the third pity death the current returns ONE charge if the
    // song is empty: winners and 1-2-death runs never see it, and death
    // is still never a net gain over the entrance mend.
    if (w.pityDeaths >= 3 && w.healSongUses === 0) {
      w.healSongUses = 1;
      w.log.push("the current takes pity: one Heal Song returns");
      if (w.lastDeathHint && !w.lastDeathHint.includes("takes pity")) {
        w.lastDeathHint += " || the current takes pity: one Heal Song returns";
      }
    }
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
  // the song you have gathered returns to you: +1 max STA per fragment
  // (added Jul 29 from the played report that the hub is skippable and
  // pointless; the fragments are the hub's whole content, so they now
  // pay a real, visible, permanent dividend)
  const verses = w.fragments.filter((f) => f.collected).length;
  c.player.maxSta = BASE.playerSta + verses;
  c.player.sta = c.player.maxSta;
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
    if (enc.kind !== "boss" && enc.kind !== "boss2") {
      // the reason to fight anything optional: naming is the theme, and
      // a beaten corruption lets go of what it took
      w.log.push(`you give the ${c.enemy.name} its name back: the corruption lets go`);
    }
    if (enc.kind === "boss") {
      w.hasTideRelic = true;
      // the guardian's verse, paid off in his death instead of only told
      w.log.push("the shark sinks at his post, still facing the door he was set to keep");
      // the relic is a keeper's tool, not a generic key (analysis: the
      // loop's biggest reward revealed no history at all)
      w.log.push("the Tide Relic is yours: a keeper's tuning stone, the tide-song set in coral");
    }
    if (enc.kind === "boss2") {
      w.mode = "victory";
      w.log.push("the eel is spent: the name of the sea spills out of it");
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
    // a lost BOSS attempt returns one charge if the song is empty: both
    // round-2 playtests and the x5000 soak measured the retry economy as
    // a wall (casual retry wins 0/0.6/17.3 percent at 60/75/90 with no
    // heals). The boss loop is deliberately one-more-try; trash deaths
    // still wait for the pity>=3 mercy rung.
    let mercyGranted = false;
    if (c.boss && w.healSongUses === 0) {
      w.healSongUses = 1;
      mercyGranted = true;
      w.log.push("the current takes pity: one Heal Song returns");
    }
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
    if (mercyGranted) w.lastDeathHint += " || the current takes pity: one Heal Song returns";
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
    if (!e.defeated && e.area === w.area) {
      const adjacent = Math.abs(e.x - w.pos.x) + Math.abs(e.y - w.pos.y) <= 1;
      // a corridor guard holds its whole column: no depth gets past it
      const barred = e.blocks === true && e.x === w.pos.x;
      if (adjacent || barred) {
        startCombat(w, e);
        return true;
      }
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
    const restored = w.healSongUses < 2;
    w.healSongUses = 2;
    w.healRestored[area] = true;
    w.log.push(restored ? "checkpoint: dungeon entrance (Heal Song restored)" : "checkpoint: dungeon entrance");
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

// What the player should do next, in their words. Pure reader over world
// state (added Jul 29: a played report ended with "I defeat the boss but
// I'm just stuck here" in an emptied dungeon 21 tiles from its exit).
export function nextObjective(w: WorldState): string {
  if (w.mode === "victory") return "the sea remembers its song";
  const boss1 = w.encounters.find((e) => e.kind === "boss")!;
  const boss2 = w.encounters.find((e) => e.kind === "boss2")!;
  const hubVerses = w.fragments.filter((f) => !f.collected && f.area === "hub" && (w.doorOpen || f.y !== HUB.alcove.y));
  // Short enough to read at a glance in the HUD strip.
  if (w.area === "dungeon1") {
    if (!boss1.defeated) return "east: the ruin's guardian";
    return "west: carry the relic home";
  }
  if (w.area === "dungeon2") {
    if (!boss2.defeated) return "east: the eel waits";
    return "west: back to the reef";
  }
  if (!boss1.defeated) {
    if (hubVerses.length > 0) {
      const n = hubVerses.length;
      return `${n} verse${n === 1 ? "" : "s"} here, then the first ruin`;
    }
    return "east: the first ruin";
  }
  if (!w.hasTideRelic) return "east: the first ruin";
  return "east: the second ruin";
}

// Optional treasure in the area the player is standing in, named so it
// can never be silently missed (played question: "am I supposed to go
// back for the hidden verse?" -- you never have to, but nothing told you
// it was there). Returns null when this area holds nothing optional.
// The last decision in the slice. Pure, so a bot or a test can answer it
// and the UI just routes a keypress here.
export function chooseEnding(w: WorldState, choice: "sung" | "released"): boolean {
  if (w.mode !== "victory" || w.ending) return false;
  w.ending = choice;
  const verses = w.fragments.filter((f) => f.collected).length;
  if (choice === "sung") {
    w.log.push(
      verses >= 5
        ? "you sing the sea its whole name back, and every current answers at once"
        : verses >= 3
          ? "you sing the sea back the name you could carry: it answers, thinly"
          : "you sing what little you have: the sea stirs, and does not quite wake",
    );
    w.log.push("the deep heard it too");
  } else {
    w.log.push("you let the name go: it thins, drifts, and is gone from the water");
    w.log.push("the sea will not be called again, and the deep will not find it either");
  }
  return true;
}

export function optionalHere(w: WorldState): string | null {
  if (w.mode !== "explore") return null;
  const here = w.fragments.filter((f) => !f.collected && f.area === w.area);
  if (here.length === 0) return null;
  const sealed = here.find((f) => f.x === HUB.alcove.x && f.y === HUB.alcove.y && w.area === "hub");
  if (sealed) return w.doorOpen ? "the alcove stands open: a verse waits" : "a sealed verse: sing the stones";
  const inTrenchVerse = here.find((f) => inTrench(w.area, { x: f.x, y: f.y }));
  if (inTrenchVerse) return "a verse in the low dark";
  return here.length > 1 ? `${here.length} verses hidden here` : "a verse hidden here";
}

export function interact(w: WorldState): boolean {
  if (w.mode !== "explore") return false;
  const near = (p: { x: number; y: number }) =>
    Math.abs(p.x - w.pos.x) + Math.abs(p.y - w.pos.y) <= 1;
  if (w.area === "hub" && near(HUB.npc)) {
    // The guide notices your progress (all lines placeholder for Marc's
    // story; the UI strips the mark into a tag). Story delivery was
    // under-staged: one line forever (fun diagnosis, agent 3 MED).
    // The last keeper answers what you are CARRYING, not just where you
    // are (Marc: "NPC dialogue should encourage curiosity"; analysis:
    // the only survivor of a dead civilization had four signpost lines).
    // Priority: the heaviest thing you know that she has not answered.
    const has = (id: number) => w.fragments.find((f) => f.id === id)!.collected;
    const frags = w.fragments.filter((f) => f.collected).length;
    w.npcLine = has(5)
      ? "(placeholder) You carry the theft itself. When the eel is dead the name will spill out, and you will have to decide what a name is for."
      : has(4)
        ? "(placeholder) So you found what we did. We let the songs go on purpose, to keep the sea's name out of the deep's mouth. I have wondered every day since whether we were right."
        : has(3)
          ? "(placeholder) You heard the guardian. He was told to hold that door and never told to stop. Be quick with him. He has been standing there a long time."
          : has(2)
            ? "(placeholder) You found the thinning. It is not a monster loose out there, little one. It is a quiet. What loses its name gets taken."
            : w.hasTideRelic
              ? "(placeholder) A keeper's tuning stone. It knows the tide-song, so the currents will listen to you now. East, past the wall."
              : w.doorOpen
                ? "(placeholder) You gave the door its song back. I did not think anyone still knew how to answer it."
                : frags >= 1
                  ? "(placeholder) The verses gather around you. The stones by the door know their order; sing it back to them."
                  : "(placeholder) You came in singing. That is the first singing I have heard down here in a long while. Follow the verses, little one.";
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
