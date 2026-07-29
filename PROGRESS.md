# Overnight build log

Goal (binding once the run starts): build the vertical slice of the agreed
underwater jam game per DESIGN.md in TypeScript + bun, in the style of the
TRUNK! overnight rebuild. Capture the merged design faithfully, iterate on
design, problem-finding, visuals, and bot playtests. Above all make it FUN
(loop + decisions + uncertainty + curve + juice).

Timebox (binding): the run lasts until 11:00 AM Jul 29, no longer and NO
SHORTER. At 10:15 AM all feature work stops; the final adversarial panel and
the honest morning report run regardless of state.

Early done-claims are expected and wrong. An hour-2 "done" is a smell, not a
milestone. If every gate is green before 10:15 AM, the run does NOT stop; it
enters the improvement loop, in this order, repeating until the freeze:
1. Fix ALL open reviewer findings, every severity, not just high
2. Deepen playtests: more sims, hostile seeds, longer soaks, new probe bots
3. Juice pass: feedback, animation, screen feel, audio polish
4. Content toward the budget ceilings: stretch items in slice order
5. Re-run the adversarial panel; its findings restart this loop
The run may never idle and may never declare itself finished before the
freeze. SHIPPED is a state of the build, not a stopping condition.

Slice target, in priority order:
1. Turn-based combat core: stamina economy, conditions, disable refund
2. One regular enemy (vampire squid) fight, fully bot-verified
3. Boss 1 with limb targeting + phase break (the set-piece)
4. Hub reef: swim-around exploration, merfolk NPC, memory fragments
5. Relic gate: blocked without Tide Relic, parts with it (bot-asserted)
6. Dungeon 1 connecting hub to boss 1
7. Juice pass: water mood, hit feedback, condition VFX, sound if time
8. Stretch: song-seal puzzle door, dungeon 2 + boss 2
9. Stretch, SIM-ONLY (no UI, nothing shipped in the playable build): the
   enemy-variety lab. Prototype jam-scope enemy twists as pure game.ts
   variants and bot-test them: an enemy that applies Blind or Slow to the
   player, an enemy immune or resistant to one condition, an enemy that
   buffs. Run the G3/G4 bot batteries against each variant and write the
   results (win-rate deltas, dominance checks, recommended numbers) into
   the morning report as "Enemy variety lab" for Marc's balance question.
   Hard rule: none of this appears in dist/index.html tonight.

## State: RUN IN PROGRESS (priority 1: combat core)

## Exit gates

The run is NOT done until every gate is GREEN with pasted evidence, or
explicitly marked UNVERIFIED with the reason. A gate claim without its
instrument's output pasted below it does not count. "It should work" and
"implemented" are not evidence; test output, run statistics, and screenshot
paths are.

UNVERIFIED is not an exit hatch: it requires pasted evidence of the attempt
(what was run, what blocked it). G1, G2, and G8 may NEVER be UNVERIFIED once
State leaves SCAFFOLD. State may not read SHIPPED unless G1 through G4 and
G8 are GREEN.

Judge bots are pinned BEFORE any tuning and may not be weakened afterward:
- casual bot: uniform random over currently affordable abilities
- optimal bot: greedy with 1 to 2 ply lookahead
- spam-X bot: always ability X when affordable, else pass
The adversarial panel reviews the bot code as well as the game; changing a
bot policy after tuning starts requires a logged reason and re-running every
gate that used it.

- G1 BUG-FREE: full bot suite green, soaked 5 consecutive runs; fuzz bot
  (random inputs, 10k+ steps) survives with no crash and no invariant
  violation (stamina in [0, max], HP in [0, max], conditions always expire,
  relic gate never passable without the relic); built dist/index.html loads
  with zero console errors.
- G2 WINNABLE: scripted full-run bot clears the entire slice start to finish;
  the casual bot also finishes, deaths allowed. Softlock definition: from
  every checkpoint (including immediately after each death) the casual bot
  reaches the slice end within 5,000 actions. Paste run stats and the cap.
