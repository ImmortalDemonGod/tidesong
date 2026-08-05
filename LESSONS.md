# Lessons from TIDESONG, and the verification system that should have caught them

**Status: v1, for iteration.** Companion to the next design doc. RETRO.md
is the backward-looking account of the run. This document is the
forward-looking one: the defects a human had to find by hand, and a
concrete design for the machine that would have found them instead.

---

# Part 1: The finding

Nine gates went green over 87 commits, backed by 267,930 assertions,
100,000 simulated fights, 20,000 hostile fuzz actions, and three
adversarial review panels. A person then picked up the controls and
found **33 distinct defects in one afternoon**. Not one of them was
caught by any gate.

The reason is not that the gates were weak. They were unusually strong
along their axis. The reason is that **all nine of them pointed at the
simulation, and the player plays the presentation.** Correctness of
state was proved to six digits. Whether that state was visible,
legible, meaningful, or worth acting on was never measured at all.

The corollary is the design rule for the next build:

> Verification effort should be distributed across the layers the player
> actually touches, not concentrated in the layer that is easiest to
> assert about.

---

# Part 2: The defect ledger

Every defect a human found, with the detector that would have caught it.
Detector codes are defined in Part 3.

| # | What the player hit | Class | Detector |
|---|---|---|---|
| 1 | Fish faced east while swimming west | ANIMATION | D1 |
| 2 | All six abilities played one shared nudge | ANIMATION | D1 |
| 3 | HUD did not name the next step; cleared ruin had no current | LEGIBILITY | D2 |
| 4 | Hub was pointless: verses granted nothing | DESIGN-HOLE | D2, D4 |
| 5 | Song-seal did not read as the alcove vault it is | LEGIBILITY | D2 |
| 6 | Optional treasure was silently missable | DESIGN-HOLE | D4 |
| 7 | Same ending printed at 0/5 and 5/5 verses | DESIGN-HOLE | D6 |
| 8 | Verses had no readable lesson, only a stat | DESIGN-HOLE | D6 |
| 9 | Analyze said "slow is effective"; nothing said what slow means | LEGIBILITY | D1, D2 |
| 10 | Every enemy bypassable via adjacency triggers; no reason to fight | STRUCTURE | D4 |
| 11 | Ability cards never showed their damage numbers | LEGIBILITY | D1 |
| 12 | Slow won on all 5 enemies; blind-only measured identical to no conditions on 3 | BALANCE | D3 |
| 13 | Bubble at 0 percent of optimal play, actively harmful to use | BALANCE | D3 |
| 14 | Analyze at 0 percent of optimal play | BALANCE | D3 |
| 15 | Tail Strike was a body ram; Silt Burst conjured silt in open water | ANIMATION | D1, D2 |
| 16 | Ending choice unreachable by keyboard; wrong card drawn as selected | WIRING | D1, D7 |
| 17 | Low dark appeared in one beat; heavy cycle never escalated; seal appeared once | DESIGN-HOLE | D6 |
| 18 | Heal Song (per ruin) and Bubble (per fight) both printed "2 left" | LEGIBILITY | D2 |
| 19 | The gullet seal printed nothing: card gate matched "song-seal", emitter said "the gullet's seal" | WIRING | D5 |
| 20 | Ruin 2 opened with a third squid reskin | VARIETY | D6 |
| 21 | Boss Analyze dropped its condition hint | WIRING | D3, D5 |
| 22 | Verse card swallowed by an adjacent fight | LAYOUT | D1 |
| 23 | Intro banners blanked the enemy they introduced | LAYOUT | D1 |
| 24 | Analyze cost a full turn, so the taught line lost to mashing | BALANCE | D3 |
| 25 | Band harness drove a path where free actions did not exist | HARNESS | D7 |
| 26 | Boss bar counted durability that is never on the victory path | LEGIBILITY | D3 |
| 27 | Wall rebuff card mistitled THE SONG-SEAL | WIRING | D5 |
| 28 | Teach line repeated the cards instead of teaching SPACE and aiming | LEGIBILITY | D2 |
| 29 | Ticker, analyze hint, and teach line drawn into one overlapping band | LAYOUT | D1 |
| 30 | Damage floaters overlapped each other | LAYOUT | D1 |
| 31 | Story card reward line landed on the card's bottom border | LAYOUT | D1 |
| 32 | The puzzle read as scenery; no player knew it was a puzzle | LEGIBILITY | D2 |
| 33 | Fragment buffs never read as rewards | LEGIBILITY | D2 |

