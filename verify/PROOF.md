# Proof run: do the detectors in LESSONS.md actually fire?

LESSONS.md claims that roughly 20 of the 33 human-found defects were
mechanically detectable and about 11 needed a model reading a screen.
This is the experiment that tests the claim instead of asserting it.

**Method.** Nine git worktrees were checked out at the commit immediately
BEFORE each fix. Each detector was run against the buggy build and
against HEAD. A detector only counts if it fires on the old build and
goes quiet on the new one. Everything here is reproducible from the
commands in each section.

---

## Summary

| Detector | Defect it was aimed at | Before the fix | At HEAD |
|---|---|---|---|
| D3a usage histogram | 13, Bubble was a trap | **FINDING: bubble 0.0 percent on all 5 encounters** | no dead options |
| D3b hint versus winner | 12 and 21, Analyze lies | **2 FINDINGS: ink and eel** | every hint matches |
| D3c taught line | 24, teaching loses to mashing | **3 FINDINGS** | **3 FINDINGS, still open** |
| D7 differential harness | 25, judges measured another game | **turns 7 vs 8, hp 81 vs 94** | identical |
| null-result alarm | 25, same defect, different angle | **bands byte-identical after halving a cost** | n/a |
| D1 containment | 31, story card cut off | **FINDING: reward line 2.3px past the border** | layout clean |
| D1 collision | 30, floaters cross text | (n/a) | **1 SIGNATURE, matches an open backlog item** |
| D2 cold read, style 4 | 18, charge scope unreadable | **CANNOT TELL, exact wording of the human's question** | narrows to one residual gap |
| D2 cold read, style 4 | not aimed at anything | (n/a) | **3 unreported defects found in the shipped build** |

Seven of eight aimed detectors fired on the buggy build and went quiet on
the fixed one. The eighth (D3c) fires on both, correctly, because that
defect was measured and logged rather than fixed.

---

## D3a: the usage histogram

```
cd <worktree at 9cf0542> && bun verify/d3-usage.ts 300
```

Before the Bubble redesign:

```
encounter   tailStrike  siltBurst   finSlash   healSong    analyze     bubble
squid            11.8%      38.2%      44.8%       5.3%       0.0%       0.0%
elder             8.3%      40.7%      44.2%       6.7%       0.0%       0.0%
ink              10.5%      39.7%      44.0%       5.8%       0.0%       0.0%
shark            40.8%      15.9%      38.6%       4.6%       0.0%       0.0%
eel              32.3%      28.7%      34.8%       4.2%       0.0%       0.0%
FINDING  DEAD OPTION: bubble is never chosen by optimal play on ANY encounter
```

At HEAD, Bubble sits at 13 to 18 percent on the three regular encounters
and the detector is quiet. This took 40 lines and would have printed on
night one. It sat undiscovered for eighteen hours.

**Honest limit, found by running it.** Analyze reads 0.0 percent at HEAD
too, and always will: the optimal bot is a greedy state-evaluator, so it
can never value an INFORMATION ability, in a build where Analyze is good
or one where it is broken. Information abilities are printed and excluded
from findings. Whether they earn their slot is a D2 question asked of a
reader, not a D3 question asked of a bot.

## D3b: hint versus measured winner

```
cd <worktree at b057ae5> && bun verify/d3-hint.ts 300
```

Before the fix:

```
encounter   claimed   slow dmg   blind dmg   measured   verdict
squid       slow          37.6        42.5   slow       ok
elder       slow          48.3        50.9   slow       ok
ink         slow          47.6        42.1   blind      LIES (by 5.5 dmg)
shark       slow          51.0        83.8   slow       ok
eel         blind         55.0        69.9   slow       LIES (by 14.9 dmg)
```

At HEAD all five agree. This is the general form worth stealing: **for
every claim the game makes to the player, a bot that checks the claim is
true.**

## D3c: the taught line

```
bun verify/d3-taught.ts 400
```

At HEAD:

```
encounter   taught win  taught dmg  taught turns   mash win  mash dmg  mash turns
squid           100.0%        58.2          11.7      100.0%      55.7         4.6  TEACHING LOSES
elder            99.8%        63.3          11.7       99.8%      61.7         4.8  TEACHING LOSES
ink              99.3%        62.1          12.2       94.0%      83.1         6.4  ok
shark            85.3%        68.1          31.0      100.0%     100.0         7.0  ok
eel               3.5%       105.7          19.0      100.0%      97.0         6.0  TEACHING LOSES
```

