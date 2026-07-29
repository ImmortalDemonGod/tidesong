// Pure classifier from sim log lines to audio/FX events. Kept DOM-free so
// G7 can machine-verify the wiring: every named event maps from real log
// output, and the mapping itself is unit-testable.

export type GameEvent =
  | "hit"
  | "disable"
  | "phaseBreak"
  | "pickup"
  | "death"
  | "rebuff"
  | "victory"
  | "note"
  | "jar"
  | "payoff";

export function classifyLogLine(line: string): GameEvent | null {
  // Analyze is an information chime, not an attack thunk (its log line
  // contains "dmg", which would otherwise classify as hit: skeptic F7)
  if (line.startsWith("Analyze:")) return "note";
  if (line.includes("the low dark bites")) return "jar";
  if (line.includes("PHASE BREAK") || line.includes("BREAKS")) return "phaseBreak";
  // the design's reward moments ring triumphant: the enemy misses because
  // YOU blinded it, skips because YOU slowed it, glances off YOUR bubble
  // (fun diagnosis: the pillar's payoffs were mute)
  if (
    line.includes("missed (blind)") ||
    line.includes("skips its action") ||
    line.includes("Bubble absorbed")
  )
    return "payoff";
  if (line.includes("disable landed") || line.includes("raised to II")) return "disable";
  if (line.startsWith("death")) return "death";
  if (line.includes("memory fragment")) return "pickup";
  if (line.includes("shoves you back") || line.includes("seal holds")) return "rebuff";
  // every combat win and the relic award celebrate, not just the two
  // world-transition lines (played-experience hunt, HIGH-2)
  if (
    line.includes("currents part") ||
    line.includes("falls silent") ||
    line.includes(": victory") ||
    line === "victory" ||
    line.includes("Tide Relic is yours")
  )
    return "victory";
  // song-seal stones ring or jar audibly (played-experience hunt, HIGH-1)
  if (line.includes("rings true") || line.includes("stands open")) return "note";
  if (line.includes("jars against") || line.includes("dodged")) return "jar";
  if (line.includes("dmg") || line.includes("hits for") || line.includes("hits the")) return "hit";
  return null;
}

// Pure mapper from a sim log line to the ability that produced it, keyed on
// the ability-name prefix every player-action line carries. Presentation
// uses this for per-ability cast voices and effects; kept here (DOM-free)
// so the wiring is unit-testable from real log lines like the classifier.
const CAST_PREFIXES: Array<[string, string]> = [
  ["Tail Strike", "tailStrike"],
  ["Silt Burst", "siltBurst"],
  ["Fin Slash", "finSlash"],
  ["Heal Song:", "healSong"],
  ["Analyze:", "analyze"],
  ["Bubble:", "bubble"], // the colon excludes "Bubble absorbed...", an enemy-slot line
];

export function abilityCast(line: string): string | null {
  if (line.includes("(Heal Song restored)")) return null; // world event, not a cast
  for (const [prefix, key] of CAST_PREFIXES) {
    if (line.startsWith(prefix)) return key;
  }
  return null;
}