## Distribution

| Class | Count |
|---|---|
| LEGIBILITY (system worked, screen never said so) | 10 |
| LAYOUT (text and elements colliding or clipped) | 5 |
| DESIGN-HOLE (content with no reason to engage it) | 5 |
| BALANCE (option dominated, dead, or actively bad) | 4 |
| WIRING (two halves of one feature never met) | 4 |
| ANIMATION (motion did not match the name) | 3 |
| VARIETY, STRUCTURE, HARNESS | 3 |

**Fifteen of 33 are LEGIBILITY plus LAYOUT.** The screen, not the
simulation, is where this prototype's defects lived, by a wide margin.

---

# Part 3: The automated system that would have caught them

Seven detectors. Estimated coverage in the right-hand column is against
the 33 defects above.

| Code | Detector | Catches |
|---|---|---|
| D1 | Display list invariants | 11 |
| D2 | Cold-read questionnaire | 11 |
| D3 | Policy bots and usage histograms | 6 |
| D4 | Route search over the world graph | 4 |
| D5 | Typed events instead of string matching | 4 |
| D6 | Generated content tables | 5 |
| D7 | Differential harness fidelity | 3 |

(Rows overlap: several defects have two detectors.)

## D1. Make the renderer emit a display list, then blit it

**This is the single highest-leverage change in this document.**

`render.ts` currently draws straight to the canvas. Pixels are checkable
only by a human or a vision model, which is why 11 defects walked past
267,930 assertions. Split it in two:

```ts
// pure, testable, no canvas
type Draw =
  | { kind: "text"; id: string; text: string; box: Rect; clip: string | null }
  | { kind: "sprite"; id: string; pose: Pose; facing: -1 | 1; box: Rect }
  | { kind: "panel"; id: string; box: Rect; style: "normal" | "selected" }
  | { kind: "bar"; id: string; value: number; max: number; box: Rect };

export function buildScene(state: World, ui: Ui): Draw[]   // pure
export function blit(ctx: CanvasRenderingContext2D, scene: Draw[]): void
```

Then these stop being judgement calls and become `for` loops over
`buildScene(state, ui)`:

1. **No two text boxes in the same layer intersect.** Catches 29, 30,
   22, 23.
2. **Every draw is inside its declared clip box, with a minimum
   padding.** Catches 31.
3. **Sprite facing agrees with the sign of movement.** Catches 1.
4. **Ability distinctness: hash each ability's pose sequence across its
   cast; two identical hashes is a defect.** Catches 2, and would have
   flagged 15 as "these three casts are the same motion."
5. **Exactly one panel carries `style: "selected"`, and its id equals
   the cursor's id.** Catches 16.
6. **Every active mechanic has a `Draw` whose text contains its
   explanation string.** Drive this from a mechanics registry, not from
   hand-written tests. Catches 9, 11.

None of these require a human, a screenshot, or a model. They are
assertions over a data structure, and they run in milliseconds. The cost
is a refactor of the render layer, which in this codebase is a few hours
of work and would have paid for itself the first evening.

**Design rule for the next build: presentation is data first, pixels
second.** Exactly the way the sim is state first, canvas second. We
applied the principle to one layer and not the other, and every defect
we could not see lived in the layer we skipped.

## D2. The cold-read questionnaire

The class D1 cannot reach: the screen says something, and it is still
not understood. A player can read "slow: effective" and learn nothing. A
door and three rocks read as scenery whatever the label says.

Protocol, and the protocol is the whole trick:

1. **Questions are generated from the design doc.** Every mechanic in
   DESIGN.md yields a fixed question: what does this do, what does it
   cost, when should I use it, what did I just gain, where do I go next,
   what is this object asking of me.
2. **The reviewer never sees the design doc.** They see a screenshot of
   a state and answer from the screen only.
3. **A question the reviewer cannot answer is a finding**, with the
   builder allowed to fix or escalate but never to downgrade, matching
   the panel rule that worked.

