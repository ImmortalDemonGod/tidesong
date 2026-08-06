# Prototype 2 design spec (living)

**Status: in progress.** Built by interview. Everything in Part 1 and
Part 2 is DECIDED and should not be reopened without a logged reversal.
Part 5 is what is still open. Part 6 is what other people have to make.

Companion docs: `INPUTS.md` (the evidence this is built from),
`LESSONS.md` (why the harness looks like this), `KIT.md` (what we carry
forward), `verify/PROOF.md` (the detector experiment).

Target: the merge proposal's **vertical slice, ~Aug 13**. One fight, one
puzzle, one gate, playable start to finish. If it slips, the content
budget shrinks to match, agreed in advance.

---

# Part 1: Fixed rulings

| Decision | Ruling |
|---|---|
| The song and singing | **Cut wholesale.** Not lore, not collectible, not puzzle lock. |
| TIDESONG's story | **Cut.** Setting is Glass_Goat's post-flood diving premise. |
| Party of three | **In.** The merge proposal's "the jam game is a solo character" is formally reversed. Something must come out of the budget to pay for it. |
| Limb targeting | **Stays.** Players liked it. "Targeting was not clear" is a legibility requirement, not an argument for removal. |
| Engine | **Godot**, 2.5D side-on, not 3D. Rust still open and decided on bot throughput. |
| Art pipeline | We build placeholder assets ourselves and hand them to Glass_Goat as the brief, same as last time. |

---

# Part 2: The combat model

## 2.1 Determinism (Q1)

**No hidden roll ever sits between a decision and its outcome.** Damage,
hit, and effects are fixed integers. Enemy intent is telegraphed a full
turn ahead with its exact target and exact number.

Carve-out: **seeded generation stays random.** Which enemy appears, its
layout, and what it drops are rolled before the fight and are fully
visible when it starts. Determinism is about resolution, not about the
game being identical every run.

Why, in one line each:

- A telegraph that says "probably" is a weather forecast. TIDESONG's had
  to read `strikes for 13 · 60% miss (blinded)`, and the loudest playtest
  finding was that nobody could tell what the enemy was doing.
- It turns our weakest gate into a proof (see 4.1).
- The evidence for randomness-as-fun was machine-generated. No human ever
  said the dice were the good part.
- Percentage effects do not compose and do not tune. We paid for that
  lesson once, on Bubble.
- With three divers and small HP, one bad roll removes a party member and
  a third of your options. Worst possible place for a coin flip.

## 2.2 The Air economy (Q2)

**One shared pool. No second economy. Stamina as a separate concept is
gone.**

| Rule | Value |
|---|---|
| Air per turn | **4**, fully refreshed |
| Banking unspent Air | **No** |
| Cost to act | The acting diver's gear cost: **1 / 2 / 3** |
| Cost to move | **1**, flat, for anyone (Q3) |
| Overdraft | **Spend HP to buy one extra Air.** The desperation valve. |
| HP | Per diver. Small, sacred, hard to heal. The attrition resource. |

**The fiction is surface-supplied diving.** The squad is on umbilicals
from one compressor on the boat. That is why the pool is shared, why a
bigger suit costs more per action, and why the number is finite each
turn. Glass_Goat's whole combat doc is built on exhaustion; underwater,
exhaustion is air.

Why one pool and not two: TIDESONG's stamina never bound (floor 16 of 20
in optimal play, because a +2 refund ran against 3 regen, and no swept
configuration ever refused a turn). A shared pool of 4 against a diver
who costs 3 is scarce on **every** turn, by arithmetic, with no regen
loophole. A second economy that does not bind is worse than none,
because it is a bar on screen teaching the player their choices do not
matter.

Why no banking: it creates a turtle line (skip a turn, double the next),
which is the exact dominant-strategy class our own gate exists to catch.

**Consequence to design around:** if Air refreshes fully, fights cannot
be won by grinding down the action economy. Difficulty must come from
enemy pressure and positioning, never from wearing the player out.

## 2.3 Stations (Q3)

**The limb is the position.** There is no separate targeting step.

Five stations ring the enemy:

| Station | Exposes | Notes |
|---|---|---|
| **FRONT** | head, jaw | The dangerous one |
| **FLANK** | side limb | |
| **UNDER** | underside | |
| **REAR** | tail or rear limb | |
| **BACK LINE** | nothing | Safe. Where the scanner and support work from. |

Rules:

- Standing in a station is what makes its limbs reachable. Moving to a
  station is how you choose what you are attacking.
- **Any number of divers may share a station**, and an attack on a
  station hits **everyone standing in it**. Clustering risk emerges with
  no extra rule.
- Each station exposes one or two limbs. BACK LINE exposes none.
- **Breaking a limb changes the map.** Break the jaw and FRONT stops
  being dangerous; break the tail and REAR stops being swept. This is
  where the "every mechanic recurs and escalates" pillar comes from
  structurally, instead of being audited at hour eighteen like last time.

