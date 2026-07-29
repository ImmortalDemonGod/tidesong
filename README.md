# TIDESONG (working title)

A vertical-slice prototype for Team Ratateam's itch.io Underwater Jam
project (jam runs Jul 30 to Oct 5, 2026). Built overnight to test the
merged design in TypeScript; the engine for the final entry is the team's
call (the merge proposal left Unity vs Godot vs web open).

A small fish crosses the ruins of a fallen merfolk civilization: swim the
hub reef, sing the seal open, dive two ruins, break the corrupted shark
and the corrupted eel limb by limb, and let the sea remember its song.

- Turn-based, disable-first combat where every enemy TELEGRAPHS its next
  move: the intent line shows the incoming strike, heavy windups (every
  3rd blow hits 1.6x), slowed skips, blind miss chances, and what changes
  if the part you are aiming at breaks
- Conditions on regular enemies, full limb targeting on bosses, one
  stamina economy, HP is sacred; level II conditions fade to level I
  instead of vanishing
- The eel's weak point wanders every run; Analyze finds it. The ink squid
  (enemy type 2) blinds YOU; your conditions still land
- Song-seal puzzle door, Tide Relic gate, five memory fragments that
  reassemble into the sea's song (each one adds a harmony voice to the
  music; the victory screen sings them back), the trench where you
  should not swim low
- Deaths coach (the veil names the tool you ignored) and converge (pity
  ladder plus a mercy Heal Song at empty-handed boss losses)

## Play

`dist/index.html` is the whole game in one file: open it in any modern
browser, no server needed. Verified in Firefox and Chromium (full
playthroughs, locked 60fps, flat memory over long sessions).
WASD/arrows swim, E talks, 1-6 act in combat, up/down aim at boss parts,
space passes, P pauses, M mutes, R replays after victory. Click works
everywhere keys do.

## Develop

Requires [bun](https://bun.sh).

```
bun test          # the bot-playtest and invariant suite (93 tests)
bun build.ts      # rebuilds dist/index.html
bun tools/tune.ts # difficulty band report across all encounters
```

- `DESIGN.md`: the binding spec (the team's merged design + every logged
  amendment with its reason)
- `PROGRESS.md`: the overnight build log, exit gates with stamped
  verdicts, the honest morning report, and the 11am briefing
- `BACKLOG.md`: post-jam worklist (design questions, polish, deferred
  scope) with evidence pointers
- `docs/`: the original member design docs, agreed merge proposal, and
  greybox visual sketch

All names are placeholders. All art, style, and character design:
Glass_Goat (everything visual here is a placeholder skeleton). Design and
story: Marc (all verses are marked drafts). Code: ImmortalDemon.
