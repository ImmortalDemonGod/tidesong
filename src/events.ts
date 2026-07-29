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
  | "victory";

export function classifyLogLine(line: string): GameEvent | null {
  if (line.includes("PHASE BREAK") || line.includes("BREAKS")) return "phaseBreak";
  if (line.includes("disable landed") || line.includes("raised to II")) return "disable";
  if (line.startsWith("death")) return "death";
  if (line.includes("memory fragment")) return "pickup";
  if (line.includes("shoves you back")) return "rebuff";
  if (line.includes("currents part") || line.includes("falls silent")) return "victory";
  if (line.includes("dmg") || line.includes("hits for") || line.includes("hits the")) return "hit";
  return null;
}
