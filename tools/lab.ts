// Enemy-variety lab (slice item 9, SIM-ONLY): jam-scope enemy twists
// prototyped as wrappers around the unmodified sim, bot-tested with the
// pinned judges. NOTHING here ships: tools/ is never bundled (build entry
// is src/main.ts). Output feeds the morning report for Marc's question:
// which enemy twists (conditions on the player, immunities, buffs) are
// fair, and at what numbers?

import {
  ABILITIES,
  advanceTurn,
  createCombat,
  getCondition,
  hasCondition,
  useAbility,
  type CombatState,
} from "../src/game";
import { ABILITY_KEYS, NO_CONDITION_KEYS, casualBot, optimalBot, spamBot, type Bot } from "../test/bots";

type Hooks = {
  beforePlayerAction?: (s: CombatState, ability: string) => boolean; // false = action consumed (e.g. player-blind miss)
  afterEnemySlot?: (s: CombatState, hpBefore: number) => void;
  afterPlayerAction?: (s: CombatState, ability: string) => void;
};

function labRng(seed: number): () => number {
  let x = seed | 0;
  return () => {
    let t = (x = (x + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runVariantFight(bot: Bot, seed: number, hooks: Hooks, maxTurns = 60) {
  const s = createCombat(seed);
  const r = labRng(seed ^ 0x1ab);
  void r;
  while (s.outcome === "ongoing" && s.turn <= maxTurns) {
    const action = bot(s);
    if (action) {
      const proceed = hooks.beforePlayerAction?.(s, action.ability) ?? true;
      if (proceed) {
        useAbility(s, action.ability, action.part);
        hooks.afterPlayerAction?.(s, action.ability);
      }
    }
    if (s.outcome === "ongoing") {
      const hpBefore = s.player.hp;
      advanceTurn(s);
      hooks.afterEnemySlot?.(s, hpBefore);
    }
  }
  return { win: s.outcome === "victory", turns: s.turn, hpLost: s.player.maxHp - s.player.hp };
}

function batch(makeBot: (seed: number) => Bot, makeHooks: (seed: number) => Hooks, n = 500) {
  // Hooks are per-FIGHT: closure state (buff stacks, rng) must reset each
  // seed. A shared closure silently capped the bulwark after fight 1
  // (caught 01:55 when its numbers came back identical to baseline).
  let wins = 0;
  let turns = 0;
  let hp = 0;
  for (let seed = 0; seed < n; seed++) {
    const res = runVariantFight(makeBot(seed), seed, makeHooks(seed));
    if (res.win) wins++;
    turns += res.turns;
    hp += res.hpLost;
  }
  return { winRate: wins / n, meanTurns: turns / n, meanHpLost: hp / n };
}

// ---- Variant 1: INK SQUID (applies Blind to the PLAYER) ----
// On a landed enemy hit, 50 percent chance the player is Blinded 2 turns.
// Player-blind effect: player attacks miss 40 percent of the time (spends
// the stamina, no damage), simulated in beforePlayerAction.
function inkSquidHooks(seed: number): Hooks {
  const r = labRng(seed ^ 0x111);
  return {
    afterEnemySlot: (s, hpBefore) => {
      if (s.player.hp < hpBefore && !hasCondition(s.player, "blind") && r() < 0.5) {
        s.player.conditions.push({ kind: "blind", level: 1, turns: 2 });
        s.log.push("ink cloud: YOU are blinded");
      }
    },
    beforePlayerAction: (s, ability) => {
      const a = ABILITIES[ability];
      if (a.damage > 0 && hasCondition(s.player, "blind") && r() < 0.4) {
        if (s.player.sta >= a.staCost) {
          s.player.sta -= a.staCost;
          s.log.push(`${a.name}: you swing blind and miss`);
          return false;
        }
      }
      return true;
    },
  };
}

// ---- Variant 2: WARDED SQUID (immune to Slow) ----
// Slow never sticks (and never refunds). Blind unaffected.
function wardedHooks(): Hooks {
  return {
    afterPlayerAction: (s, ability) => {
      const a = ABILITIES[ability];
      if (a.inflicts === "slow") {
        const idx = s.enemy.conditions.findIndex((c) => c.kind === "slow");
        if (idx >= 0) {
          s.enemy.conditions.splice(idx, 1);
          // claw back the refund if this application granted one
          if (s.log.at(-1)?.includes("disable landed: slow")) {
            s.player.sta = Math.max(0, s.player.sta - 2);
          }
          s.log.push("the ward holds: slow does not stick");
        }
      }
    },
  };
}

// ---- Variant 3: BULWARK SQUID (buffs itself) ----
// Every third enemy slot it hardens: +2 attack damage, capped at +6.
function bulwarkHooks(): Hooks {
  let slots = 0;
  let stacks = 0;
  return {
    afterEnemySlot: (s) => {
      slots++;
      if (slots % 2 === 0 && stacks < 3) {
        stacks++;
        s.enemy.attackDamage += 3;
        s.log.push(`the bulwark hardens: +3 damage (stack ${stacks})`);
      }
    },
  };
}

const fmt = (s: { winRate: number; meanTurns: number; meanHpLost: number }) =>
  `win ${(s.winRate * 100).toFixed(1).padStart(5)}% turns ${s.meanTurns.toFixed(1).padStart(5)} hpLost ${s.meanHpLost.toFixed(1).padStart(5)}`;

const variants: Array<{ name: string; hooks: (seed: number) => Hooks }> = [
  { name: "baseline squid", hooks: () => ({}) },
  { name: "ink squid (blinds player)", hooks: inkSquidHooks },
  { name: "warded squid (slow immune)", hooks: wardedHooks },
  { name: "bulwark squid (self buff)", hooks: bulwarkHooks },
];

for (const v of variants) {
  console.log(`== ${v.name} ==`);
  console.log("  casual :", fmt(batch((seed) => casualBot(seed), v.hooks)));
  console.log("  optimal:", fmt(batch(() => optimalBot(), v.hooks)));
  console.log("  no-cond:", fmt(batch(() => optimalBot(NO_CONDITION_KEYS), v.hooks)));
  console.log("  blind-only:", fmt(batch(() => optimalBot(ABILITY_KEYS.filter((k) => k !== "finSlash")), v.hooks)));
  console.log("  spam-fin:", fmt(batch(() => spamBot("finSlash"), v.hooks)));
}
void getCondition;