Run it on every state after every feature round. It is cheap, it is
noisy, and it catches the largest defect class in the project: 3, 5, 9,
18, 28, 32, 33, and the reason for 4 and 15.

**This is where a model belongs and the only place a model's opinion is
worth anything.** Note the contrast with what failed: four bot
playthroughs asserting "I wanted to keep playing" were worthless,
because a model asked to feel is guessing at what a playtester says. A
model asked "can you answer this specific question from this specific
image" is doing perception, which it is good at.

## D3. Policy bots that encode intent, and usage histograms as standard output

The existing bots measured skill. They should also have measured
**design intent**.

- **Taught-line bot.** Plays exactly what the tutorial teaches. It must
  beat a naive masher. In TIDESONG it lost on the elder and the eel over
  400 seeds. A game whose instruction is worse than mashing is not
  teaching. Catches 24, and is the correct framing of 12.
- **Usage histograms on every band run.** Not a special investigation:
  standard output. Any ability at 0 percent of optimal play is a dead
  option, full stop. Bubble and Analyze both sat at 0 percent for
  eighteen hours because nobody printed the histogram. Catches 13, 14.
- **Hint-versus-winner cross-check.** For every (enemy, hint) pair,
  assert the hinted condition is the measured winner. Written after the
  fact, this test immediately caught the eel recommending blind when
  slow won by 25. Catches 21, and 12 exactly.
- **Displayed-progress monotonicity.** Any bar shown as progress must
  correlate with actual distance to the outcome. The eel's bar read
  54/66 two hits from death. Catches 26.

The general form: **for every claim the game makes to the player, a bot
that checks the claim is true.**

## D4. Route search over the world graph

The nav bot proved the slice can be finished. Nobody proved it cannot be
finished while skipping everything.

- **Maximum-skip route.** Search for the route that reaches the end
  while touching the fewest encounters and pickups. Its output is the
  design-hole list. Catches 10, and would have caught swimming under the
  sealed door.
- **Content necessity matrix.** For each piece of content, can the game
  be finished without it. The answer is often "yes, and that is fine,"
  but it must be a ruling rather than a discovery. Catches 6.
- **Reward reachability.** For every reward, does a state exist where
  the HUD names it. Optional must not mean invisible. Catches 4.

## D5. Typed events, not string matching, across module boundaries

Defect 19 is the purest bug in the project: the world emitted "the
gullet's seal" and the card gate matched `"song-seal"`, so the puzzle
that unlocks the ending verse was silent. The sim was correct. The test
suite was green. The feature did not exist.

The fix is not a test, it is a type. Cross-module communication carries
enum tags, and prose is a leaf that only presentation reads:

```ts
type Signal = { tag: "seal.progress"; sealId: "hub" | "gullet"; step: number }
```

Then the compiler catches 19 and 27, and the classifier in `events.ts`
(which today matches on substrings like `"rings true"` and
`"spills out of it"`) stops being a liability that silently returns
`null` when copy is edited. Catches 19, 21, 27, and the whole family it
belongs to.

**Rule: no feature may depend on two modules agreeing about a string.**

## D6. Generated content tables

Three defects were "we never looked at the content as a whole."

- **Mechanic-by-beat matrix**, generated from the content data: which
  beats each mechanic appears in, and whether any parameter differs
  between appearances. Anything appearing once, or appearing identically
  everywhere, is a finding to rule on. PILLAR-AUDIT.md is this table
  made by hand at hour eighteen; it found four violations. Catches 17.
- **Encounter variety table.** Enemy families per beat, flagging repeats
  in adjacent beats. Catches 20.
- **Outcome variety table.** All reachable endings and the states that
  produce them. Would have shown at a glance that 0/5 verses and 5/5
  verses printed identical text. Catches 7, and 8 by the same shape.

Cheap, generated, and reviewed once per session rather than once per
project.

## D7. Differential harness fidelity

Defect 25 is the one that should be most alarming: **the instrument
itself was measuring a different game.** The band harness drove fights
through `useAbility` plus `advanceTurn` while the real game routed
through `combatAction`, which honours free actions. Making Analyze free
therefore moved no band at all.