- G3 DIFFICULTY BAND: across 500+ simulated fights per encounter: casual bot
  win rate 60 to 90 percent per regular encounter; optimal bot may reach 100
  percent win but must average at least 4 turns per fight and lose at least
  10 percent HP per regular fight (20 percent on bosses); casual bot mean
  fight length 4 to 15 turns per encounter, no encounter above 15. Any change
  to these bands during the run is logged with the reason.
- G4 NO DOMINANT STRATEGY: the BEST single-ability-spam bot (try every
  ability) must underperform the mixed-strategy bot by at least 10 win-rate
  points or lose at least 20 percent more HP; the condition-ignoring bot must
  underperform the condition-using bot by the same margins. Blind and Slow
  must each individually pay for their stamina cost. If disables do not pay,
  the core design promise is broken; fix the numbers, not the test.
- G5 FUN AUDIT: written scorecard (loop, decisions, uncertainty, curve,
  juice) with concrete evidence per item, TRUNK! style. Machine ceiling is
  "evidenced"; final call is the user's morning playtest.
- G6 VISUAL: screenshot gallery covering every screen and major state,
  reviewed by a fresh-eyes visual agent. The REVIEWER assigns severity; the
  builder may fix or escalate to a second independent agent, never
  downgrade. All high-severity findings fixed and re-rendered. Placeholder
  art must be readable and cohesive, and designed to be reskinned by
  Glass_Goat. 2.5D check: depth layering must never cost gameplay
  readability; the reviewer screenshots must confirm the play plane, enemy
  states, and boss parts stay unambiguous over the parallax.
- G7 AUDIO: GREEN requires at minimum these named events shipped and
  machine-verified as wired (fires on the right state change): hit, disable
  landed, phase break, fragment pickup, death, mute toggle. Levels checked
  for clipping. If no audio ships, G7 is UNVERIFIED, never vacuously green.
  Musical quality is UNVERIFIED by definition and flagged for human ears.
- G8 DESIGN FIDELITY: an adversarial agent checks the built game against
  DESIGN.md three ways: (a) everything in slice priorities 1 to 6 is
  present, (b) everything built matches DESIGN.md's rules and numbers,
  (c) zero parking-lot features crept in. Budget numbers are CEILINGS for
  the slice; under-budget content is reported, not failed.
- G9 HONEST MORNING REPORT: final section of this file lists every claim as
  PROVEN (with reproduce command), EVIDENCED, or UNVERIFIED. No claim
  without its category.

## Adversarial protocol (mandatory cadence)

Plenty of time to refine; also plenty of time to self-deceive. These rules
exist because an agent under a deadline will claim done when it is not.

- Every major feature (and at least every 90 minutes): spawn fresh-eyes
  agents that see only artifacts (diffs, screenshots, the built page, this
  log), never the builder's rationale. Rotate lenses: code correctness,
  visual review, design fidelity vs DESIGN.md, and a skeptic whose only job
  is to refute the latest done-claims.
- All high-severity findings are fixed before any new feature work.
- Before the state line of this file may say SHIPPED: a final panel of 3
  adversarial agents is spawned with the explicit brief "prove this is NOT
  done" (break it with hostile inputs, find fidelity violations, find visual
  defects). SHIPPED requires the panel to return zero high-severity
  findings. If it finds any: fix, re-run the panel, repeat.
- Every "X is done" line in the feature log must cite its evidence in the
  same line (test name, run stat, or screenshot path).
- If a gate cannot go green by 10:15 AM, it is marked UNVERIFIED with the
  reason. An honest red gate beats a dishonest green one.

