// Pure simulation core. No DOM, no canvas, no timers: everything here must be
// drivable headlessly by bot tests. Rendering reads this state, never owns it.
//
// Numbers chosen tonight (logged per PROGRESS.md rules, tunable under G3/G4):
// Blind miss: 60% at level I, 80% at level II (DESIGN says 50-75 for I; 60 picked).
// Blind II also zeroes enemy dodge ("agility drops", Glass_Goat's example).
// Slow: skip every other action; level II also halves damage when acting.
// Squid: 40 HP, 10 damage, 15% dodge. Bubble: next incoming hit reduced 60%.
// Dodge affects DAMAGE only; conditions always land. Rationale: Glass_Goat's
// doc asks for "consistent and predictable results"; a dodged disable is the
// least predictable outcome in the kit.

export const BASE = {
  playerHp: 100,
  playerSta: 20,
  staRegenPerTurn: 3,
  disableRefund: 2,
  healSongAmount: 40,
  healSongUses: 2,
  blindMiss: [0, 0.6, 0.8],
  slowDamageMult: 0.5,
  bubbleReduction: 0.6,
} as const;

export type ConditionKind = "blind" | "slow";
export type ConditionLevel = 1 | 2;

export interface Condition {
  kind: ConditionKind;
  level: ConditionLevel;
  turns: number;
}

export interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  sta: number;
  maxSta: number;
  conditions: Condition[];
}

export interface Ability {
  name: string;
  staCost: number;
  damage: number;
  inflicts?: ConditionKind;
  inflictTurns?: number;
  heals?: number;
  bubble?: boolean;
  analyze?: boolean;
}

export const ABILITIES: Record<string, Ability> = {
  tailStrike: { name: "Tail Strike", staCost: 2, damage: 8 },
  siltBurst: { name: "Silt Burst", staCost: 3, damage: 2, inflicts: "blind", inflictTurns: 2 },
  finSlash: { name: "Fin Slash", staCost: 3, damage: 5, inflicts: "slow", inflictTurns: 2 },
  healSong: { name: "Heal Song", staCost: 4, damage: 0, heals: BASE.healSongAmount },
  analyze: { name: "Analyze", staCost: 1, damage: 0, analyze: true },
  bubble: { name: "Bubble", staCost: 2, damage: 0, bubble: true },
};

export type Outcome = "ongoing" | "victory" | "defeat";

export interface CombatState {
  player: Combatant;
  enemy: Combatant & { attackDamage: number; dodge: number };
  healSongUses: number;
  bubbleCharge: boolean;
  analyzed: boolean;
  slowSlots: number;
  turn: number;
  rng: number;
  outcome: Outcome;
  log: string[];
}

// mulberry32 PRNG: deterministic per seed so every bot run is reproducible.
export function nextRand(state: CombatState): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createCombat(seed = 1): CombatState {
  return {
    player: {
      name: "fish",
      hp: BASE.playerHp,
      maxHp: BASE.playerHp,
      sta: BASE.playerSta,
      maxSta: BASE.playerSta,
      conditions: [],
    },
    enemy: {
      name: "vampire squid",
      hp: 40,
      maxHp: 40,
      sta: 0,
      maxSta: 0,
      conditions: [],
      attackDamage: 10,
      dodge: 0.15,
    },
    healSongUses: BASE.healSongUses,
    bubbleCharge: false,
    analyzed: false,
    slowSlots: 0,
    turn: 1,
    rng: seed | 0,
    outcome: "ongoing",
    log: [],
  };
}

export function getCondition(c: Combatant, kind: ConditionKind): Condition | undefined {
  return c.conditions.find((x) => x.kind === kind);
}

export function hasCondition(c: Combatant, kind: ConditionKind): boolean {
  return getCondition(c, kind) !== undefined;
}

