# Prototype 2 inputs (accumulating)

Source 1: human playtester notes, collected by the user.
Source 2: Discord feedback from Glass_Goat and Marc (pending).

Fixed decisions so far: the singing mechanic and the TIDESONG story are
**cut**. Combat and puzzles carry over in shape. Engine moves to
**Godot** (Rust an open question).

---

# Part 1: The playtester dataset

Twelve findings, grouped by what they are actually about.

## A. Framing: the player did not know why they were there

The largest cluster, and it appeared as several different symptoms.

| Finding | Note |
|---|---|
| No one understood what they were supposed to be doing, or why they were there | Reported as the recurring problem across players |
| No one understood there was a puzzle; one person solved it, and not on the first playthrough | Second prototype in a row |
| Needs clear directions on what to do | |
| Wants an opening that sets up the story and the goal, doubling as lore | The user's own read: initially sounded like polish, in hindsight it is the fix for the above |

**This is one problem, not four.** The prototype had a story bible, five
verses, a keeper who answered by progress state, and a two-ending
choice, and players still could not state their objective. Story
delivered through optional discovery cannot establish a goal, because
establishing a goal is the one thing that cannot be optional.

Worth noting what already worked: the HUD's NEXT and ALSO objective
lines were called "the single most useful thing on screen" by a blind
cold-read reviewer. So the moment-to-moment direction landed. What was
missing was the frame around it: who am I, what do I want, what is
stopping me.

## B. Combat legibility

| Finding | Class |
|---|---|
| Targeting was not clear | LEGIBILITY, recurrence |
| **Enemy attacks had no animation at all**, so it was not clear what they were doing | ANIMATION, new and severe |
| Player animations did not match the attack | ANIMATION, recurrence |

The enemy-attack finding is the most actionable single item in the set.
TIDESONG's best-rated mechanic was the intent telegraph, and the
telegraph was **a line of text**. The enemy body never performed the
thing the text announced. Players were reading combat, not watching it.

## C. Systems that were missing rather than broken

| Finding | Note |
|---|---|
| The merfolk should grant abilities, buffs, or trade something. NPCs must do more than lore | Recurrence of "the hub was pointless" |
| No movement in combat; you could not position or set up | New |
| **Three characters should participate in combat**; the prototype had one | Glass_Goat, and see the scope flag below |
| Positioning might replace arrow-key targeting: move to where you want to hit | New, and see the synthesis below |

## D. What the dataset does not say

Nobody complained about the disable-first core, the difficulty, the
condition system, the boss phase structure, or the pace of a fight. That
is meaningful negative evidence: **the part the bot batteries validated
stayed validated.** Every reported problem is framing, presentation, or
a missing system. This matches the retro exactly.

---

# Part 2: The fact that has to be pinned down first

**Which build did they play?**

Three of these findings are recurrences of defects fixed late on Jul 29:

| Finding | Fix | Commit and time |
|---|---|---|
| Puzzle not readable as a puzzle | Threads, halos, lit stones, breathing door | `0485df4`, 23:12 |
| Player animations do not match the attack | Tail pivot, seabed silt sweep, heal rings | `16c9497`, 16:32 |
| Merfolk / hub gives nothing | +1 max stamina per verse, reward on the card | `0c4598d` and `0485df4` |

If they played the 11:00 build, none of that was in it, and these are
confirmations of known defects rather than evidence the fixes failed. If
they played after 23:12, the fixes did not work and the problem is
deeper than presentation. **The two readings lead to different designs**,
so this is the first thing to establish.

---

# Part 3: The synthesis

## 3.1 Positional combat answers four complaints with one change

Targeting unclear, enemy attacks invisible, no positioning, three
characters. These are one design, not four fixes:

- **Targeting becomes spatial.** You move to the part or the enemy you
  intend to hit. The arrow-key part list disappears, and "what am I
  aiming at" is answered by where your character is standing rather than
  by a highlighted row.
- **Enemy attacks get an animation for free**, because an attack becomes
  a move-and-strike against a position. Who is being hit is visible
  before it lands, which is what the text telegraph was faking.
- **Three characters become legible** rather than an abstract party. With
  positions, a party is three things on screen in different places, and
  a support ability that protects an ally has a visible subject.
- **Glass_Goat's swap incentive gets a home.** The combat doc says
  limited healing "incentivises swapping party members." That is
  meaningless with one character.

This is the largest scope decision on the table and it needs to be made
deliberately, not absorbed.

## 3.2 It reverses an agreed scope decision, on purpose