Three layers of defence, in order of strength:

1. **Structural.** Bots enter through the player's door. Make the inner
   functions module-private so `combatAction` is the only way in. A
   drift that cannot be expressed cannot happen.
2. **Differential.** Play one seeded script through the UI path and the
   bot path and assert identical state. Cheap, and it catches every
   future drift including ones nobody predicted.
3. **Heuristic: the null-result alarm.** Any rule change that moves no
   metric beyond noise is flagged for investigation, never accepted as
   "a small change." A null result is a claim about the instrument at
   least as much as a claim about the change.

Also catches 16, where a control existed in the sim and could not be
reached from the keyboard.

---

# Part 4: What no system catches

Be explicit about this at the start of the next build so it can never be
vacuously greened later.

- Whether the game is fun. The cold verdict was 6/10, "the first ruin is
  a 7, the second ruin is a 4." No detector above produces that
  sentence.
- Whether the pacing of a beat is right.
- Whether the music is good, whether the art reads, whether the story
  lands.
- Whether the *combination* of individually legible systems is
  enjoyable to hold.

These get named as permanently UNVERIFIED on day zero, the way G7
correctly did for musical quality, and they get scheduled as human time
rather than machine time.

---

# Part 5: Proposed working agreement for the next prototype

1. **Playable in hour two. Human hands on it every two to three hours.**
   The largest single expected gain. Every defect above was findable by
   a person on hour two of a playable build.
2. **Derive the gate list from the design doc mechanically.** Every
   claim in the design doc ("the player can see X", "X escalates", "X is
   a choice") becomes a gate. This is what prevents nine gates all
   pointing at one subsystem.
3. **Presentation is data first, pixels second** (D1). Non-negotiable
   given the distribution in Part 2.
4. **No feature may depend on two modules agreeing about a string**
   (D5).
5. **Instruments enter through the player's door** (D7).
6. **Usage histograms and the taught-line comparison ship with every
   band run** (D3), not as investigations.
7. **A null result is an instrument failure until proven otherwise.**
8. **Name the unmeasurables on day zero** (Part 4).

## Honest coverage estimate

Of the 33 defects: roughly **20 were mechanically detectable** with no
model in the loop (D1, D3, D4, D5, D6, D7), around **11 needed a model
looking at a screen** and answering spec-derived questions (D2), and the
remainder were rulings rather than bugs. The claim is not that a machine
would have made the game good. The claim is that a machine could have
handed the human a list of 20 things before they ever sat down, so the
afternoon of play could have gone to the questions only a person can
answer.

---

## Proof run

The detectors above are no longer a proposal. `verify/` contains working
implementations and `verify/PROOF.md` is the experiment: nine worktrees
checked out at the commit immediately before each fix, every detector run
against the buggy build and against HEAD.

**Seven of eight aimed detectors fired on the buggy build and went quiet
on the fixed one.** The eighth fires on both, correctly, because its
defect was logged rather than fixed. Four findings survived that nobody
had reported. Five limits were found by running the detectors that were
not visible when writing them, and they are folded into the text above:

- D1's invariants must run over PLAYED frames. The story-card defect
  exists only during a pickup, so no static demo state contains it and
  the 17-state screenshot gallery was structurally incapable of catching
  it.
- D1's containment rule was 67 percent false positives until the owning
  panel was required to be drawn within 4 ops of the text.
- D3's usage histogram cannot judge information abilities at all: a
  greedy bot has no way to value information, so Analyze reads 0 percent
  forever. That is a D2 question.
- D7 is a guard at the moment of change, not a detector of existing
  drift, so it belongs on every commit rather than in an investigation.
- D2 is scored on the DIFF between runs, not on an absolute count of
  CANNOT TELL, or it reads as permanently red.

## Open questions for this document

1. Is the display list worth the refactor cost in a jam, or is it only
   worth it once a project is expected to outlive one weekend?
2. Should the cold-read questionnaire block a gate, or only produce
   findings? It will be noisy.
3. What is the right cadence for human play: every two hours, or at
   fixed content milestones?
4. Is there a defect class in Part 2 that we are still not seeing,
   because this list is itself drawn only from what one player found in
   one afternoon?