// First application: level I plus stamina refund. Second: level II, full price,
// no refund (spam is a priced choice). At level II: refresh duration only.
function applyCondition(state: CombatState, kind: ConditionKind, turns: number): void {
  const existing = getCondition(state.enemy, kind);
  if (!existing) {
    state.enemy.conditions.push({ kind, level: 1, turns });
    state.player.sta = Math.min(state.player.maxSta, state.player.sta + BASE.disableRefund);
    state.log.push(`disable landed: ${kind} I (+${BASE.disableRefund} STA)`);
  } else if (existing.level === 1) {
    existing.level = 2;
    existing.turns = turns;
    state.log.push(`${kind} raised to II`);
  } else {
    existing.turns = turns;
    state.log.push(`${kind} II refreshed`);
  }
}

export function useAbility(state: CombatState, abilityKey: string): boolean {
  if (state.outcome !== "ongoing") return false;
  const ability = ABILITIES[abilityKey];
  if (!ability) throw new Error(`unknown ability: ${abilityKey}`);
  const { player, enemy } = state;
  if (player.sta < ability.staCost) return false;
  if (ability.heals !== undefined && state.healSongUses <= 0) return false;

  player.sta -= ability.staCost;

  if (ability.damage > 0) {
    const blind = getCondition(enemy, "blind");
    const dodge = blind?.level === 2 ? 0 : enemy.dodge;
    if (dodge > 0 && nextRand(state) < dodge) {
      state.log.push(`${ability.name}: dodged`);
    } else {
      enemy.hp = Math.max(0, enemy.hp - ability.damage);
      state.log.push(`${ability.name}: ${ability.damage} dmg`);
    }
  }
  if (ability.heals !== undefined) {
    player.hp = Math.min(player.maxHp, player.hp + ability.heals);
    state.healSongUses -= 1;
    state.log.push(`Heal Song: +${ability.heals} HP (${state.healSongUses} left)`);
  }
  if (ability.bubble) {
    state.bubbleCharge = true;
    state.log.push("Bubble: next hit reduced");
  }
  if (ability.analyze) {
    state.analyzed = true;
    state.log.push("Analyze: Blind is most effective");
  }
  if (ability.inflicts) {
    applyCondition(state, ability.inflicts, ability.inflictTurns ?? 1);
  }
  if (enemy.hp <= 0) {
    state.outcome = "victory";
    state.log.push("victory");
  }
  return true;
}

// One enemy action slot, then durations tick (a skipped slot still counts as
// an affected action), then stamina regen. "N turns = N enemy actions."
export function advanceTurn(state: CombatState): void {
  if (state.outcome !== "ongoing") return;
  const { player, enemy } = state;
  const slow = getCondition(enemy, "slow");

  let skipped = false;
  if (slow) {
    state.slowSlots += 1;
    skipped = state.slowSlots % 2 === 1;
  }

  if (skipped) {
    state.log.push("enemy slowed: skips its action");
  } else {
    const blind = getCondition(enemy, "blind");
    const miss = blind ? BASE.blindMiss[blind.level] : 0;
    if (miss > 0 && nextRand(state) < miss) {
      state.log.push("enemy attack missed (blind)");
    } else {
      let dmg = enemy.attackDamage;
      if (slow?.level === 2) dmg = Math.round(dmg * BASE.slowDamageMult);
      if (state.bubbleCharge) {
        dmg = Math.round(dmg * (1 - BASE.bubbleReduction));
        state.bubbleCharge = false;
        state.log.push("Bubble absorbed part of the hit");
      }
      player.hp = Math.max(0, player.hp - dmg);
      state.log.push(`enemy hits for ${dmg}`);
    }
  }

  for (const c of [player, enemy]) {
    c.conditions = c.conditions
      .map((x) => ({ ...x, turns: x.turns - 1 }))
      .filter((x) => x.turns > 0);
  }
  if (!hasCondition(enemy, "slow")) state.slowSlots = 0;

  player.sta = Math.min(player.maxSta, player.sta + BASE.staRegenPerTurn);
  state.turn += 1;
  if (player.hp <= 0) {
    state.outcome = "defeat";
    state.log.push("defeat");
  }
}
