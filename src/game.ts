// Pure simulation core. No DOM, no canvas, no timers: everything here must be
// drivable headlessly by bot tests. Rendering reads this state, never owns it.

export const BASE = {
  playerHp: 100,
  playerSta: 20,
  staRegenPerTurn: 3,
  disableRefund: 2,
} as const;

export type ConditionKind = "blind" | "slow";

export interface Condition {
  kind: ConditionKind;
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
}

export const ABILITIES: Record<string, Ability> = {
  tailStrike: { name: "Tail Strike", staCost: 2, damage: 8 },
  siltBurst: { name: "Silt Burst", staCost: 3, damage: 2, inflicts: "blind", inflictTurns: 2 },
  finSlash: { name: "Fin Slash", staCost: 3, damage: 5, inflicts: "slow", inflictTurns: 2 },
};

export interface CombatState {
  player: Combatant;
  enemy: Combatant;
  turn: number;
  log: string[];
}

export function createCombat(): CombatState {
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
      sta: 99,
      maxSta: 99,
      conditions: [],
    },
    turn: 1,
    log: [],
  };
}

export function hasCondition(c: Combatant, kind: ConditionKind): boolean {
  return c.conditions.some((x) => x.kind === kind && x.turns > 0);
}

// Player uses an ability on the enemy. Returns false if not enough stamina.
// Encodes the agreed economy: every action costs STA, and a landed disable
// (a condition the target did not already have) refunds BASE.disableRefund.
export function useAbility(state: CombatState, abilityKey: string): boolean {
  const ability = ABILITIES[abilityKey];
  if (!ability) throw new Error(`unknown ability: ${abilityKey}`);
  const { player, enemy } = state;
  if (player.sta < ability.staCost) return false;

  player.sta -= ability.staCost;
  enemy.hp = Math.max(0, enemy.hp - ability.damage);
  state.log.push(`${ability.name}: ${ability.damage} dmg`);

  if (ability.inflicts) {
    const existing = enemy.conditions.find((x) => x.kind === ability.inflicts);
    if (existing) {
      // Re-applying refreshes duration; no second refund (DESIGN.md rule).
      existing.turns = ability.inflictTurns ?? 1;
      state.log.push(`${ability.inflicts} refreshed`);
    } else {
      enemy.conditions.push({ kind: ability.inflicts, turns: ability.inflictTurns ?? 1 });
      player.sta = Math.min(player.maxSta, player.sta + BASE.disableRefund);
      state.log.push(`disable landed: ${ability.inflicts} (+${BASE.disableRefund} STA)`);
    }
  }
  return true;
}

export function endTurn(state: CombatState): void {
  for (const c of [state.player, state.enemy]) {
    c.conditions = c.conditions
      .map((x) => ({ ...x, turns: x.turns - 1 }))
      .filter((x) => x.turns > 0);
  }
  state.player.sta = Math.min(state.player.maxSta, state.player.sta + BASE.staRegenPerTurn);
  state.turn += 1;
}
