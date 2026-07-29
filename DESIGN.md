# TIDESONG (working title, team can rename)

Underwater Jam entry (itch.io, Jul 30 to Oct 5). Team Ratateam: Marc (design/story),
Glass_Goat (art), ImmortalDemon (code). This spec is the merged design the team
agreed on at the Jul 23 meeting. Source docs live in `docs/`:

- `docs/marc-project-proposal.pdf`: Marc's original game design doc
- `docs/glassgoat-combat-system.pdf`: Glass_Goat's combat counter-proposal
- `docs/merge-proposal.html`: the agreed merge (source of truth for scope)
- `docs/visual-sketch.html` / `.png`: greybox mockups of the three core screens

All names in this file (Tidesong, Tide Relic, Silt Burst, Heal Song) are
placeholders. All art, style, and character design are Glass_Goat's; the sketch
and any programmer art are layout skeletons only.

## Fantasy

You are a small fish exploring the ruins of a fallen merfolk civilization.
Long ago, songs kept the sea in balance; the songs faded and corruption spread.
Merfolk are allies. Corrupted sea creatures are enemies: vampire squids are a
regular enemy type, the corrupted shark is boss 1. Story is delivered through
collectible memory fragments, each playing a lost verse. NPCs point toward
fragments; fragments carry the story. Any fragment verse text written during
the build is placeholder for Marc's story and must be marked as such.

## Core systems (agreed)

### Combat: turn-based, disable-first
- Regular enemies: NO body-part rigs. Skills inflict conditions directly.
  Blind: the enemy's attacks miss with a fixed chance (choose in 50 to 75
  percent; gate G4 must show Blind pays for its cost; log the number).
  Slow: the enemy skips every other action.
- Condition rules: different kinds stack (one chip per kind, readable at a
  glance). Re-applying a condition refreshes its duration and does NOT refund
  stamina. A duration of N turns means N enemy actions are affected; the
  enemy acts before durations tick.
- Bosses ONLY: full limb targeting. Each boss has ~4 targetable parts
  (e.g. JAW / EYE / FIN / TAIL), each with its own durability bar. Boss 1 has
  2 phases; each phase has ONE key part; breaking the key part ends the
  phase. Breaking non-key parts gives a lesser payoff (e.g. reduces boss
  damage) so they are never traps. Analyze highlights the key part. Part
  durabilities and boss damage are tunable under gate G3. Boss fights are
  puzzles, not HP walls.
- Turn flow: player picks an ability, targets enemy (or a boss part), resolves,
  enemy acts. Speed stats and turn order stay simple.
- Enemy attack patterns and damage are deliberately not pinned here: choose
  them under gates G3/G4 and record the chosen behavior in the feature log.

### Resource economy: one rule
- Every action costs stamina (STA). Stamina regenerates (per turn in combat,
  fully between fights).
- HP is the sacred resource: it does NOT regenerate freely. Heal Song exists
  but is deliberately scarce (rare uses, e.g. limited per dungeon).
- A landed disable refunds some stamina (+2 on baseline). This replaces the
  cut Resonance system: tactical play is rewarded with tempo, not a new meter.
- Baseline numbers from the sketch (tune freely, keep ratios): HP 100,
  STA 20, ability costs 1 to 4 STA, refund +2, stamina regen 3 per combat
  turn (full between fights).
- Death: at 0 HP the player respawns at the dungeon-entrance checkpoint with
  60 percent of max HP. Heal Song uses are NOT restored, defeated encounters
  stay defeated, and the encounter that killed you resets to full. This is a
  deliberate trade-off (dying partially heals but costs the fight); do not
  let any cheaper death loop exist.
- NOT in the jam build: stamina-death, threshold skill tiers (100/60/20
  percent versions), desperation moves, party members, inventory, equipment.

### Abilities (~6, placeholder names)
- Tail Strike (2 STA): reliable damage, can target boss parts
- Silt Burst (3 STA): inflicts Blind for 2 turns
- Fin Slash (3 STA): damage plus Slow
- Heal Song (4 STA): restores 40 HP; 2 uses per dungeon, restored at the
  dungeon-entrance autosave
- Analyze (1 STA): on regular enemies, reveals stats and the most effective
  condition (do NOT invent a weakness/element system); on bosses, highlights
  the key part
- Bubble (2 STA): defensive, reduces incoming damage

### Exploration: hub reef + dungeons
- Structure: 1 hub reef + 2 dungeons, each dungeon ends in a boss.
- Zelda loop: hub has a locked song-seal puzzle door, a relic-gated current
  barrier, memory fragments, merfolk NPCs, and a dark trench (Glass_Goat's
  "don't swim low" danger idea). The relic barrier is gating, not a puzzle
  type; the song-seal door is the slice's puzzle type.
- Relic gate: the current barrier physically shoves the player back out
  (self-explaining, no tutorial text). Tide Relic is dungeon 1's boss reward.
  With it, the barrier parts around you and dungeon 2 opens. Implementation:
  trigger volume + one boolean; a bot test MUST assert blocked-without /
  passable-with so the gate can never ship accidentally open.
- Optional relic combat echo: holding the Tide Relic upgrades one existing
  ability (no new UI).

### Content budget (hard numbers, agreed)
| Item | Budget |
|---|---|
| Playtime | 30 to 45 min |
| World | 1 hub + 2 dungeons |
| Bosses (limb targeting) | 2 |
| Regular enemy types (conditions) | 3 |
| Relics | 1 to 2 |
| Puzzle types | 2 to 3 |
| Player abilities | ~6 |
| Collectibles | memory fragments only |
| Saving | checkpoint autosave at dungeon entrances |

## Verification requirements (non-negotiable)
- `src/game.ts` stays a pure simulation: no DOM, no canvas, no timers.
  Rendering reads state; it never owns it. This is what makes bot playtests
  and headless full-run clears possible (the TRUNK! recipe).
- Every mechanic lands with a bot test in `test/`. Full-run clear test before
  any difficulty tuning is trusted.
- Screenshot loop for visuals: headless Firefox against `dist/index.html`.
- `PROGRESS.md` is the running build log: implement, test, screenshot, commit.

## Post-jam parking lot (do not build tonight)
Inventory/equipment, party members, Resonance meter, threshold skill tiers,
stamina-death, full save system, extra relic types, extra regions.
