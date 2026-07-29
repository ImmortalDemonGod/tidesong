# Post-jam backlog (compiled at the end of the overnight run)

Every deferred finding from the night's nine review rounds, seven
playtests, and three panels, with evidence pointers. Nothing here
blocks the slice; everything here is jam-scope material for the team
if the 11am playtest greenlights the game. Sources: PROGRESS.md
feature log (entries cite their evidence), DESIGN.md amendments.

## Design questions the team owns (see also "For the 11am table")

1. Death-as-healing rhythm: the pity ladder plus boss mercy makes a
   lost boss attempt the practical recovery at an empty song. Measured
   necessity (0 to 17.3 percent boss-retry wins without it). Options:
   keep, tune, or add mid-dungeon rest points. Ruling logged in
   DESIGN.md's death rule.
2. Analyze on regular enemies: the intent telegraph shows next damage
   for free, so Analyze's exclusive value there is best-condition plus
   dodge. Options: reveal enemy turn plans, add a mechanical rider, or
   keep it cheap at 1 STA.
3. Heavy-cycle shape: the every-3rd-slot metronome shipped and holds
   all bands. Should heavies vary per enemy type in the full game
   (different cycles, multi-turn windups, feints)?
4. Enemy type 3: the lab's tested candidates, RE-MEASURED at final
   mechanics (post heavy-cycle; see the lab re-run entry in
   PROGRESS.md): warded squid (immunity; fair ONLY if Analyze
   telegraphs it and the sprite shows a ward: wrong-tool play now
   loses 89 HP under heavies) and bulwark squid (stacking damage;
   compounds with the heavy cycle, so start at +2 every 3rd slot, not
   every 2nd, or exclude heavy slots from the buff). Both sim-only.
5. Blind is the specialist, slow the generalist. After the Jul 29
   measurement pass, blind is decisively right against evasive enemies
   (squids) and slow against everything else. On the dungeon-2 enemies
   the relic echo makes raw damage strong enough that the pinned bot
   never casts blind at all. Options for the full game: give type 3 an
   evasion or multi-hit profile so blind has a second home, make blind
   scale with the heavy cycle, or accept the specialist role and lean
   into it.
6. Trash variety: three of six encounters are squid-family. The ink
   squid's player-condition twist was the playtests' favorite trash
   idea; more twists on that axis beat more stat variants.

## Presentation polish (all LOW, none embarrass the demo)

- Boss intro banner overdraws the boss sprite and part labels during
  its 2.6 seconds (validation playtest screenshot evidence). Consider
  a lower band or delayed part-panel draw.
- Damage floaters can cross the analyze-hint text for a beat in boss
  fights.
- Unaimed drift breaks show the pre-break number at press time (11
  percent of breaks; logged ruling: the aimed-information contract;
  the line updates during the answer beat).
- Victory ticker shows two win lines on boss kills (audio already
  dedupes them).
- macOS Cmd-key combinations can eat a keyup and briefly auto-walk
  the fish; blur recovery works (panel seat A, INFO).
- Condition level II paths (80 percent blind, slow II damage floor)
  rarely occur in natural play; consider surfacing raise-to-II more.

## Deferred scope (unchanged from DESIGN.md, team decisions)

localStorage saves, flee/escape from combat, settings beyond
pause/mute, difficulty modes, speedrun timer, touch controls, input
remapping, localization, third regular enemy type, player-side
condition UI depth.

## Engine decision

The prototype is TypeScript plus canvas on the TRUNK! recipe (pure sim
core, bot batteries, single-file dist). The merge proposal left Unity
versus Godot versus web open for the full game; the bot harness and
sim core port to any of them, and the G3/G4 band batteries are the
reusable balance instrument either way.