The merge proposal parked party members explicitly:

> Post-jam. Party members: a full system of its own; the jam game is a
> solo character.

So this was not an oversight. Reopening it is a real decision, and per
the source-doc precedence rule it has to be logged as a reversal with
something coming out to pay for it. Candidates to cut in exchange:
number of dungeons, number of enemy types, the second boss, or the
environmental puzzle layer (see 3.4).

## 3.3 Cutting the song leaves a hole that Resonance already fills

The playtesters want the NPC to trade something and collectibles to do
more than lore. Marc's proposal already contains the answer, and the
merge proposal parked it:

> Resonance: successfully breaking body parts generates Resonance.
> [Parked] for the jam, successful disables refund stamina instead.

With singing cut, Resonance is the obvious replacement currency: it is
earned in combat by playing the way the design wants, it is spendable at
an NPC, and it makes the hub a shop rather than a lore stop. It also
gives the "what do I collect" question an answer that is not a verse.

## 3.4 The puzzle problem is a delivery problem, not a puzzle problem

Two prototypes, nobody found the puzzle. But the **boss fights were
puzzles and players understood those**: a limb with durability, a key
part, a phase that breaks. Nobody reported confusion about the shark.

So the instinct is fine and the vehicle is wrong. Three options:

1. **Put puzzles where attention already is**: in combat, as enemy
   structures to dismantle. Marc's enemy design philosophy already says
   each enemy revolves around one defining mechanic.
2. **Put the environmental puzzle on the critical path** so discovery is
   not required. Optional plus undiscoverable equals invisible.
3. **Teach it in the opening** and make the first one trivial.

Option 1 plus 3 is the cheapest and it protects the pillar.

## 3.5 The opening is a mechanic, not polish

The user's own reversal is correct. Budget it as a first-class item with
a gate, not as end-of-run garnish. What it must deliver in under a
minute: who you are, what you want, what stands in the way, and what the
buttons do. It can carry lore, but the lore is the passenger.

---

# Part 4: What the Godot move does to the kit

## 4.1 Dies

`verify/d1-recorder.js` and `verify/d1-layout.mjs` are canvas-specific.
They do not port.

## 4.2 Gets easier, which is the good news

**Godot's scene tree already is a display list.** The refactor LESSONS.md
argued for is native: `Control.get_global_rect()` gives every UI element
a box for free, and the tree can be walked headless. The layout
invariants (no two text boxes collide, every label stays inside its
panel with padding, exactly one node carries the selected style) become
a tree walk in a headless scene, with no proxying and no
reverse-engineering.

**Build this in week one**, before content exists, so layout can never
regress unseen. It was the single most expensive thing to retrofit last
time.

## 4.3 The new architectural risk

The pure-sim rule survives, but Godot makes it much easier to violate:
nodes tempt you to store state in the scene tree. The rule becomes
concrete: **the sim is plain `RefCounted` classes (or Rust structs) that
inherit from no `Node` and touch no scene.** If a bot cannot run the
whole game with `--headless` and no scene instantiated, the split has
already leaked.

## 4.4 The real question behind Godot versus Godot plus Rust

Not preference. Throughput.

TIDESONG's trustworthiness came from scale: 100,000 simulated fights,
20,000 fuzz actions, 2,000 fresh seeds per encounter, 50x soaks. GDScript
runs roughly an order of magnitude slower than the JS this ran on. If a
band sweep goes from seconds to many minutes, it stops being run on
every commit, and the instrument that made the last prototype honest
quietly dies.

So the deciding test is measurable, and should be measured before the
stack is chosen: **implement one encounter and run 10,000 fights. If that
is fast enough to sit inside a normal commit loop, GDScript is fine and
Marc gets the Godot learning he wants. If it is not, the sim core goes to
Rust via gdext and Godot stays pure presentation**, which maps cleanly
onto the split that already works.

---

# Part 5: Open questions for the Discord pass and the design session

1. Which build did the playtesters actually play (Part 2).
2. Three characters: does the player control all three, or one plus two
   allies? What determines turn order (Glass_Goat's Speed stat)?
3. Positioning: grid or free? Does it replace limb targeting or sit
   alongside it?
4. If party is in, what comes out of the budget to pay for it.
5. With the song cut, what is the collectible and what is the currency.
   Is Resonance in.
6. What is the new premise, now that "the sea forgot its song" is gone.
   The opening cannot be written until this is answered.
7. Does the limb system survive positional combat, given Glass_Goat's
   documented preference for "a skill that hits the eye and applies a
   blind condition" over a full limb system.
