// Judge bots, pinned in PROGRESS.md BEFORE tuning began. Policies may not be
// weakened after tuning starts; the adversarial panel reviews this file.
//
//   casual  = uniform random over currently affordable abilities
//             (vs bosses: uniform random unbroken part)
//   optimal = greedy with 1-ply expected-value lookahead
//   spam-X  = always ability X when affordable, else pass
//             (vs bosses: spam targets the current key part, its best case)
//
// Bots use their own PRNG stream (separate seed space from combat rolls) so
// bot choice noise never perturbs combat outcomes for a given seed.

import {
  ABILITIES,
  BASE,
  advanceTurn,
  bossDamage,
  createCombat,
  currentKeyPart,
  getCondition,
  useAbility,
  type CombatState,
  type PartKey,
} from "../src/game";

export const ABILITY_KEYS = Object.keys(ABILITIES);
export const NO_CONDITION_KEYS = ABILITY_KEYS.filter((k) => !ABILITIES[k].inflicts);

function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function affordable(state: CombatState, keys: string[] = ABILITY_KEYS): string[] {
  return keys.filter((k) => {
    const a = ABILITIES[k];
    if (state.player.sta < a.staCost) return false;
    if (a.heals !== undefined && (state.healSongUses <= 0 || state.player.hp >= state.player.maxHp)) return false;
    return true;
  });
}

export interface Action {
  ability: string;
  part?: PartKey;
}

export type Bot = (state: CombatState) => Action | null;

export function casualBot(seed: number): Bot {
  const rng = makeRng(seed ^ 0x5eed);
  return (state) => {
    const options = affordable(state);
    if (options.length === 0) return null;
    const ability = options[Math.floor(rng() * options.length)];
    let part: PartKey | undefined;
    if (state.boss) {
      const unbroken = state.boss.parts.filter((p) => !p.broken);
      if (unbroken.length > 0) part = unbroken[Math.floor(rng() * unbroken.length)].key;
    }
    return { ability, part };
  };
}

// Expected player HP loss on the NEXT enemy action slot, from a state.
function expectedNextLoss(state: CombatState): number {
  const slow = getCondition(state.enemy, "slow");
  if (slow && (state.slowSlots + 1) % 2 === 1) return 0;
  const blind = getCondition(state.enemy, "blind");
  const miss = blind ? BASE.blindMiss[blind.level] : 0;
  let dmg = bossDamage(state);
  if (slow?.level === 2) dmg = Math.round(dmg * BASE.slowDamageMult);
  if (state.bubbleCharge) dmg = Math.round(dmg * (1 - BASE.bubbleReduction));
  return (1 - miss) * dmg;
}

// Echo-aware: the judge must evaluate the damage the sim actually deals
// (correctness round 2, MED-5: a stale 8 mispredicted breaks and kills).
function effectiveDamage(state: CombatState, key: string): number {
  const a = ABILITIES[key];
  return key === "tailStrike" && state.relicEcho ? BASE.relicTailStrike : a.damage;
}

function expectedDamageDealt(state: CombatState, key: string): number {
  const a = ABILITIES[key];
  if (a.damage <= 0) return 0;
  const blind = getCondition(state.enemy, "blind");
  const dodge = blind?.level === 2 ? 0 : state.enemy.dodge;
  return effectiveDamage(state, key) * (1 - dodge);
}

// For a damaging ability vs a boss: pick the part with the best value.
// Break bonuses: key part = phase progress (large), utility = damage
// reduction over the expected remainder of the fight.
function bestBossPart(state: CombatState, abilityDamage: number): { part: PartKey; bonus: number } | null {
  if (!state.boss) return null;
  const key = currentKeyPart(state);
  let best: { part: PartKey; bonus: number } | null = null;
  for (const p of state.boss.parts) {
    if (p.broken) continue;
    const breaks = abilityDamage >= p.durability;
    let bonus = 0;
    if (p.key === key) bonus += 2;
    if (breaks) bonus += p.key === key ? 40 : state.boss.utilityBreakDamageReduction * 4;
    if (best === null || bonus > best.bonus) best = { part: p.key, bonus };
  }
  return best;
}