**Proposed, not yet decided:** slowness expressed as *reach* rather than
price. The heavy may only move to an adjacent station; Scuba may cross
the ring in one move. Keeps everyone inside the positional game and is
readable at a glance. Cut it if week one feels crowded.

Why stations over a grid: it is the only geometry where "the limb is the
position" is literally true; a grid's state space is far past exhaustive
search and would cost us the G4 proof; stations fit the 2.5D staging
Glass_Goat explicitly endorsed over top-down; and stations need one
reposition clip per character rather than pathing, tile UI and a camera
that reads tiles.

Why movement is flat 1 and not full cost: at full cost the heavy would
need 3 to move and 3 to attack against a 4 budget, so he could never do
both in a turn, ever. He becomes a turret and one third of the party is
exempt from the mechanic the whole combat is built on. Flat 1 also
produces arithmetic that teaches itself: heavy move-and-hit is 1+3, your
entire turn; Scuba move-and-hit is 1+1, half of it.

## 2.4 One enemy per fight (Q4)

**The enemy is the board.** One creature, five stations, three divers.
Bosses included. Trash is smaller anatomies with fewer limbs.

- It keeps the board readable in one second, which is the entire reason
  we chose stations.
- It preserves the searchable state space. Two rings roughly squares the
  placement space and adds enemy-selection to every decision, and we lose
  the proof in 4.1.
- It matches the art we have, which is zero enemies. One well-built
  anatomy is a far better brief for Glass_Goat than three vague ones.
- **It makes the pillar automatic.** You cannot pad a fight with more
  bodies, so the only way to make fight three harder than fight one is a
  more interesting anatomy. That is exactly the escalation we failed to
  deliver last time.

First expansion when we need it: one primary enemy that owns the stations
plus small adds that occupy stations alongside your divers and have no
limbs of their own. It invalidates nothing above.

**Fight one is a creature, not a machine.** A mutant with four limbs
reads as an anatomy immediately, which is what teaches the station-limb
contract. A machine reads as a puzzle box, which is a second idea, and it
should be earned after the first is taught. Glass_Goat's premise lists
mutants explicitly, and Marc's proposal already enumerates head, arms,
torso and tail.

## 2.5 The squad

From `Main_Team_Rigging.fbx` and the two reference images.

| Render | Name | Gear | Air cost | Oz archetype |
|---|---|---|---|---|
| Heavy plate, gold bands | **Proto5** | big armor | 3 | Tin Man |
| Bare skin, fins, red hair | **Scuba** (`Diver_Lady`) | scuba gear | 1 | Dorothy |
| Orange suit, three-lens drum | **Prototype1** | middle armor | 2 | Scarecrow |

**The cost is readable off the silhouette.** Bare skin 1, suit 2, plate
3. No number has to be printed. After two prototypes of failing to make
numbers legible, a system where the sprite *is* the number is the best
structural answer available to us.

Fiction hook the naming gives for free: the squad are field-testing
**prototype diving armors**. Prototype 1 and Prototype 5 are suits;
Scuba is a person with no suit at all.

**Six attack animations exist, two per diver**, which is the same kit
size TIDESONG shipped, now distributed so that Air composition decides
which abilities you can reach this turn.

- Scuba: `Axe_Kick`, `Double_Knee`. Legs, unarmed, agile.
- Prototype1: `Palm_Strike`, `DualPalm`. Hands, close range.
- Proto5: two attacks, unnamed and unseen.

**Standing rule: ability names come from the animation list, not the
other way around.** TIDESONG named an ability "Tail Strike" and
retrofitted motion twice, and players still said the animations did not
match. Deriving abilities from existing motion makes that defect class
impossible by construction.

---

# Part 3: Story and framing (direction, not yet decided in detail)

- **Setting:** post-flood dystopian diving expedition. Earth flooded,
  the treasures of humanity are on the seabed, mutants and scarce
  resources. Glass_Goat's premise, so it already has buy-in.
- **The goal statement:** the Oz frame gives every character exactly one
  want, and Dorothy's is the clearest goal in fiction. Here it is *get
  back to the surface*. That is an opening that needs no lore and it
  directly answers "nobody knew what they were supposed to be doing."
- **The opening is a mechanic, not polish**, and it is budgeted as one.
  Under a minute, it must deliver: who you are, what you want, what
  stands in the way, and what the buttons do.
- **Puzzle grammar:** the song puzzle failed because its entire state
  lived in the player's memory of a sequence and nothing on screen held
  it. Drawing the relationship between the objects did not fix it,
  because the relationship was never the missing part. **The
  replacement must be a lock whose whole state is readable off the
  objects**: valves, pressure doors, power routing, flooded and drained
  chambers. Also diegetic to "treasures of humanity," also the Zelda
  idiom Marc asked for, and it gives the player a reason to be a diver.
