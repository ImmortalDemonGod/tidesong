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
  shows level). A duration of N turns means N enemy action SLOTS; a
  slot the enemy skips (slowed) still burns a turn of duration (a logged
  deviation from the earlier "actions affected" wording; burning on
  skipped slots is what makes slow self-limiting instead of freely
  chainable). The enemy acts before durations tick. G4 verifies stack-spam does not
  dominate; if it does, fix the numbers, not the cap.
- Enemies differ in WHICH disable answers them, and Analyze is how you
  learn it (ruled Jul 29, measured not guessed): squids evade (22 to 24
  percent), so BLIND is their answer because level II drops their guard
  and your strikes land (measured 37.9 damage taken vs 53.9 for slow).
  Bosses cannot dodge, so SLOW is theirs (shark 51.0 vs 83.0). A test
  pins every enemy's hint to the measured winner, so the hint can never
  drift from the numbers; it immediately caught the eel's hint claiming
  blind while slow won by 25.
- Bosses ONLY: full limb targeting. Each boss has ~4 targetable parts
  (e.g. JAW / EYE / FIN / TAIL), each with its own durability bar. Boss 1 has
  2 phases; each phase has ONE key part; breaking the key part ends the
  phase. Breaking non-key parts gives a lesser payoff (e.g. reduces boss
  damage) so they are never traps. Analyze highlights the key part. Part
  durabilities and boss damage are tunable under gate G3. Boss fights are
  puzzles, not HP walls.
- Turn flow: player picks an ability, targets enemy (or a boss part), resolves,
  enemy acts. Speed stats and turn order stay simple.