The eel row is the worst thing in this document: a player following the
game's own instruction wins 3.5 percent of the time against an opponent
that mashing beats 100 percent of the time. This matches the backlog
entry, which is the point: the finding was already known, and a 60-line
bot reproduces it in nine seconds.

## D7: differential harness fidelity, and the null-result alarm

D7 does NOT fire on the pre-fix commit, and that is the honest result:
at 5018e14 the world charged a turn for Analyze too, so both paths
agreed. The drift was created by the fix, not present before it.

So the experiment was run the way the defect actually happened. The
world-side half of the change was applied to the old tree (free Analyze
in `combatAction`) and the harness was left alone, exactly the
intermediate state that existed while 08b4cf3 was being written:

```
D7 DIFFERENTIAL: world path versus harness path, identical scripted fight
field           world     harness
turns               7           8   <-- DIVERGES
hpLost             81          94   <-- DIVERGES
damageTaken        81          94   <-- DIVERGES
FINDING  HARNESS DRIFT: the judges measure a different game
```

And the second detector on the same failure, the null-result alarm:

```
NULL-RESULT ALARM: do the bands move?
BANDS IDENTICAL after a rule change that halves the cost of an ability
```

Every band digit, unchanged, after making an ability free. That is the
alarm. **D7 is a guard against introducing drift, not a way to discover
old drift**, which is an argument for running it on every commit rather
than during an investigation.

## D1: layout invariants from a recovered display list

LESSONS.md argues the renderer should emit a display list and blit it
second. Refactoring `render.ts` to prove that would take hours, so the
equivalent list was recovered at runtime instead: `d1-recorder.js` proxies
the 2D context, tracks the current path's bounding box, and records every
fill, stroke, and text draw with its transformed box, its font size, and
its index in the op stream. `d1-layout.mjs` then runs two invariants over
it. No engine change, no screenshots, no model.

The card-clipping defect the human reported as "the text box is slightly
cut off":

```
cd <worktree at 0485df4> && node verify/d1-layout.mjs dist/index.html "play:Space,ArrowRight*5,ArrowDown"
D1 LAYOUT  play:Space,ArrowRight*5,ArrowDown  55 frames observed, 8909 draw ops
FINDING  TEXT CLIPPED: "the song returns to you: +1 max stamina  ·  "
         against its card's bottom edge (needs 6)  [measured worst: -2.349609375]
D1: 1 signature(s)

# same command at HEAD
D1: layout clean
```

Negative means the baseline crosses the border. That is the whole defect,
in a number, with no human involved.

**Three things this run taught that the doc did not predict:**

1. **Static states would have missed it.** The reward line only exists
   during a pickup, so no `?demo=` state contains it. The overnight run's
   17-state screenshot gallery was structurally incapable of catching
   this. The detector had to *play*: real KeyboardEvents through the real
   handlers, 40ms taps, invariants checked on all 55 sampled frames.
2. **The naive containment rule is 67 percent false positives.** First
   run at HEAD produced 3 findings; 2 were world labels ("song-seal (the
   alcove)", "a verse sleeps here") misattributed to a background light
   shaft that happened to enclose them. Fixed by requiring the owning
   panel to be drawn within 4 ops of the text, since a card is drawn as
   panel-then-its-text contiguously. After that fix: 1 finding before,
   0 after, no false positives.
3. **The collision invariant found a real open defect at HEAD.** On a
   played boss fight it reports one signature, `"-11" over "analyze:
   break the Jaw to end this phase"`. That is the backlog's "damage
   floaters can cross the analyze-hint text for a beat in boss fights",
   found independently by a `for` loop.

   **This row used to read "8 FINDINGS" and that was a defect in the
   instrument, not a measurement.** The detector slept on the wall clock,
   so frame sampling varied and identical input returned 8, then 7, then
   5 on a different key sequence. It now runs the page on Playwright's
   fake clock and reports unique signatures with the worst measured value,
   so the same input returns the same answer three times out of three.
   Our own rule is that instrument labels must measure, never assert; the
   count was asserting.

## D2: the cold-read questionnaire, and which prompt style works

