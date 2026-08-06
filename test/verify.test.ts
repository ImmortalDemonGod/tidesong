// Wires verify/ into the suite. Before this file the detectors existed,
// were proven once in verify/PROOF.md, and were then invoked by nothing:
// no test, no build step, no hook. An unrun detector cannot block anything
// and rots silently against the sim, which is precisely how test/bots.ts
// drifted into measuring a different game.
//
// SEED THRESHOLDS ARE LOAD BEARING, measured not guessed:
//   d3-hint   below 150 seeds the eel verdict is noise. At 60 it reports
//             blind winning by 3.3; from 150 up it is slow by 6 to 7,
//             stable through 2400. Running this detector cheap would have
//             produced a confident false finding.
//   d3-taught below 400 seeds the elder drops out of the finding set
//             (its margin is 63.3 vs 61.7). The set is {squid, elder, eel}
//             from 400 through 1600.
//
// Full-scale runs belong in the nightly bucket (see verify/PROOF.md).

import { expect, test } from "bun:test";

const BUN = process.execPath;

function run(script: string, args: string[] = []) {
  const p = Bun.spawnSync([BUN, `verify/${script}`, ...args], { cwd: import.meta.dir + "/.." });
  const out = new TextDecoder().decode(p.stdout) + new TextDecoder().decode(p.stderr);
  const findings = out
    .split("\n")
    .filter((l) => l.startsWith("FINDING"))
    .map((l) => l.replace(/^FINDING\s+/, ""));
  return { code: p.exitCode, out, findings };
}

test("D3a: no ability sits at 0 percent of optimal play", () => {
  const r = run("d3-usage.ts", ["300"]);
  expect(r.findings).toEqual([]);
  expect(r.code).toBe(0);
});

test("D3b: Analyze never lies about the best disable", () => {
  const r = run("d3-hint.ts", ["300"]);
  expect(r.findings).toEqual([]);
  expect(r.code).toBe(0);
});

test("D7: the judges play the game the player plays", () => {
  const r = run("d7-differential.ts");
  expect(r.findings).toEqual([]);
  expect(r.code).toBe(0);
});

// This one is EXPECTED to fail, and the failure is pinned.
//
// The taught line losing to naive play is measured, logged in BACKLOG.md,
// and is a decision for the team rather than a bug to quietly retune. The
// baseline exists so the finding cannot be forgotten and cannot silently
// grow. If this test breaks, do not edit the array to make it pass: either
// the balance changed (update it deliberately, with a note) or something
// regressed (fix that instead).
const TAUGHT_LINE_KNOWN_OPEN = ["squid", "elder", "eel"];

test("D3c: the taught line's known losses are exactly the logged ones", () => {
  const r = run("d3-taught.ts", ["400"]);
  const enemies = r.findings
    .map((f) => f.match(/TEACHING LOSES on (\w+)/)?.[1])
    .filter(Boolean)
    .sort();
  expect(enemies).toEqual([...TAUGHT_LINE_KNOWN_OPEN].sort());
});
