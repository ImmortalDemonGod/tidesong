// Pure simulation core. No DOM, no canvas, no timers: everything here must be
// drivable headlessly by bot tests. Rendering reads this state, never owns it.
//
// Numbers chosen tonight (logged per PROGRESS.md rules, tunable under G3/G4):
// Blind miss: 60% at level I, 80% at level II (DESIGN says 50-75 for I; 60 picked).
// Blind II also zeroes enemy dodge ("agility drops", Glass_Goat's example).
// Slow: skip every other action; level II acting slots at 75% damage
// (retuned 00:55: at 50% the perma-slow-II finSlash line dominated).
// Squid: 30 HP, 13 damage, 15% dodge (tuned 00:06 under G3: 40/10 gave casual
// 90.6% wins over 18 turns, both out of band). Bubble: next hit reduced 60%.
// Analyze hint is per-enemy data (squid: slow), set from measured bot value.
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
  slowDamageMult: 0.75,
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
  finSlash: { name: "Fin Slash", staCost: 3, damage: 3, inflicts: "slow", inflictTurns: 2 },
  healSong: { name: "Heal Song", staCost: 4, damage: 0, heals: BASE.healSongAmount },
  analyze: { name: "Analyze", staCost: 1, damage: 0, analyze: true },
  bubble: { name: "Bubble", staCost: 2, damage: 0, bubble: true },
};

export type Outcome = "ongoing" | "victory" | "defeat";

export type PartKey = "jaw" | "eye" | "fin" | "tail";

export interface BossPart {
  key: PartKey;
  name: string;
  durability: number;
  maxDurability: number;
  broken: boolean;
}

// Boss rules per DESIGN.md: 2 phases, ONE key part per phase, breaking the
// key part ends the phase (phase 2 key = victory). Non-key parts pay a
// lesser, never-trap payoff: each broken utility part permanently reduces
// boss damage. All parts are targetable in any phase; pre-breaking the
// phase-2 key part means the phase break cascades immediately (same total
// durability either way, so no degenerate shortcut).
export interface BossData {
  parts: BossPart[];
  phase: 1 | 2;
  phaseName: string;
  keyPartByPhase: Record<1 | 2, PartKey>;
  baseDamageByPhase: Record<1 | 2, number>;
  utilityBreakDamageReduction: number;
}

export interface CombatState {
  player: Combatant;
  enemy: Combatant & { attackDamage: number; dodge: number; analyzeHint: ConditionKind };
  boss?: BossData;
  healSongUses: number;
  bubbleCharge: boolean;
  analyzed: boolean;
  slowSlots: number;
  // Raw damage the player has absorbed this fight, heals excluded: the
  // G3 difficulty floors measure this, because net hpLost is zeroable by
  // Heal Song (correctness review 00:47, MED-4).
  damageTaken: number;
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
      hp: 28,
      maxHp: 28,
      sta: 0,
      maxSta: 0,
      conditions: [],
      attackDamage: 13,
      dodge: 0.15,
      analyzeHint: "slow",
    },
    healSongUses: BASE.healSongUses,
    bubbleCharge: false,
    analyzed: false,
    slowSlots: 0,
    damageTaken: 0,
    turn: 1,
    rng: seed | 0,
    outcome: "ongoing",
    log: [],
  };
}

// Boss 1: the corrupted shark. Tuned 00:12 under G3 (journey in PROGRESS.md):
// parts jaw 26 / eye 22 / fin 12 / tail 12; phase damage 14 then 17; each
// broken utility part (fin, tail) takes 3 off boss damage permanently. Boss cannot
// dodge (a huge target); enemy.hp mirrors total remaining durability so the
// HUD and the hp<=0 victory path stay uniform with regular fights.
export function createBossCombat(seed = 1): CombatState {
  const parts: BossPart[] = [
    { key: "jaw", name: "Jaw", durability: 24, maxDurability: 24, broken: false },
    { key: "eye", name: "Eye", durability: 20, maxDurability: 20, broken: false },
    { key: "fin", name: "Fin", durability: 12, maxDurability: 12, broken: false },
    { key: "tail", name: "Tail", durability: 12, maxDurability: 12, broken: false },
  ];
  const total = parts.reduce((sum, p) => sum + p.durability, 0);
  const state = createCombat(seed);
  state.enemy = {
    name: "corrupted shark",
    hp: total,
    maxHp: total,
    sta: 0,
    maxSta: 0,
    conditions: [],
    attackDamage: 13,
    dodge: 0,
    analyzeHint: "slow",
  };
  state.boss = {
    parts,
    phase: 1,
    phaseName: "CRUSH",
    keyPartByPhase: { 1: "jaw", 2: "eye" },
    baseDamageByPhase: { 1: 13, 2: 16 },
    utilityBreakDamageReduction: 3,
  };
  return state;
}

export function getPart(state: CombatState, key: PartKey): BossPart | undefined {
  return state.boss?.parts.find((p) => p.key === key);
}

