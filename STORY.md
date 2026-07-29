# TIDESONG story bible (draft for Marc)

Everything here is a proposal. All in-game verse, lesson, and dialogue
text is marked `(placeholder)` in the code and is yours to keep, rewrite,
or throw out. What this document is for: the prototype needed SOME story
to test whether the story systems work, so rather than write pretty
fragments with nothing behind them, here is the spine they imply, the
holes I left open on purpose, and the decisions that are yours.

Source: your proposal PDF says the player journeys "to uncover what
happened to the civilization and determine whether its legacy should be
restored or left to disappear," and that the story unfolds through
exploration and optional discoveries rather than exposition. That is the
shape I built toward.

## The spine (one paragraph)

Naming is power. The merfolk sang the tides their names and the sea kept
its order. Naming works both ways: to sing a thing's name is to hold it,
and to sing it aloud is to teach it to whatever is listening. When the
keepers understood that the deep was learning the sea's own name from
hearing them sing it, they made a choice: they let the songs die. The
silence protected the sea and also unmade it. Unsung things lost their
names, and what has no name the dark can take. The shark went on guarding
a hall whose song he had forgotten, then forgot himself. The silence came
too late anyway: the eel swallowed the sea's name whole. A small fish
comes down, learns the words, kills the thing holding the name, and then
has to decide whether a name is worth saying out loud.

## Why this spine and not another

It fell out of the mechanics rather than being pasted on, which is the
only reason I trust it:

- **Analyze** is learning a thing's name (its weakness, the boss's key
  part, the eel's wandering weak point).
- **The song-seal door** is restoring a remembered sequence: the puzzle
  IS the theme.
- **Each verse adds a harmony voice to the score**, so the song audibly
  reassembles as you play. That is a story mechanism, not decoration.
- **The eel's phase-1 weak point wanders every run**, because the thing
  that ate a name does not keep a fixed shape.
- **Corruption** has one definition everywhere in the build now: it is
  not a force, it is an absence with teeth. Things that lost their names
  went feral. That makes every enemy a victim, which is why the shark's
  death line has him still facing the door he was set to keep.

## The choice (your central question, made playable)

Kill the eel and the sea's name spills out. The game stops and asks:

- **SING IT BACK.** The sea can be called again, and anything listening
  learns the name. Ending: "the sea remembers its name."
- **LET IT GO.** The name thins and is gone. Nothing can call the sea and
  nothing can hunt it. Ending: "the sea keeps its silence."

The ending also scales with how many verses you actually recovered, so a
player who skipped the reef sings a thin song and gets "the sea half
remembers." The slice deliberately does NOT tell you which answer is
right. If you want a right answer, that is a design decision to make on
purpose, not by default.

## The five verses (draft, all placeholder)

Collected in any order; recited in narrative order on the ending screen.
Each has a title, a verse (the sung line), and a lesson (what it teaches,
readable any time on the pause screen).

1. **THE NAMING** (reef) - naming was how the merfolk held the sea.
2. **THE THINNING** (the trench, risk-for-reward) - what corruption
   actually is: an absence, not an enemy.
3. **THE GUARDIAN** (first ruin) - the shark's tragedy, before you fight
   him.
4. **THE KEEPERS' CHOICE** (sealed behind the song-seal puzzle) - the
   inciting incident: the songs did not fade, they were let go on
   purpose. This is the load-bearing verse and it is currently OPTIONAL,
   which is a real risk. See open questions.
5. **THE THEFT** (second ruin) - the eel took the sea's name, and killing
   it makes the name loose again. This verse sets up the ending choice.

## What I deliberately did not decide

1. **Whether restoring the song is right.** The build presents both
   endings neutrally. Your call whether the game has an opinion.
2. **Who the player is.** Currently: a small fish who still remembers how
   to carry a tune, which is why the keeper says "you came in singing."
   Deliberately ordinary. Verse 4's "the one who would come singing"
   could be read as prophecy if you want a chosen one instead; nothing
   else in the build commits either way.
3. **The keeper herself.** She is the last merfolk in the slice and she
   now answers according to which verses you carry, including admitting
   the keepers' choice was hers and that she still does not know if it
   was right. She has no name, no history, and no scene of her own. She
   is the biggest character opportunity in the build.
4. **What happens after.** Both endings stop at the decision. There is no
   epilogue.
5. **The register.** Everything is written lowercase, elegiac, mythic.
   Your proposal also lists historical journals and bestiary entries as
   collectibles, which implies a drier archival voice was on the table. I
   picked one voice; swapping it is a text-only change.

## Open questions for the 11am table

1. **Should verse 4 stay optional?** It carries the inciting incident and
   it is behind an optional puzzle, so a player can finish the game
   never learning why the songs faded. Options: move it to the critical
   path, split it (a hint on the path, the full verse in the alcove), or
   accept that the "why" is optional lore.
2. **Do the verses form one song, or five independent fragments?** I
   recite them in narrative order at the end, which assumes one song.
3. **Should collectibles give stats?** Your proposal says collectibles
   should deepen understanding "rather than simply increase statistics."
   The prototype currently does BOTH: each verse is +1 max stamina AND a
   readable lesson. That was a deliberate call after a playtester said
   the optional hub felt pointless. If the stat half bothers you, delete
   it: the understanding half stands alone.
4. **How much corruption backstory is on-screen versus in collectibles?**
   Right now: entirely in collectibles, per your "rather than lengthy
   exposition" line.
5. **Do bosses get dialogue?** They currently get one death line each and
   no speech. The shark forgetting his own name is the kind of thing that
   might want a voice.

## Text inventory (everything you would rewrite)

- 5 verse lines + 5 lesson paragraphs (`src/world.ts`, fragments array)
- 8 keeper dialogue lines (`src/world.ts`, `interact`)
- boss and area intro cards (`src/main.ts`, banner strings)
- the choice screen and both endings (`src/render.ts`, victory block)
- world event lines: relic pickup, guardian death, eel death, both
  ending resolutions, the song-seal, the trench (`src/world.ts` logs)
- title screen two-liner (`src/render.ts`)

Every one of them is a draft. The systems that carry them (verse
collection, the lesson screen, the keeper's state-aware ladder, the
harmony-per-verse score, the ending choice and its verse-count variants)
are the parts I would like to keep.