// Greedy 1-ply: value = expected damage dealt + expected damage prevented on
// the next enemy slot + healing value + lethal bonus. Deterministic.
// Prevention is weighted 0.8x damage: a pure-defense action can never win the
// fight, and an unweighted greedy turtles on Bubble forever once enemy damage
// exceeds its own expected damage (found during squid tuning; the fix
// strengthens the judge, the allowed direction).
// healThreshold defaults to the PINNED 40 (the heal-averse floor-measuring
// judge). The G2 runner passes 55: across a five-fight gauntlet, heal
// aversion is a measurement device turned suicide pact. Raising the
// threshold cannot shrink damage-taken floors (healing does not reduce
// damage absorbed), so G3/G4 evidence is unaffected; logged in PROGRESS.
export function optimalBot(keys: string[] = ABILITY_KEYS, healThreshold = 40): Bot {
  return (state) => {
    const options = affordable(state, keys);
    if (options.length === 0) return null;
    const baselineLoss = expectedNextLoss(state);
    let best: Action | null = null;
    let bestValue = -Infinity;
    for (const key of options) {
      const a = ABILITIES[key];
      const chosen = a.damage > 0 ? bestBossPart(state, effectiveDamage(state, key)) : null;
      const probe = structuredClone(state);
      useAbility(probe, key, chosen?.part);
      const dealt = expectedDamageDealt(state, key);
      const lethal = !state.boss && dealt >= state.enemy.hp ? 100 : 0;
      const prevented = baselineLoss - expectedNextLoss(probe);
      const healed =
        a.heals !== undefined
          ? Math.min(a.heals, state.player.maxHp - state.player.hp) *
            (state.player.hp < healThreshold ? 1.2 : 0.3)
          : 0;
      const value = dealt + prevented * 0.8 + healed + lethal + (chosen?.bonus ?? 0) - a.staCost * 0.15;
      if (value > bestValue) {
        bestValue = value;
        best = { ability: key, part: chosen?.part };
      }
    }
    return best;
  };
}

export function spamBot(key: string): Bot {
  return (state) =>
    affordable(state).includes(key)
      ? { ability: key, part: currentKeyPart(state) }
      : null;
}

export interface FightResult {
  win: boolean;
  turns: number;
  hpLost: number;
  damageTaken: number;
}

export function runFight(
  bot: Bot,
  seed: number,
  create: (seed: number) => CombatState = createCombat,
  maxTurns = 60,
): FightResult {
  const s = create(seed);
  while (s.outcome === "ongoing" && s.turn <= maxTurns) {
    const action = bot(s);
    if (action) useAbility(s, action.ability, action.part);
    if (s.outcome === "ongoing") advanceTurn(s);
  }
  return {
    win: s.outcome === "victory",
    turns: s.turn,
    hpLost: s.player.maxHp - s.player.hp,
    damageTaken: s.damageTaken,
  };
}

export interface BatchStats {
  winRate: number;
  meanTurns: number;
  meanHpLost: number;
  meanDamageTaken: number;
  n: number;
}

export function runBatch(
  makeBot: (seed: number) => Bot,
  create: (seed: number) => CombatState = createCombat,
  n = 500,
): BatchStats {
  let wins = 0;
  let turns = 0;
  let hpLost = 0;
  let dmg = 0;
  for (let seed = 0; seed < n; seed++) {
    const r = runFight(makeBot(seed), seed, create);
    if (r.win) wins += 1;
    turns += r.turns;
    hpLost += r.hpLost;
    dmg += r.damageTaken;
  }
  return { winRate: wins / n, meanTurns: turns / n, meanHpLost: hpLost / n, meanDamageTaken: dmg / n, n };
}
