# TIDESONG (working title)

A vertical-slice prototype for Team Ratateam's itch.io Underwater Jam project
(jam runs Jul 30 to Oct 5, 2026). It tests the agreed design in TypeScript;
the engine for the final entry is the team's call (the merge proposal left
Unity vs Godot vs web open).

A small fish explores the ruins of a fallen merfolk civilization. Turn-based
combat about disabling enemies, not out-damaging them: conditions on regular
enemies, full limb targeting on bosses, one stamina economy, HP is sacred.

- `DESIGN.md`: the merged design spec the team agreed on (Jul 23 meeting)
- `docs/`: the original design docs (Marc, Glass_Goat), the agreed merge
  proposal, and the greybox visual sketch
- `PROGRESS.md`: build log

## Run it

Requires [bun](https://bun.sh).

```
bun test          # bot playtest suite
bun build.ts      # bundles the game into dist/index.html
open dist/index.html
```

All names are placeholders. All art, style, and character design: Glass_Goat.
Design and story: Marc. Code: ImmortalDemon.
