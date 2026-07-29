import { casualBot, optimalBot, spamBot, runBatch, ABILITY_KEYS, NO_CONDITION_KEYS } from "../test/bots";
const f = (s: any) => `win ${(s.winRate*100).toFixed(1)}% turns ${s.meanTurns.toFixed(1)} hpLost ${s.meanHpLost.toFixed(1)}`;
console.log("casual  :", f(runBatch((seed) => casualBot(seed))));
console.log("optimal :", f(runBatch(() => optimalBot())));
console.log("no-cond :", f(runBatch(() => optimalBot(NO_CONDITION_KEYS))));
console.log("no-blind:", f(runBatch(() => optimalBot(ABILITY_KEYS.filter(k => k !== "siltBurst")))));
console.log("no-slow :", f(runBatch(() => optimalBot(ABILITY_KEYS.filter(k => k !== "finSlash")))));
for (const k of ABILITY_KEYS) console.log(`spam ${k.padEnd(10)}:`, f(runBatch(() => spamBot(k))));