- Intent telegraph (added Jul 29 from the playtest verdict "abilities
  should make sense at key moments"): the UI shows what the enemy's next
  slot will attempt (strike damage, a slowed skip, blind miss chance, a
  held bubble, a heavy windup), read from sim state without consuming
  RNG. Conditions thereby become visible counterplay. Analyze keeps its
  exclusive information: the most effective condition, enemy dodge, and
  the boss key part are never telegraphed for free.
- Heavy cycle (added Jul 29, tactician playtest top change): every 3rd
  slot, any enemy winds up a 1.6x blow, telegraphed one turn ahead
  (NEXT: WINDS UP). Bubble's 60 percent reduction has a right moment,
  and heal timing matters. AMENDED the same day after a played question
  ("fin slash works best for almost every enemy, so why use tail
  strike"): the windup is a SCHEDULE, so a slot the enemy skips still
  brings the heavy closer. Before this, slow both prevented hits and
  pushed heavies apart, which measured slow as the correct answer on
  every enemy in the build and left blind-only performing identically
  to using no conditions at all on three of five. All bands re-measured in band after the
  change with no retune (casual rates settle ~10 points lower across
  the board; condition value RISES: no-cond 2.6x on the squid).
- Condition levels decay, not vanish (amended Jul 29, tactician "II is
  a trap"): a level II condition whose duration ends drops to level I
  for one slot instead of expiring outright, honoring Glass_Goat's
  accumulation idea in the fade as well as the stack.
- Enemy attack patterns and damage are deliberately not pinned here: choose
  them under gates G3/G4 and record the chosen behavior in the feature log.

### Resource economy: one rule
- Every action costs stamina (STA). Stamina regenerates (per turn in combat,
  fully between fights).
- HP is the sacred resource: it does NOT regenerate freely. Heal Song exists
  but is deliberately scarce (rare uses, e.g. limited per dungeon).
- The entrance current (added Jul 29, playtest rounds: both the masher
  and the tactician hit the arrive-at-boss-broken spiral from opposite
  directions): on the FIRST entry to each dungeon the checkpoint current
  mends wounds up to 65 HP alongside the charge restore. Once per
  dungeon, never on re-entry, never on respawn: HP stays sacred inside
  the ruin; the door is the one place the sea helps you stand up.
- A landed disable refunds some stamina (+2 on baseline, first application
  only; raising a condition to level II costs full price with no refund, per
  the condition-levels amendment). This replaces the cut Resonance system:
  tactical play is rewarded with tempo, not a new meter.
- Baseline numbers from the sketch (tune freely, keep ratios): HP 100,
  STA 20, ability costs 1 to 4 STA, refund +2, stamina regen 3 per combat
  turn (full between fights).
- The verse dividend (added Jul 29 from the played report "what is the
  point of the entire first scene, I can bypass it entirely"): each
  collected memory fragment permanently raises max stamina by 1. The
  hub's content is optional by design, but optional must not mean
  pointless: the fragments are the hub's whole payload, so gathering
  the song now literally gives you more song to sing. Thematic, visible
  in the HUD, and small enough that the difficulty bands (measured on
  direct combats at baseline STA) are untouched: G2 re-measured
  identical (scripted 50/50 / 12 deaths / max 194; casual 100/100 and
  5000/5000 zero fail seeds).
- Death: at 0 HP the player respawns at the checkpoint (the entrance of the
  current dungeon; hub start before any dungeon has been entered).
  COMBAT deaths climb the pity escalator: 60 percent, then 75, then capped
  at 90. HAZARD deaths (the trench) do NOT climb it and respawn with no
  more HP than the lowest you held inside the trench that excursion
  (amended twice: final panel seat 1 found fight-free trench suicide was
  a free escalating heal; confirmation seat A then refuted the first fix,
  a checkpoint-HP cap, because it was recorded only at dungeon entry and
  went stale-high. The cap now tracks HP inside the hazard itself, so no
  path leaves it stale). (Pity escalator originally
  amended after softlock data: the flat 60 percent rule
  death-looped 20 percent of casual bot runs, the same compounding
  punishment spiral this design cut from the exhaustion system). Heal Song
  uses are NOT restored, defeated encounters stay defeated, and the
  encounter that killed you resets to full. AMENDED Jul 29 (round-2
  playtests + the x5000 soak measured the no-heal boss retry at 0 to
  17.3 percent win): a lost BOSS attempt returns one Heal Song charge
  if the song is empty, and from the third pity death the current
  returns one charge after any combat death. The boss loop is
  deliberately one-more-try; a death still costs the fight, the walk,
  and the escalator's ceiling, but the RULING is now honest: at a boss
  door with an empty song, sacrifice can be the practical heal, and the
  design accepts that as the anti-frustration tradeoff (logged for the
  team's morning review).
- NOT in the jam build: stamina-death, threshold skill tiers (100/60/20
  percent versions), desperation moves, party members, inventory, equipment.

### Abilities (~6, placeholder names)
- Tail Strike (2 STA): reliable damage, can target boss parts
- Silt Burst (3 STA): inflicts Blind for 2 turns
- Fin Slash (3 STA): damage plus Slow
- Heal Song (4 STA): restores 40 HP; 2 uses per dungeon, restored on the
  FIRST entry to each dungeon only (amended per the shipped anti-exploit:
  walking out and back in does not refill; seat 2 F4)
- Analyze (1 STA): on regular enemies, reveals stats and the most effective
  condition (do NOT invent a weakness/element system); on bosses, highlights
  the key part
- Bubble (2 STA): defensive guard. AMENDED Jul 29 after measurement: as
  a plain percentage it was never worth a turn (the pinned judge chose
  it 0 percent of the time on every enemy, bubbling a telegraphed heavy
  cost 9 to 40 MORE damage than not bubbling, and at low HP it lost runs
  it was meant to save). It is now a GUARD WITH CHARGES: 80 percent
  reduction, 2 uses PER FIGHT (reset every encounter, unlike Heal Song's
  per-ruin budget), refused when spent or already braced. The two
  scopes are printed on the cards ("2/ruin" versus "2/fight") because
  showing both as "2 left" read as one rule.

### Dungeon 2 contents (amended when stretch item 8 shipped; seat 2 F2/F3)
- Elder squid: the second ruin's regular enemy, a STATS-ONLY variant of
  the vampire squid (30 HP / 14 damage, same mechanics, same hint).
  RULING, written here so the designer sees it: stats variants do NOT
  count as enemy TYPES against the one-twist-per-enemy principle or the
  3-type budget; the twist axis (conditions on the player, immunities,
  buffs) is for true types only. Type 2 (the ink squid, below) shipped
  Jul 29; type 3's twist (immunity or buff) stays jam scope.
- Boss 2, the corrupted eel: parts Maw / Lure / Coil / Tail; phases
  CONSTRICT then THRASH (13/16 damage); its one new idea, inside agreed
  systems: the phase-1 key part WANDERS per run (seeded from the world,
  never remapped by deaths) among Lure/Coil/Tail, making Analyze
  genuinely informative every run; the Maw finale is fixed.
- The relic combat echo (Tail Strike 8 to 11 with the relic) is the
  power growth that makes the second gauntlet survivable.
- Ink squid (ADDED Jul 29, playtest mandate "improve the design if it
  makes the game fun"): enemy TYPE 2, on exactly the axis the team
  reserved for it (a condition applied to the PLAYER). One twist per
  Marc's principle: a landed hit has a 40 percent chance to ink you for
  2 of your actions; your damaging strikes then miss 40 percent (stamina
  spent, damage lost) but your CONDITIONS still land, mirroring the
  dodge rule, so informed play stays reliable and mashing eats the
  punishment. 26 HP / 13 damage; introduced as the second fight of
  dungeon 2. Numbers are the overnight lab's tested recommendation;
  full G3/G4 batteries encoded in test/bands.test.ts.

### The pillar check (Jul 29): every mechanic recurs, and escalates

Marc's proposal: "every mechanic should appear throughout the game in
increasingly interesting ways." Audited in PILLAR-AUDIT.md after a
played question. Three violations found and fixed:
- THE LOW DARK is a world rule now, not a hub gimmick: a bounded trench
  that teaches it, the collapsed floor of the first ruin, and in the
  drowned gullet it has RISEN a row so the swimmable band narrows.
- THE HEAVY CYCLE escalates: a boss in phase 2 winds up every SECOND
  slot instead of every third, so a phase break changes the rhythm of
  the fight and not only its damage number. (The shark's phase-2 damage
  was swept back to 15 to hold its spam margins after the change; the
  shark's Analyze hint flipped to blind because that is now measurably
  its better answer.)
- THE SONG-SEAL recurs: the gullet has its own, and it is harder in the
  way the pillar asks for, by COMBINING with an earlier mechanic rather
  than adding a note. Four stones instead of three, and two of them sit
  inside the low dark, so answering it costs HP and the order you choose
  decides how much.
Still once-only and logged for the team: ink (enemy type 2's twist
appears in a single fight; the natural escalation is the eel using it in
phase 2) and the relic (the slice has one).

### Exploration: hub reef + dungeons
- Structure: 1 hub reef + 2 dungeons, each dungeon ends in a boss.
- Zelda loop: hub has a locked song-seal puzzle door, a relic-gated current
  barrier, memory fragments, a merfolk NPC (one in the slice), and a dark trench (Glass_Goat's
  "don't swim low" danger idea). The relic barrier is gating, not a puzzle
  type; the song-seal door is the slice's puzzle type.
- The song-seal door gates the ALCOVE above it, never the way past: it
  is a treasure vault, not a wall (clarified Jul 29 after a played
  report expected it to block the corridor and read the swim-under as a
  bug; the door label and the sealed-fragment label now say so).
- A standing objective line (added Jul 29, played report "I defeat the
  boss but I'm just stuck here"): the HUD always names the next step,
  and a cleared ruin visibly runs its current westward toward the exit.
- Relic gate: the current barrier physically shoves the player back out.
  (Originally "no tutorial text"; a G6 readability ruling added the
  on-screen label, and legibility won over purism: seat 2 F8.) Tide Relic is dungeon 1's boss reward.
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
  ships; cutting mechanics to fund depth is never allowed. AS SHIPPED:
  items 1, 2, and 4 in full; item 3 delivered scale-by-depth and idle bob
  but not angled enemies or squash/stretch (seat 2 F10). The point is to
  read closer to the team's 3D target (Glass_Goat's Wind Waker direction)
  while staying an overnight-sized canvas build.
- Controls: WASD or arrows to swim, E to interact, combat via clickable
  ability buttons plus 1 to 6 hotkeys, SPACE passes the turn (required
  when stamina cannot afford any ability), up/down (or W/S, repurposed in
  combat) aim at boss parts, P pauses, M mutes. AMENDED (G8
  round 2 F2): death auto-respawns under a transient veil instead of an
  R-gated death screen; the pity flow made a modal death screen redundant
  and the sim's respawn is what every G2 bot verifies. R replays after
  victory.
- Combat entry: touching a corrupted enemy in exploration opens the combat
  scene; winning returns to exploration with that enemy gone (per the death
  rule, defeated encounters stay defeated).
- AVOIDANCE IS A CHOICE, WITH ONE EXCEPTION (ruled Jul 29 after a played
  report asked "am I supposed to be able to bypass the other enemies and
  go straight to the shark?"). Enemies trigger on adjacency, so slipping
  past them at depth is deliberate and allowed: it trades the fight for
  the risk of meeting a boss untaught. EXCEPT the first enemy of each
  ruin, which holds its whole column and is drawn holding it (a dashed
  bar and the label "it holds the corridor"). That fight is where the
  systems are taught, so it is not skippable. Everything else is either
  optional or stands next to a verse, which is its own argument.
- FIGHTING PAYS IN THE GAME'S OWN CURRENCY, NOT IN STATS (same ruling):
  beating a corrupted creature gives it its name back, announced on a
  card and counted beside the verses ("names returned 4/6") on the song
  screen and both endings. No XP, no stat: Marc's proposal ties
  progression to relics and understanding, so the reason to fight an
  avoidable enemy is that naming is the whole theme.
- Ability availability: all 6 abilities from the first fight. Relic-based
  ability upgrades were scoped optional stretch; one shipped (the relic
  combat echo, see RECONCILIATION).
- Screens: title card (click to start; this is also the audio unlock, the
  TRUNK! lesson), pause overlay, death veil (auto-respawn per the death
  rule; see the G8 amendment under Controls), and a slice-end victory screen with placeholder team credits
  (Marc, Glass_Goat, ImmortalDemon).
- Slice end condition, AMENDED when stretch item 8 shipped: the mouth of
  dungeon 2 opens on the relic, and victory plays at the defeat of boss 2
  (the corrupted eel). The original mouth-victory applied only while
  dungeon 2 was unbuilt.
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

RECONCILIATION (final panel seat 2, F1: per-item status instead of a
blanket claim): SHIPPED AS STRETCH with logged justification: dungeon 2,
boss 2 (the corrupted eel), the song-seal puzzle door, the relic
combat echo, and (Jul 29, playtest mandate) enemy type 2, the ink squid,
from the enemy-variety lab. STILL DEFERRED: localStorage saves, flee/escape, settings
beyond pause/mute, difficulty modes, speedrun timer, touch controls,
input remapping, localization, third regular enemy type, and everything
in the enemy-variety paragraph below.

Also deferred (team discussion Jul 28, Marc's proposal, Glass_Goat's
timing), AMENDED Jul 29: enemy-applied conditions on the player SHIPPED
as the ink squid (type 2) under the playtest mandate, with the lab's
tested numbers; per-enemy immunities or resistances (from Glass_Goat's
original doc) remain deferred as type 3's twist. These are the intended
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