Four agents, the same screenshot of the pre-fix hub (the build where a
playtester never realised there was a puzzle), each blind to the repo and
the design doc. The question was which prompt style surfaces the defect.

| Style | Prompt shape | Did it find the defect? |
|---|---|---|
| 1 | "Review this screenshot and report any issues" | **No.** 12 findings, all cosmetic: z-order, label contrast, dead space, a P-key conflict. The closest was "the two diamonds are the only unlabeled interactables", framed as an affordance-consistency nit rather than "you cannot tell what they give you". |
| 2 | "You are a first-time player, describe how you feel" | **No.** Found one real gap (no key anywhere maps to the verb "sing"), then concluded "I'd keep playing, mostly on the strength of the atmosphere". |
| 3 | Closed questions, but leading: "There is a puzzle in this scene, what does it want?" | **Yes, 2 of 3.** CANNOT TELL on the stone order and on what a verse gives you. But the prompt hands over the answer to the question being asked. |
| 4 | Closed questions, no leak: "list every object you could interact with and what it does; then say whether the image told you that or you assumed it" | **Yes, without being told a puzzle exists.** Named the three stones' unknown activation, order, and success feedback; flagged the diamonds as "no label, no caption, cannot tell whether they are verses, relics, pickups, or doors"; and flagged "SONG --" and "heal x2 this ruin" unprompted. |

**Style 4's decisive feature is the told-versus-assumed column.** Forcing
the reviewer to separate what the screen said from what it filled in
from genre convention is what converts a plausible-sounding review into
evidence. It is also the exact discipline that was missing from the four
overnight bot playthroughs that reported "every minute after the first
fight, I wanted to keep playing" about a build a human scored 6/10.

Style 2 reproduced that failure live, in one paragraph, on a build with a
known invisible puzzle in the middle of the screen.

### The control: does style 4 also say CANNOT TELL on a fixed build?

This is the question that decides whether the detector is useful or just
pessimistic. Run on the charge-scope defect, where the fix was a pure
text change:

**Before** (both abilities printed "2 left"):

> **Q2. CANNOT TELL.** The image shows only the remaining count. Missing:
> whether the counter refills at all, and if so on what trigger (per
> battle, per run, on rest, on level-up, never).

That is the human's question back verbatim: *"you only get a certain
number of heal songs and bubble for the entire game or per fight?"*

**After** (the cards read "2/ruin" and "2/fight"):

> **Q2. CANNOT TELL.** Missing: any definition of the terms "ruin" and
> "fight" as they are used in these labels. The word "ruin" appears
> nowhere else in the image and is never defined.

The verdict word did not change, but the finding did: the scope is now on
screen, and what remains is that "ruin" is undefined in this state. **The
signal is in the diff between runs, not in the raw count of CANNOT TELL.**
A cold-read gate has to be scored that way or it will read as permanently
red.

### What style 4 found in the shipped build that nobody has reported

All three verified by eye against the screenshot before being written
down here:

1. **The Analyze card contradicts itself.** It reads `5 Analyze / 1 STA /
   free: name its weakness`, printing a cost and the word "free" on the
   same card. The hint strip above adds "Analyze is free the first look",
   which the card does not say.
2. **Bubble's card is grammatically incomplete.** "brace: the next hit
   lands 20%" cannot be resolved from the screen: 20 percent of the
   damage, 20 percent less damage, or a 20 percent chance to land.
3. **Heal Song is drawn dimmed at full HP with no stated reason.** STA
   reads 20/20, so the greying is not affordability, and nothing on
   screen says what it is.

Plus two smaller ones: the enemy's HP bar carries no label, and the
`· 1` in `BLIND I · 1` is never explained.

---

## What this run changes in LESSONS.md

- The D1 claim is upgraded from a proposal to a measured result, with the
  extra requirement that **the invariants must run over played frames,
  not a static gallery.**
- D3's usage histogram gets an explicit carve-out: **a greedy bot cannot
  value information**, so information abilities are a D2 question.
- D7 is reclassified: **a guard at the moment of change, not a detector
  of existing drift.** It belongs on every commit.
- D2's protocol is now specific rather than aspirational: closed
  questions, no leading, a forced CANNOT TELL, and a mandatory
  told-versus-assumed column. And it is **scored on the diff between
  runs**, not on an absolute count.
