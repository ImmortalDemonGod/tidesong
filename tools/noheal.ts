import { createWorld } from "../src/world";
import { runWorld } from "../test/nav";
import { optimalBot, ABILITY_KEYS } from "../test/bots";
const NO_HEAL = ABILITY_KEYS.filter((k) => k !== "healSong");
let wins = 0, deaths = 0, minActions = Infinity;
for (let seed = 0; seed < 50; seed++) {
  const r = runWorld(createWorld(seed), () => optimalBot(NO_HEAL));
  if (r.victory) wins++;
  deaths += r.deaths;
  minActions = Math.min(minActions, r.actions);
}
console.log(`no-heal optimal: ${wins}/50 clears, ${deaths} total deaths, fastest ${minActions} actions`);
