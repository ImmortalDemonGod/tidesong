import { createWorld } from "../src/world";
import { runWorld } from "../test/nav";
import { casualBot, optimalBot } from "../test/bots";

let optWins = 0, optDeaths = 0, optActMax = 0;
for (let seed = 0; seed < 50; seed++) {
  const r = runWorld(createWorld(seed), () => optimalBot(undefined, 55));
  if (r.victory) optWins++;
  optDeaths += r.deaths;
  optActMax = Math.max(optActMax, r.actions);
}
console.log(`scripted optimal: ${optWins}/50 victories, ${optDeaths} total deaths, max actions ${optActMax}`);

let casWins = 0, casDeathsTot = 0, casActMax = 0, casFrag = 0;
for (let seed = 0; seed < 100; seed++) {
  const r = runWorld(createWorld(seed), (fi) => casualBot(seed * 991 + fi * 97));
  if (r.victory) casWins++;
  casDeathsTot += r.deaths;
  casActMax = Math.max(casActMax, r.actions);
  casFrag += r.fragmentsCollected;
}
console.log(`casual softlock: ${casWins}/100 victories within 5000, deaths total ${casDeathsTot}, max actions ${casActMax}, frags avg ${(casFrag/100).toFixed(2)}`);
