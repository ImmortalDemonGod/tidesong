import { createWorld } from "../src/world";
import { runWorld } from "../test/nav";
import { optimalBot } from "../test/bots";
for (let seed = 0; seed < 50; seed++) {
  const w = createWorld(seed);
  const r = runWorld(w, () => optimalBot(), 5000);
  if (r.deaths > 0) {
    console.log(`seed ${seed}: deaths ${r.deaths}, victory ${r.victory}`);
    const w2 = createWorld(seed);
    const r2 = runWorld(w2, () => optimalBot(), 5000);
    const deathIdx = w2.log.findIndex((l) => l.startsWith("death"));
    console.log(w2.log.slice(Math.max(0, deathIdx - 12), deathIdx + 2).join("\n"));
    void r2;
  }
}
