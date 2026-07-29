import { createWorld } from "../src/world";
import { runWorld } from "../test/nav";
import { optimalBot } from "../test/bots";
const w = createWorld(15);
runWorld(w, () => optimalBot(undefined, 55), 5000);
const deaths = w.log.filter((l) => l.startsWith("death")).length;
console.log("seed 15 deaths:", deaths);
const idx = w.log.findIndex((l) => l.startsWith("death"));
if (idx >= 0) console.log(w.log.slice(Math.max(0, idx - 10), idx + 1).join("\n"));
