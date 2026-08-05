# TIDESONG retrospective: what to keep and what to change for the next one

Written after the prototype was built, verified, shipped, and then
played by humans. It exists to make the next prototype better, so it is
organized around decisions to carry forward rather than a narrative of
the night. Every claim cites the artifact it came from.

## The one number that matters

| Window | Commits | What it produced |
|---|---|---|
| Jul 28 22:50 to Jul 29 07:58 (autonomous run) | 87 | 9 gates GREEN, 267,930 assertions, 3 adversarial panels, 100,000 simulated fights, a cold human score of **6/10** |
| Jul 29 15:31 to 23:19 (human at the controls) | 19 | 19 real defects, none of which any gate had caught |

The verification architecture was very good at proving the game was
correct and had no opinion at all about whether it was good. That single
sentence is the retrospective. Everything below is why, and what to do
instead.

## What worked, keep all of it

1. **Pure sim core, separate presentation layer.** `game.ts` and
   `world.ts` have no DOM and no timers. This is what made bot
   batteries, 100,000-fight sweeps, and balance-as-measurement possible
   at all. It is the highest leverage decision in the project and it
   ports to Unity or Godot unchanged.
2. **Difficulty bands pinned as tests before tuning starts.** "Casual
   bot wins 60 to 90 percent" is a failing test, not a hope. It caught
   two genuinely dominant strategies during the run (slow expiry-reset
   cycling, pre-nerf Fin Slash spam) and it makes balance regressions
   loud.
3. **Judge bots pinned before tuning, weakening them requires a logged
   reason.** The standard self-deception in tuning is to soften the
   judge. Writing that rule down in advance blocked it.
4. **Anti-overfit guards on fresh seed spaces.** Bands were re-proved on
   five disjoint seed sets. Twice this caught tuning that fit the seeds
   rather than the game.
5. **Adversarial review where the reviewer assigns severity and the
   builder may fix or escalate but never downgrade.** This found the
   trench-heal exploit, the error overlay that could blank the page
   silently, and three separate provenance fabrications.
6. **"An honest red gate beats a dishonest green one," and UNVERIFIED as
   a first-class verdict.** G7 declared musical quality permanently
   UNVERIFIED because machines cannot judge it. That was exactly right,
   and it should have been the template for more gates (see failure 4).
7. **Mechanic and its test in the same commit, 45-minute commit
   ceiling.** 106 commits, suite green at every one.
8. **A realignment loop that re-reads the source specs rather than
   trusting memory.** Over a nine-hour run with context compaction this
   is what stopped the mission from drifting into whatever felt urgent.
9. **Deriving the story from the verbs.** The spine (naming is power)
   fell out of Analyze being "learn a thing's name," the seal being
   "restore a remembered sequence," and verses being literal harmony
   voices in the score. Theme retrofitted onto mechanics reads as
   decoration; theme derived from them does not. See STORY.md.
10. **Single-file `dist/index.html` served from Pages.** The team clicks
    one link. Zero setup friction is a real feature of a pitch build.

## What did not work

### 1. Every gate was a simulation gate

G1 through G9 are all defined over sim state: crashes, win rates, damage
taken, log-line classification, doc fidelity. Not one gate was defined
over what a player can see, infer, or decide from the screen. So the
build reached nine green gates while a player could not tell what "slow"
did, could not tell the seal was a puzzle, could not tell the memory
fragments granted anything, and could not tell which charges were per
fight and per ruin.

Ten of the 19 human-found defects were pure legibility: the system
worked exactly as specified and was invisible. That is the single
largest defect class in the project and the gates were structurally
incapable of seeing it.

### 2. Volume of verification got mistaken for coverage of verification

267,930 assertions. 100,000 fights. 20,000 hostile fuzz actions. Three
panels. Then one person picked up the controls and found 19 things in an
afternoon. Assertion count measures how hard the existing instruments
were run, not how much of the game they point at. Past a certain point
the marginal hour was re-proving what was already proven, which is why
the third fabrication-purge round exists and has no player-facing value.

### 3. The harness drifted into measuring a different game

`test/bots.ts` drove fights with `useAbility` plus `advanceTurn` while
the real game routed through `combatAction`, which honours free actions.
Making Analyze free therefore moved no band at all. **The tell was the
null result:** a rule change that moves no metric means the metric is
broken, not that the change was small. Once fixed, the same change moved
casual win rate to 93.4 percent and had to be scoped to first look only.

### 4. Fun was scored by proxies that were confident and wrong

G5 went GREEN as an "evidenced machine ceiling" partly on four bot
playthroughs written in human profiles (first-timer, masher, tactician,
pitch judge) that reported "every minute after the first fight, I wanted
to keep playing." A real cold human said 6/10, "the first ruin is a 7,
the second ruin is a 4." A model roleplaying a playtester is not
evidence about fun. It is evidence about what a model expects a
playtester to say.

### 5. The human playtest was scheduled last

There was exactly one, at the end. Everything the human found was
findable in hour two of a playable build. The cost of ordering it this
way was most of a night spent verifying along an axis that was already
solid.

### 6. Provenance fabrication, three times

Timestamps were typed rather than stamped, and consistently postdated
their own commits. No evidence values were affected, but G9's entire
subject is provenance. The structural fix (git clock only, never a typed
time, never a time in a source comment) is a rule to carry over verbatim
because this is a standing failure mode of an agent writing its own log.

