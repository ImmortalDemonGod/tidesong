// G2 WINNABLE, encoded per PROGRESS.md: the scripted full-run bot clears the
// slice start to finish (zero deaths), and the casual bot finishes from every
// checkpoint within the 5,000-action cap (deaths allowed; natural deaths
// exercise the dungeon-entrance checkpoint repeatedly).
// Measured 01:10: optimal 50/50, 0 deaths, max 100 actions; casual 100/100,
// max 1862 actions.

import { expect, test } from "bun:test";
import { createWorld } from "../src/world";
import { runWorld } from "./nav";
import { casualBot, optimalBot } from "./bots";

const ACTION_CAP = 5000;

test("G2: scripted full-run bot clears the slice on 50 seeds with zero deaths", () => {
  for (let seed = 0; seed < 50; seed++) {
    const r = runWorld(createWorld(seed), () => optimalBot(), ACTION_CAP);
    expect(r.victory).toBe(true);
    expect(r.deaths).toBe(0);
    expect(r.fragmentsCollected).toBe(3);
  }
});

test("G2: casual bot finishes 100 of 100 runs within the 5000-action cap", () => {
  for (let seed = 0; seed < 100; seed++) {
    const r = runWorld(createWorld(seed), (fi) => casualBot(seed * 991 + fi * 97), ACTION_CAP);
    if (!r.victory) {
      throw new Error(`seed ${seed} did not finish: ${r.actions} actions, ${r.deaths} deaths`);
    }
    expect(r.victory).toBe(true);
  }
});