- **Analyze should be a character, not an ability.** Prototype1 carries a
  three-lens drum. The retro found Analyze at 0 percent of optimal play
  because information competed for the same slot as damage. Under Air,
  spending 2 on the scanner instead of 3 on the heavy is a composition
  choice, not a wasted turn.

---

# Part 4: Verification plan

## 4.1 The upgrade: G4 stops being a statistic

Determinism plus five stations plus a 4-Air budget makes the turn-plan
tree small and enumerable to a depth of three to five turns.

- **G4 becomes a proof.** For each ability: does there exist a reachable
  state where it is the unique optimal action? If not, it is dominated,
  proven rather than estimated. This lands on the gate that failed twice
  last time, on Bubble and on Tail Strike.
- **G11 becomes exact.** The taught line's distance from optimal is a
  number. "Following the tutorial costs you 2 HP against perfect play"
  is a sentence we could not previously write.
- **G2 becomes stronger.** Not "a casual bot finished" but "a win exists
  from every reachable state." Positioning adds a real softlock risk,
  which is a diver stranded where it can neither act usefully nor
  retreat, and only reachability analysis catches that.

**Accepted design constraint: the state space is a budget.** A mechanic
that makes the tree unsearchable costs us the proof and drops us back to
sampling. This is deliberate, and it is the opposite of last time, where
instruments chased a design that had already outrun them.

## 4.2 Three new defect classes stations create

1. **Dead station.** A place nobody profitably stands is the positional
   version of a dead ability. Detector is a direct port of the usage
   histogram: occupancy frequency per station under optimal play.
   **0 percent is blocking.**
2. **Dominant station.** The inverse and more likely. If one station is
   optimal on most turns, positioning is theatre.
3. **Broken station-limb contract.** "The limb is the position" is a
   promise the UI makes. The station-to-limb map is **one typed data
   table** that sim and presentation both read, never two agreeing
   lists. This is the bug that made the gullet seal silent.

## 4.3 What existing gates inherit, changed

- **Telegraph honesty** gains a spatial term and gets stricter.
  Determinism turns "announced matches happened" from a distribution
  check into an equality: station, limb and exact number.
- **Motion readability** moves to build time. Assert every enemy action
  has a telegraph naming a station, a bound animation clip, and a travel
  path from the enemy to that station. A missing binding is a build
  failure, not a discovery in someone's living room.
- **G10 cold read (blocking)** takes its question set from the geometry:
  which diver is about to be hit and for how much; what can the diver at
  FRONT attack; why would you move; what did the enemy just do and to
  whom. A cold reader who cannot answer from one screenshot is a finding
  that blocks.
- **Layout invariants** gain station geometry, and Godot makes them
  nearly free since `Control.get_global_rect()` hands us boxes: station
  markers never overlap, two divers sharing a station never fully
  occlude each other, the telegraph line always points at a station that
  exists on screen.
- **G14 harness fidelity**: the sim is plain `RefCounted` with no `Node`
  inheritance and no scene access. The bot calls the same entry point
  the input handler calls. Differential test on every commit. If a bot
  cannot run the whole game with `--headless` and no scene instantiated,
  the split has already leaked.

---

# Part 5: Still open

| # | Question |
|---|---|
| 5 | Fight one's anatomy: which limbs, which station map, what its one defining mechanic is |
| 6 | The six abilities: what each of the existing animations does mechanically |
| 7 | The number scale: HP and damage, given determinism (Glass_Goat wants 10 HP; the risk is that granularity collapses and six abilities all do 2) |
| 8 | Turn structure: initiative, and whether the enemy acts between player actions or after all of them |
| 9 | Currency and progression: what is collected, what an NPC trades, whether Resonance returns |
| 10 | The slice's puzzle: the specific lock, built to the readable-state rule |
| 11 | The opening: what the first sixty seconds actually say and show |
| 12 | Tech: GDScript versus Rust, decided by measuring bot throughput on one encounter; and the order in which the harness gets bootstrapped |

---

# Part 6: External dependencies

## Art asks for Glass_Goat, in priority order

1. **Enemy animations.** There are zero enemy models or clips, and the
   most severe playtest finding was that enemy attacks read as nothing.
   Needed: idle, wind-up, strike, hit reaction, death. We will build
   placeholders first and hand them over as the brief.
2. **A reposition clip per diver.** Positioning is in and no movement
   animation exists for anyone.
3. **Death animations.** None exist.
4. **Non-attack ability animations**: guard, scan, use-the-drum.
5. **A deform-only export.** The rig is Auto-Rig Pro at 136 bones per
   character, mostly FK and IK controls. Worth agreeing a bone budget
   before animation work scales.

## Budget renegotiation

Party members were on the post-jam list alongside Resonance, inventory,
and the full exhaustion vision. Reopening party means the agreed content
budget (30 to 45 minutes, 1 hub plus 2 dungeons, 2 bosses, 3 enemy
types, 1 to 2 relics, 2 to 3 puzzle types) needs re-agreement rather
than an addition.