export function currentKeyPart(state: CombatState): PartKey | undefined {
  return state.boss?.keyPartByPhase[state.boss.phase];
}

export function bossDamage(state: CombatState): number {
  const boss = state.boss;
  if (!boss) return state.enemy.attackDamage;
  const utilityBroken = boss.parts.filter(
    (p) => p.broken && p.key !== boss.keyPartByPhase[1] && p.key !== boss.keyPartByPhase[2],
  ).length;
  return Math.max(1, boss.baseDamageByPhase[boss.phase] - utilityBroken * boss.utilityBreakDamageReduction);
}

function breakPart(state: CombatState, part: BossPart): void {
  const boss = state.boss!;
  part.broken = true;
  state.log.push(`${part.name} BREAKS`);
  if (part.key === boss.keyPartByPhase[boss.phase]) {
    if (boss.phase === 1) {
      boss.phase = 2;
      boss.phaseName = "FRENZY";
      state.log.push("PHASE BREAK: the Crush ends, the Frenzy begins");
      const nextKey = getPart(state, boss.keyPartByPhase[2]);
      if (nextKey?.broken) {
        state.outcome = "victory";
        state.log.push("the corrupted shark is spent: victory");
      }
    } else {
      state.outcome = "victory";
      state.log.push("the corrupted shark is spent: victory");
    }
  } else {
    state.log.push(`the shark weakens: damage down ${boss.utilityBreakDamageReduction}`);
  }
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

export function useAbility(state: CombatState, abilityKey: string, targetPart?: PartKey): boolean {
  if (state.outcome !== "ongoing") return false;
  const ability = ABILITIES[abilityKey];
  if (!ability) throw new Error(`unknown ability: ${abilityKey}`);
  const { player, enemy } = state;
  if (player.sta < ability.staCost) return false;
  // Full-HP healing would burn a scarce charge for nothing: refuse like
  // the 0-uses case (correctness review 00:47, LOW-9).
  if (ability.heals !== undefined && (state.healSongUses <= 0 || player.hp >= player.maxHp)) return false;

  player.sta -= ability.staCost;

  if (ability.damage > 0) {
    const blind = getCondition(enemy, "blind");
    const dodge = blind?.level === 2 ? 0 : enemy.dodge;
    if (dodge > 0 && nextRand(state) < dodge) {
      state.log.push(`${ability.name}: dodged`);
    } else if (state.boss) {
      // Damage routes to a part. UNTARGETED damage drifts to a random
      // unbroken part: aiming (and Analyze's hint) must carry real decision
      // value, so the key part is never free (fidelity review 00:24).
      let part = targetPart ? getPart(state, targetPart) : undefined;
      if (part?.broken) part = undefined;
      if (!part) {
        const unbroken = state.boss.parts.filter((p) => !p.broken);
        part = unbroken[Math.floor(nextRand(state) * unbroken.length)];
      }
      if (part) {
        const dealt = Math.min(ability.damage, part.durability);
        part.durability -= dealt;
        enemy.hp = Math.max(0, enemy.hp - dealt);
        state.log.push(`${ability.name} hits the ${part.name}: ${dealt}`);
        if (part.durability <= 0 && !part.broken) breakPart(state, part);
      }
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
    state.log.push(
      state.boss
        ? `Analyze: target the ${currentKeyPart(state)} to end the ${state.boss.phaseName} phase (${bossDamage(state)} dmg per hit)`
        : `Analyze: ${state.enemy.analyzeHint} is most effective (${state.enemy.attackDamage} dmg, dodges ${Math.round(state.enemy.dodge * 100)}%)`,
    );
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
      let dmg = bossDamage(state);
      if (slow?.level === 2) dmg = Math.round(dmg * BASE.slowDamageMult);
      if (state.bubbleCharge) {
        dmg = Math.round(dmg * (1 - BASE.bubbleReduction));
        state.bubbleCharge = false;
        state.log.push("Bubble absorbed part of the hit");
      }
      player.hp = Math.max(0, player.hp - dmg);
      state.damageTaken += dmg;
      state.log.push(`enemy hits for ${dmg}`);
    }
  }

  for (const c of [player, enemy]) {
    c.conditions = c.conditions
      .map((x) => ({ ...x, turns: x.turns - 1 }))
      .filter((x) => x.turns > 0);
  }
  // Slow parity carries across expiry and re-application (correctness
  // review 00:47, MED-5): resetting it let expire-and-reapply cycling
  // produce 2 skips per 3 slots, an 85 percent damage-reduction line no
  // pinned judge could play. Carrying parity keeps the DESIGN promise:
  // slowed slots alternate skip/act, every other, always.

  player.sta = Math.min(player.maxSta, player.sta + BASE.staRegenPerTurn);
  state.turn += 1;
  if (player.hp <= 0) {
    state.outcome = "defeat";
    state.log.push("defeat");
  }
}
