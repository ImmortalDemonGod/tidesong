// Pure simulation core. No DOM, no canvas, no timers: everything here must be
// drivable headlessly by bot tests. Rendering reads this state, never owns it.
//
// Numbers chosen tonight (logged per PROGRESS.md rules, tunable under G3/G4):
// Blind miss: 60% at level I, 80% at level II (DESIGN says 50-75 for I; 60 picked).
// Blind II also zeroes enemy dodge ("agility drops", Glass_Goat's example).
// Slow: skip every other action; level II acting slots at 75% damage
// (retuned after correctness round 1: at 50% the perma-slow-II line dominated).
// Squid: 28 HP, 13 damage, 15% dodge (tuned under G3; journey in PROGRESS: 40/10 gave casual
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
  relicTailStrike: 11,
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
// phase-2 key part means the phase break cascades immediately. For the
// shark the total durability to victory is order-independent. For the eel
// a tail-key seed needs 34 vs 38 durability, but MEASURED fairness runs
// the other way: tail-key cohorts are ~5 points harder for casual play
// because the fast tail break means longer under phase-2 damage (see
// tools/keyfairness.ts; all cohorts in band, wander is fair).
export interface BossData {
  kind: "shark" | "eel";
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
  // Heal Song (correctness review round 1, MED-4).
  damageTaken: number;
  // The relic combat echo (DESIGN: "holding the Tide Relic upgrades one
  // existing ability"): Tail Strike hits for 11 instead of 8. This is the
  // player power growth that makes dungeon 2 survivable (without it the
  // extended slice first ran 35 scripted deaths; see PROGRESS).
  relicEcho: boolean;
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
    relicEcho: false,
    turn: 1,
    rng: seed | 0,
    outcome: "ongoing",
    log: [],
  };
}

// Boss 1: the corrupted shark. Tuned under G3 (full journey in PROGRESS.md):
// parts jaw 22 / eye 18 / fin 12 / tail 12; phase damage 12 then 15; each
// broken utility part (fin, tail) takes 3 off boss damage permanently. Boss cannot
// dodge (a huge target); enemy.hp mirrors total remaining durability so the
// HUD and the hp<=0 victory path stay uniform with regular fights.
export function createBossCombat(seed = 1): CombatState {
  const parts: BossPart[] = [
    { key: "jaw", name: "Jaw", durability: 22, maxDurability: 22, broken: false },
    { key: "eye", name: "Eye", durability: 18, maxDurability: 18, broken: false },
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
    attackDamage: 12,
    dodge: 0,
    analyzeHint: "slow",
  };
  state.boss = {
    kind: "shark",
    parts,
    phase: 1,
    phaseName: "CRUSH",
    keyPartByPhase: { 1: "jaw", 2: "eye" },
    baseDamageByPhase: { 1: 12, 2: 15 },
    utilityBreakDamageReduction: 3,
  };
  return state;
}

// Elder squid: dungeon 2's regular enemy, a stats-only variant (no new
// mechanics: enemy TYPES with new twists are deferred to jam scope by team
// decision; a tougher squid is not a new type). Tuned under the regular
// G3 bands like any encounter.
export function createElderCombat(seed = 1): CombatState {
  const state = createCombat(seed);
  state.enemy.name = "elder squid";
  state.enemy.hp = 30;
  state.enemy.maxHp = 30;
  state.enemy.attackDamage = 14;
  return state;
}

