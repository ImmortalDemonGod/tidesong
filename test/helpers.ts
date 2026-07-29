import { step, type WorldState } from "../src/world";

// Axis-greedy walk that stops on any area or mode change.
export function walk(w: WorldState, x: number, y: number, cap = 200): void {
  const area = w.area;
  let guard = 0;
  while (
    (w.pos.x !== x || w.pos.y !== y) &&
    w.mode === "explore" &&
    w.area === area &&
    guard++ < cap
  ) {
    if (w.pos.x < x) step(w, "right");
    else if (w.pos.x > x) step(w, "left");
    else if (w.pos.y < y) step(w, "down");
    else step(w, "up");
  }
}
