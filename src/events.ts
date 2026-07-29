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
  | "jar";

export function classifyLogLine(line: string): GameEvent | null {
  if (line.includes("PHASE BREAK") || line.includes("BREAKS")) return "phaseBreak";
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
