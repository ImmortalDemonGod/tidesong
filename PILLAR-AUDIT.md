# Pillar audit: "every mechanic should appear throughout the game in increasingly interesting ways"

Marc's proposal, under Small Scope / High Polish: "Rather than dozens of
mechanics, every mechanic should appear throughout the game in
increasingly interesting ways." This is an audit of the shipped slice
against that sentence, done Jul 29 after a played question asked whether
it was actually maintained. It was not, in four places. Two are fixed
below, two are logged as jam-scope decisions.

The slice has three beats: the HUB REEF, the FIRST RUIN (choir hall),
and the SECOND RUIN (drowned gullet). A mechanic passes if it appears in
more than one beat AND is more interesting the second time.

| Mechanic | Hub | Ruin 1 | Ruin 2 | Escalates? |
|---|---|---|---|---|
| Stamina economy | - | yes | yes | flat by design (the one rule) |
| Conditions (blind, slow) | - | yes | yes | flat |
| Condition levels I/II | - | yes | yes | II decays to I, same everywhere |
| Disable refund | - | yes | yes | flat |
| Heavy cycle | - | yes | yes | **WAS FLAT, now escalates in boss phase 2** |
| Intent telegraph | - | yes | yes | yes: bosses add break warnings |
| Limb targeting | - | boss | boss | yes: fixed key, then a key that wanders |
| Phase break | - | boss | boss | yes: phase 2 now winds up faster |
| Utility part breaks | - | boss | boss | flat |
| Analyze | - | yes | yes | yes: names a condition, then a boss part |
| Bubble guard (charged) | - | yes | yes | flat |
| Heal Song charges | - | yes | yes | flat (restored once per ruin) |
| The low dark | trench | floor | risen floor | **WAS HUB ONLY, now rises per beat** |
| Song-seal puzzle | yes | no | **yes (new)** | **WAS HUB ONLY, second one is harder** |
| Verses and harmony | 3 | 1 | 1 | yes: each adds a voice and a stat |
| Corridor guard | - | yes | yes | flat |
| Relic gate | yes | - | - | once, inherent to a one-relic slice |
| Relic echo | - | granted | used | once, but it is the power curve |
| Ink (a condition on YOU) | - | - | one fight | **once: logged, see below** |

## Fixed by this audit

1. **The low dark was a hub gimmick.** It hurt only in the trench on the
   first screen. It is now the world's rule: a bounded trench that
   teaches it, the collapsed floor of the first ruin, and in the drowned
   gullet it has risen a row so the swimmable band is narrower. Drawn
   with a ragged lip and labelled in every beat, and the warning
   vignette reads the same rule the damage does.
2. **The heavy cycle never escalated.** The same three-slot metronome
   ran in the first squid fight and in the final boss. Boss phase 2 now
   winds up every SECOND slot, so a phase break changes the rhythm of
   the fight and not just the damage number. The intent line and the
   telegraph honesty tests cover it.
3. **The song-seal appeared exactly once**, in the hub, and it is the
   slice's only puzzle TYPE. The second ruin now has one too, and it is
   harder in the way the pillar asks for: it COMBINES with another
   mechanic instead of just adding a note.

## Logged, not fixed (jam-scope decisions for the team)

- **Ink appears in exactly one fight.** Enemy type 2's twist (a
  condition on the player) is introduced and then never developed. The
  natural escalation is the eel using it in phase 2, which combines the
  boss puzzle with the type-2 twist. That is a boss rebalance, so it is
  a decision for the team rather than a change to make at the end of a
  prototype run.
- **The relic appears once** because the slice has one relic. Marc's
  budget allows 1 to 2; a second relic is where "relics reshape earlier
  areas" would come from, and it needs a second pass over the hub.
- **Several combat rules are deliberately flat** (the stamina economy,
  the refund, utility breaks). These are the constants the other
  mechanics vary against. Flat is correct for them; the pillar is about
  the mechanics that carry the experience.