## Verification loop commands
- `~/.bun/bin/bun test` (bot suite; keep green at every commit)
- `~/.bun/bin/bun build.ts` then open `dist/index.html`
- Screenshots: `/Applications/Firefox.app/Contents/MacOS/firefox --headless
  -no-remote --profile <tmpprofile> --screenshot out.png
  "file:///Users/tomriddle1/tidesong/dist/index.html"`
  (user's Firefox is open; -no-remote + temp profile required)
- Every feature round: implement, bun test, screenshot and LOOK at it,
  commit. Republish playable artifact periodically.
- Commit cadence is binding: never more than 45 minutes of uncommitted
  work (the realignment loop enforces the ceiling), and small commits are
  the norm (TRUNK! shipped ~19 in one night). Each new mechanic and its
  bot test land in the SAME commit; a mechanic without its test does not
  get committed. Tests run before every commit and must be green; a red
  suite blocks everything until fixed.

## Launch sequence (first actions when the run starts)
1. Start `caffeinate -dims` in the background; verify it is running.
2. Start the realignment loop: /loop every 45 minutes with the prompt below.
   It exists because context compaction summarizes the mission over a long
   run; the loop re-anchors against the SOURCE FILES, not the summary.
3. Print `date`, append the run-start line to the feature log, begin
   priority 1.

Realignment prompt (verbatim, injected every 45 minutes):
"Realign: run `date` and print it. Re-read /Users/tomriddle1/tidesong/
PROGRESS.md and /Users/tomriddle1/tidesong/DESIGN.md in full; they are the
binding spec, your memory of them is not. For any decision they do not
cover, consult the source docs in docs/ before inventing: Marc's proposal
PDF and Glass_Goat's combat PDF for design intent, the merge proposal for
scope, the visual sketch for layout and UI reference. State which slice
priority and gate you are on. Verify caffeinate is alive and bun tests are
green. Commit and push current work. The run does not stop before 11:00 AM Jul 29 under
any circumstances; SHIPPED is not a stopping condition; if you believe you
are done, you are in the improvement loop, so pick its next item and
continue."

## Rules for the run
- Every turn starts by running `date` and printing the output, so the /goal
  evaluator (which only sees the transcript) can verify wall-clock time.
  This is what makes "no shorter than 11:00 AM" externally enforceable.
- Keep the machine awake: start `caffeinate -dims` in the background at run
  start and verify it is running at each checkpoint.
- No em dashes in any user-shareable text.
- No session-link trailers or AI co-author lines in commits.
- Placeholder art only; all real art is Glass_Goat's.
- game.ts stays pure simulation (no DOM); that is what makes bots possible.
- DESIGN.md wins on conflicts, but it is a distillation: before inventing
  anything it does not cover, check docs/ first. Marc's proposal PDF and
  Glass_Goat's combat PDF carry design intent the summary may have dropped
  (that is how condition stacking was nearly lost); the merge proposal
  carries agreed scope; the visual sketch is the reference for every screen
  layout, HUD element, and label. Cite which doc informed any invented
  detail in the feature log.

## Feature log (chronological)
- 23:59 Jul 28 RUN START. caffeinate alive (pid confirmed), realignment
  cron armed (job a2466bf3, :13/:43, rounded from 45m since cron cannot
  cycle 45 cleanly; 30m also tightens the commit ceiling), /goal hook
  active with the 11 AM + morning-report condition.
- 00:02 Combat core v1: condition levels I/II per Glass_Goat stacking
  (refund only on first application), Blind 60%/80% miss with II zeroing
  dodge, Slow skip-every-other with II halving damage, Heal Song 40x2,
  Bubble 60% next-hit, Analyze flag, seeded mulberry32 RNG, enemy action
  in advanceTurn, victory/defeat outcomes. Numbers logged in game.ts
  header; dodge affects damage only, conditions always land (cites
  Glass_Goat doc: "consistent and predictable results"). Evidence:
  `bun test` 19 pass / 0 fail, 10,998 expect() calls, incl. 100-seed
  fuzz with invariant checks (STA/HP bounds, condition levels, fights
  terminate under 200 rounds). dist builds 2.8 KB.
