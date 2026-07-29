import { createWorld } from "../src/world";
import { runWorld } from "../test/nav";
import { casualBot } from "../test/bots";
let wins = 0, worst = 0, deaths = 0, failSeeds: number[] = [];
for (let seed = 0; seed < 5000; seed++) {
  const r = runWorld(createWorld(seed), (fi) => casualBot(seed * 991 + fi * 97));
  if (r.victory) wins++;
  else failSeeds.push(seed);
  worst = Math.max(worst, r.actions);
  deaths += r.deaths;
}
console.log(`casual x5000: ${wins}/5000 within cap, worst ${worst}, deaths ${deaths}`);
console.log(`fail seeds: ${failSeeds.slice(0, 20).join(",") || "none"}`);
