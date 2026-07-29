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
Merfolk are allies. Corrupted sea creatures (vampire squids, sharks) are
enemies. Story is delivered through collectible memory fragments, each playing
a lost verse. NPCs point toward fragments; fragments carry the story.

## Core systems (agreed)

### Combat: turn-based, disable-first
- Regular enemies: NO body-part rigs. Skills inflict conditions directly
  (Silt Burst blinds, Fin Slash slows). One condition chip per enemy, readable
  at a glance. Blinded enemies often miss.
- Bosses ONLY: full limb targeting. Each boss has ~4 targetable parts
  (e.g. JAW / EYE / FIN / TAIL), each with its own durability bar. Breaking
  the right part ends the current phase. Boss fights are puzzles, not HP walls.
- Turn flow: player picks an ability, targets enemy (or a boss part), resolves,
  enemy acts. Speed stats and turn order stay simple.

### Resource economy: one rule
- Every action costs stamina (STA). Stamina regenerates (per turn in combat,
  fully between fights).
- HP is the sacred resource: it does NOT regenerate freely. Heal Song exists
  but is deliberately scarce (rare uses, e.g. limited per dungeon).
- A landed disable refunds some stamina (+2 on baseline). This replaces the
  cut Resonance system: tactical play is rewarded with tempo, not a new meter.
- Baseline numbers from the sketch (tune freely, keep ratios): HP 100,
  STA 20, ability costs 1 to 4 STA, refund +2.
- NOT in the jam build: stamina-death, threshold skill tiers (100/60/20
  percent versions), desperation moves, party members, inventory, equipment.

### Abilities (~6, placeholder names)
- Tail Strike (2 STA): reliable damage, can target boss parts
- Silt Burst (3 STA): inflicts Blind for 2 turns
- Fin Slash (3 STA): damage plus Slow
- Heal Song (4 STA, scarce): restores HP, limited uses
- Analyze (1 STA): reveals enemy weaknesses / highlights the key boss part
- Bubble (2 STA): defensive, reduces incoming damage

### Exploration: hub reef + dungeons
- Structure: 1 hub reef + 2 dungeons, each dungeon ends in a boss.
- Zelda loop: hub has a locked song-seal puzzle door, a relic-gated current
  barrier, memory fragments, merfolk NPCs, and a dark trench (Glass_Goat's
  "don't swim low" danger idea).
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