// Boss 2: the corrupted eel (dungeon 2). Its one new idea, inside agreed
// systems: the phase-1 key part WANDERS per run (seeded), so Analyze is
// genuinely informative every time. Phase 2 key is always the Maw finale.
// Placeholder part naming reuses the PartKey slots; the render layer maps
// eel names (Maw/Lure/Coil/Tail).
export function createBoss2Combat(seed = 1, keySeed = seed): CombatState {
  const parts: BossPart[] = [
    { key: "jaw", name: "Maw", durability: 22, maxDurability: 22, broken: false },
    { key: "eye", name: "Lure", durability: 16, maxDurability: 16, broken: false },
    { key: "fin", name: "Coil", durability: 16, maxDurability: 16, broken: false },
    { key: "tail", name: "Tail", durability: 12, maxDurability: 12, broken: false },
  ];
  const total = parts.reduce((sum, p) => sum + p.durability, 0);
  const state = createCombat(seed);
  // Key derives from keySeed (the WORLD seed in play), so the key wanders
  // per run, not per attempt: deaths re-roll fight RNG but never the key
  // (correctness round 2, LOW-10). imul keeps the mix integral (LOW-11).
  const wanderPool: PartKey[] = ["eye", "fin", "tail"];
  const phase1Key = wanderPool[(Math.imul(keySeed ^ 0xee1, 2654435761) >>> 0) % wanderPool.length];
  state.enemy = {
    name: "corrupted eel",
    hp: total,
    maxHp: total,
    sta: 0,
    maxSta: 0,
    conditions: [],
    attackDamage: 13,
    dodge: 0,
    analyzeHint: "blind",
  };
  state.boss = {
    kind: "eel",
    parts,
    phase: 1,
    phaseName: "CONSTRICT",
    keyPartByPhase: { 1: phase1Key, 2: "jaw" },
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
      const endedPhase = boss.phaseName;
      boss.phase = 2;
      boss.phaseName = boss.kind === "eel" ? "THRASH" : "FRENZY";
      state.log.push(`PHASE BREAK: the ${endedPhase} ends, the ${boss.phaseName} begins`);
      const nextKey = getPart(state, boss.keyPartByPhase[2]);
      if (nextKey?.broken) {
        state.outcome = "victory";
        state.enemy.hp = 0; // a spent boss shows an empty bar (seat 1 LOW-4)
        state.log.push(`the ${state.enemy.name} is spent: victory`);
      }
    } else {
      state.outcome = "victory";
      state.enemy.hp = 0; // a spent boss shows an empty bar (seat 1 LOW-4)
      state.log.push(`the ${state.enemy.name} is spent: victory`);
    }
  } else if (part.key !== boss.keyPartByPhase[1] && part.key !== boss.keyPartByPhase[2]) {
    state.log.push(`the ${state.enemy.name} weakens: damage down ${boss.utilityBreakDamageReduction}`);
  } else {
    // a pre-broken future key part: its payoff is the victory cascade at
    // the phase break, not a damage cut; say so instead of lying (G8-2 F3)
    state.log.push(`the ${part.name} hangs broken: its moment will come`);
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
  // the 0-uses case (correctness review round 1, LOW-9).
  if (ability.heals !== undefined && (state.healSongUses <= 0 || player.hp >= player.maxHp)) return false;

  player.sta -= ability.staCost;

  const abilityDamage =
    abilityKey === "tailStrike" && state.relicEcho ? BASE.relicTailStrike : ability.damage;

  if (ability.damage > 0) {
    const blind = getCondition(enemy, "blind");
    const dodge = blind?.level === 2 ? 0 : enemy.dodge;
    if (dodge > 0 && nextRand(state) < dodge) {
      state.log.push(`${ability.name}: dodged`);
    } else if (state.boss) {
      // Damage routes to a part. UNTARGETED damage drifts to a random
      // unbroken part: aiming (and Analyze's hint) must carry real decision
      // value, so the key part is never free (fidelity review round 1).
      let part = targetPart ? getPart(state, targetPart) : undefined;
      if (part?.broken) part = undefined;
      if (!part) {
        const unbroken = state.boss.parts.filter((p) => !p.broken);
        part = unbroken[Math.floor(nextRand(state) * unbroken.length)];
      }
      if (part) {
        const dealt = Math.min(abilityDamage, part.durability);
        part.durability -= dealt;
        enemy.hp = Math.max(0, enemy.hp - dealt);
        state.log.push(`${ability.name} hits the ${part.name}: ${dealt}`);
        if (part.durability <= 0 && !part.broken) breakPart(state, part);
      }
    } else {
      enemy.hp = Math.max(0, enemy.hp - abilityDamage);
      state.log.push(`${ability.name}: ${abilityDamage} dmg`);
    }
  }
  if (ability.heals !== undefined) {
    const healed = Math.min(player.maxHp - player.hp, ability.heals);
    player.hp += healed;
    state.healSongUses -= 1;
    // report what actually happened, not the nominal amount (seat 1 MED-3)
    state.log.push(`Heal Song: +${healed} HP (${state.healSongUses} left)`);
  }
  if (ability.bubble) {
    state.bubbleCharge = true;
    state.log.push("Bubble: next hit reduced");
  }
  if (ability.analyze) {
    state.analyzed = true;
    state.log.push(
      state.boss
        ? `Analyze: target the ${getPart(state, currentKeyPart(state)!)!.name} to end the ${state.boss.phaseName} phase (${bossDamage(state)} dmg per hit)`
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

// Pure reader for presentation: what the enemy's NEXT slot will attempt,
// computed without consuming RNG. Slow parity is deterministic; a blind
// miss stays a chance and is reported as one. Telegraphing intent is what
// turns conditions into visible counterplay on screen (the playtester's
// "abilities make sense during key moments"); bots read raw state and
// never use this.
export interface EnemyIntent {
  skip: boolean;
  dmg: number;
  missChance: number;
  bubbled: boolean;
}

export function enemyIntent(state: CombatState): EnemyIntent {
  const slow = getCondition(state.enemy, "slow");
  const skip = !!slow && (state.slowSlots + 1) % 2 === 1;
  const blind = getCondition(state.enemy, "blind");
  let dmg = bossDamage(state);
  if (slow?.level === 2) dmg = Math.round(dmg * BASE.slowDamageMult);
  if (state.bubbleCharge) dmg = Math.round(dmg * (1 - BASE.bubbleReduction));
  return {
    skip,
    dmg,
    missChance: blind ? BASE.blindMiss[blind.level] : 0,
    bubbled: state.bubbleCharge,
  };
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
  // review round 1, MED-5): resetting it let expire-and-reapply cycling
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
