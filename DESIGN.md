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
- Condition rules (updated Jul 28 from Glass_Goat's input: effects add up,
  restoring the accumulation idea from their original doc): each condition
  has level I and level II, capped at II. First application refunds stamina;
  raising to level II costs full price with NO refund, so spamming a strong
  effect is a priced choice, not a free one. Blind II: higher miss chance
  and the enemy's agility drops (easier to hit). Slow II: the enemy also
  deals reduced damage when it acts. Re-applying at level II refreshes
  duration only. Different kinds still coexist (one chip per kind, chip
  shows level). A duration of N turns means N enemy actions are affected;
  the enemy acts before durations tick. G4 verifies stack-spam does not
  dominate; if it does, fix the numbers, not the cap.
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
- Death: at 0 HP the player respawns at the dungeon-entrance checkpoint.
  Respawn HP escalates with deaths: 60 percent, then 75, then capped at 90
  (pity escalator, amended 00:18 Jul 29: the flat 60 percent rule
  death-looped 20 percent of casual bot runs, the same compounding
  punishment spiral this design cut from the exhaustion system). Heal Song
  uses are NOT restored, defeated encounters stay defeated, and the
  encounter that killed you resets to full. Dying always costs the fight,
  so it is never the efficient heal.
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

## Standard game shell (decided for the slice; tune freely, log changes)

The parts every game needs that no design doc remembered to write down:

- Perspective: faked 2.5D (user decision, Jul 28). Gameplay logic stays 2D
  side-view; depth is PRESENTATION ONLY, in render.ts, so the pure-sim rule
  and bots are untouched. What 2.5D means here, in priority order:
  1. Parallax depth layers in exploration (3 to 5: distant ruins, mid reef,
     play plane, foreground), moving at different rates with the camera
  2. Underwater aerial perspective: farther layers shift bluer, dimmer, and
     less saturated; light rays and drifting particles at multiple depths
  3. Scale-by-depth staging in combat: enemies larger and slightly angled,
     boss fills the frame with parts overlapping at different depths,
     subtle idle bob and squash/stretch to sell volume
  4. Camera drift/zoom moments (combat entry, phase break) that exercise
     the parallax
  Floor if time runs short: static layered parallax with depth fog still
  ships; cutting mechanics to fund depth is never allowed. The point is to
  read closer to the team's 3D target (Glass_Goat's Wind Waker direction)
  while staying an overnight-sized canvas build.
- Controls: WASD or arrows to swim, E to interact, combat via clickable
  ability buttons plus 1 to 6 hotkeys, P pauses, M mutes, R on death screen.
- Combat entry: touching a corrupted enemy in exploration opens the combat
  scene; winning returns to exploration with that enemy gone (per the death
  rule, defeated encounters stay defeated).
- Ability availability: all 6 abilities from the first fight. Relic-based
  ability upgrades stay optional stretch.
- Screens: title card (click to start; this is also the audio unlock, the
  TRUNK! lesson), pause overlay, death screen (respawn per DESIGN death
  rule), and a slice-end victory screen with placeholder team credits
  (Mhanna, Glass_Goat, ImmortalDemon).
- Slice end condition: defeat boss 1, receive the Tide Relic, part the
  current barrier; victory screen plays at the mouth of dungeon 2.
- Accessibility minimum: prefers-reduced-motion respected, pause on tab
  blur, mute toggle.
- Persistence: in-session checkpoints only tonight; progress does not
  survive a page reload (localStorage saves are jam scope, deferred).

## Explicitly deferred (jam scope, NOT tonight, NOT parking lot)

Dungeon 2 + boss 2 and the song-seal puzzle door (stretch only if the loop
reaches them), third regular enemy type, localStorage saves, flee/escape
from combat (economy decision that belongs to the team), relic combat echo,
settings beyond pause/mute, difficulty modes, speedrun timer, touch/mobile
controls, input remapping, localization.

Also deferred (team discussion Jul 28, Marc's proposal, Glass_Goat's
timing): enemy-applied conditions on the player, and per-enemy immunities
or resistances (from Glass_Goat's original doc). These are the intended
design axis for enemy types 2 and 3 in jam scope: each new enemy gets one
defining twist (applies a condition, resists one, or buffs) per Marc's
one-mechanic-per-enemy principle. Not tonight: with one regular enemy and
two conditions, immunities only delete player options, and player-side
conditions double the UI surface. When they land, balance them with the
same bot harness (G3/G4 bands) built tonight; the harness is the reusable
answer to "which mixes are fair." Tonight's run MAY prototype these as
sim-only experiments (PROGRESS.md slice item 9, the enemy-variety lab):
bot data for the team, nothing shipped in the playable build.

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
