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

## State: SCAFFOLD READY, BUILD NOT STARTED

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

## Rules for the run
- No em dashes in any user-shareable text.
- No session-link trailers or AI co-author lines in commits.
- Placeholder art only; all real art is Glass_Goat's.
- game.ts stays pure simulation (no DOM); that is what makes bots possible.

## Feature log (chronological)
(empty; the overnight run appends here)