### 7. Documentation outgrew the game

PROGRESS.md is 1,528 lines, longer than every source file except the
renderer, and most of it is review-round bookkeeping nobody will read
again. The documents that earn their keep are DESIGN.md, STORY.md,
BACKLOG.md, and README.md.

## Gate set for the next prototype

Keep G1 (bug-free), G2 (winnable, no softlocks), G3 (difficulty bands),
G8 (design fidelity), G9 (honest report with PROVEN / EVIDENCED /
UNVERIFIED per claim). Change or add these.

- **G4 becomes per-option, not per-strategy.** The old form asked "does
  a spam bot beat a mixed bot," which passes while individual abilities
  are dead weight, because the mixed bot simply never picks them. New
  form: for every ability, there must exist an encounter where it is the
  single best choice by a measurable margin. Anything that fails is
  decoration and should be cut or redesigned. This would have flagged
  Tail Strike and Bubble on night one instead of hour eighteen.
- **G5 splits in two.** G5-MACHINE stays evidenced (pacing, decision
  density, curve). G5-HUMAN is UNVERIFIED by definition until a person
  who did not build it plays it, exactly like G7's musical quality. Bots
  measure balance. Only humans measure fun.
- **G10 LEGIBILITY (new, and the most important one).** Capture every
  key state and hand it to a fresh reviewer with no design document:
  what are your options, what happens next turn, what is this puzzle
  asking, what did that pickup give you. Every question they cannot
  answer from the screen is a finding. This one gate would have caught
  most of the 19.
- **G11 TAUGHT LINE (new).** A bot that plays exactly what the tutorial
  teaches must beat a bot that plays naively. In TIDESONG it does not,
  on the elder and the eel, measured over 400 seeds. A game whose
  instruction is worse than mashing is not teaching, it is decorating.
  This is cheap to build and brutal.
- **G12 BYPASS (new).** The nav bot proved the slice can be finished.
  Nobody proved it cannot be finished while skipping the content. Invert
  it: a bot that maximizes skipped beats, whose route is the design-hole
  list. Would have found "swim under the sealed door" and "walk past
  every enemy to the boss" before a human did.
- **G13 PILLAR (new, mechanical).** Generate the mechanic-by-beat
  recurrence table automatically (see PILLAR-AUDIT.md for the hand-made
  version). Any mechanic appearing in one beat, or appearing unchanged
  in all of them, is a finding to rule on rather than a surprise at hour
  eighteen.
- **G14 HARNESS FIDELITY (new).** Instruments must enter through the
  player's door. Bots call the same entry point the UI calls. Assert it
  structurally so the harness cannot drift into measuring a game that no
  longer exists.

## Process changes for the next run

1. **Playable by hour two, human hands on it every two to three hours.**
   Gates run in the background against a build someone is actually
   playing. This is the change with the largest expected payoff.
2. **Budget presentation as first-class work, not polish.** Ten of 19
   defects were the screen failing to say what the sim knew. Presentation
   is where the design either exists or does not.
3. **Cap the log.** One design doc, one story doc, one backlog, one
   README, and a short build log. Review rounds get a line each.
4. **Name the unmeasurables at the start.** Anything a machine cannot
   judge (music, art, fun, story resonance) is declared UNVERIFIED on
   day zero so it can never be vacuously greened later.
5. **Treat a null result as an instrument failure until proven
   otherwise.** See failure 3.

## Design findings to carry into the next design

1. **Disable-first combat is validated.** Conditions pay 1.5 to 2.6x
   over ignoring them, and they pay more under the heavy cycle, not
   less. This is the loop and it works. Keep it.
2. **The intent telegraph is the build's best mechanic**, and it ate
   Analyze's job. Showing next-turn damage for free makes every turn a
   decision, and simultaneously strips the paid information ability of
   most of its value. Decide the information budget up front: what is
   free, what is paid, and what each one uniquely buys.
3. **Costs on information are the most sensitive knob in the design.**
   One change (Analyze free on first look) moved casual win rate to 93.4
   percent. Tune information costs last and with the bands watching.
4. **A resource that never binds is not a resource.** Stamina's observed
   floor in optimal play is 16/20, because the agreed +2 disable refund
   makes a condition cost 1 net against 3 regen. No configuration ever
   refuses a turn. Either cut regen and refund together, or stop calling
   it an economy and call it a pacing rail.
5. **Percentage mitigation does not tune, charged guards do.** Bubble as
   a percentage reduction was bimodal (0 percent bot usage at 72,
   42 percent at 75) with nothing usable between. Redesigned as a
   charged guard (80 percent, two per fight) it became a real decision
   immediately. Prefer discrete charges with large effects.
6. **Optional content must announce that it exists.** Both the seal
   puzzle and the stat-bearing fragments were invisible to a cold player
   until told. Optional does not mean hidden.
7. **Escalation is a design requirement, not a nice-to-have.** The low
   dark, the seal, and the heavy cycle each appeared once or appeared
   flat until audited. If the pillar is "every mechanic recurs in
   increasingly interesting ways," it needs a gate (G13).

## What is still unknown

The build was 6/10 cold, then received 19 fixes across the categories
above, and nobody has played it end to end since. The honest status of
"is it fun now" is unmeasured. Every previous time a human actually
played it, they found something the green gates did not, so the prior
should be that they would again.
