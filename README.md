# TIDESONG (working title)

A vertical-slice prototype for Team Ratateam's itch.io Underwater Jam
project (jam runs Jul 30 to Oct 5, 2026). Built overnight to test the
merged design in TypeScript; the engine for the final entry is the team's
call (the merge proposal left Unity vs Godot vs web open).

A small fish crosses the ruins of a fallen merfolk civilization: swim the
hub reef, sing the seal open, dive two ruins, break the corrupted shark
and the corrupted eel limb by limb, and let the sea remember its song.

- Turn-based, disable-first combat: conditions on regular enemies, full
  limb targeting on bosses, one stamina economy, HP is sacred
- The eel's weak point wanders every run; Analyze finds it
- Song-seal puzzle door, Tide Relic gate, five memory fragments, the
  trench where you should not swim low

## Play

`dist/index.html` is the whole game in one file: open it in a browser.
WASD/arrows swim, E talks, 1-6 act in combat, up/down aim at boss parts,
space passes, P pauses, M mutes, R replays after victory.

## Develop

Requires [bun](https://bun.sh).

```
bun test          # the bot-playtest and invariant suite
bun build.ts      # rebuilds dist/index.html
bun tools/tune.ts # difficulty band report across all encounters
```

- `DESIGN.md`: the binding spec (the team's merged design + logged
  decisions)
- `PROGRESS.md`: the overnight build log, exit gates, and evidence
- `docs/`: the original member design docs, agreed merge proposal, and
  greybox visual sketch

All names are placeholders. All art, style, and character design:
Glass_Goat (everything visual here is a placeholder skeleton). Design and
story: Marc. Code: ImmortalDemon.
