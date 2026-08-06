// D1 layout invariants, run over the display list recovered by d1-recorder.js.
//
//   1. No two text draws in the same frame collide.
//   2. Every text draw that sits on a card stays inside it, with padding.
//
// Usage:
//   node verify/d1-layout.mjs <html> demo:<state>            static state
//   node verify/d1-layout.mjs <html> play:<keys>             played from the title
//   node verify/d1-layout.mjs <html> demo:<state>|<keys>     play on from a state
//   keys are comma separated and "Key*N" repeats:
//   play:Space,ArrowRight*5,ArrowDown   or   demo:boss|4,1,1,3,1,1
//   an optional third argument writes a screenshot.
//
// Determinism: the page runs on Playwright's FAKE CLOCK, so frame sampling
// does not depend on wall time. An earlier version slept with
// waitForTimeout and returned a different finding COUNT on identical input
// (8, then 7), which broke this project's own rule that instrument labels
// must measure rather than assert. Output is now unique SIGNATURES with the
// worst measured value per signature, plus the observed frame count.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { join } from "node:path";

const [html, mode, outPng] = process.argv.slice(2);
const RECORDER = readFileSync(new URL("./d1-recorder.js", import.meta.url), "utf8");
const PAD = 6; // minimum breathing room between text and the edge of its card

// ---- portable resolution: no absolute paths, no pinned browser build ----
async function loadChromium() {
  for (const spec of [process.env.PLAYWRIGHT_CORE, "playwright-core"].filter(Boolean)) {
    try {
      return (await import(spec)).chromium;
    } catch {}
  }
  throw new Error("playwright-core not resolvable. Set PLAYWRIGHT_CORE to its entry point.");
}

function findShell() {
  if (process.env.CHROME_SHELL) return process.env.CHROME_SHELL;
  const roots = [
    join(homedir(), "Library/Caches/ms-playwright"), // macOS
    join(homedir(), ".cache/ms-playwright"), // Linux
  ].filter(existsSync);
  for (const root of roots) {
    // newest install wins; never pin a build number
    const dirs = readdirSync(root)
      .filter((d) => d.startsWith("chromium_headless_shell-"))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const d of dirs) {
      for (const rel of [
        "chrome-headless-shell-mac-arm64/chrome-headless-shell",
        "chrome-headless-shell-mac-x64/chrome-headless-shell",
        "chrome-headless-shell-linux/chrome-headless-shell",
      ]) {
        const p = join(root, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined; // fall back to playwright's own default
}

const chromium = await loadChromium();
const executablePath = findShell();
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.clock.install({ time: 0 }); // fake clock BEFORE any page code
await page.addInitScript(RECORDER);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const [modeHead, modeKeys] = mode.split("|");
const isPlay = modeHead.startsWith("play:") || !!modeKeys;
const keySpec = modeHead.startsWith("play:") ? modeHead.slice(5) : (modeKeys ?? "");
const url =
  pathToFileURL(html).href + (modeHead.startsWith("play:") ? "" : `?demo=${modeHead.replace(/^demo:/, "")}`);
await page.goto(url, { waitUntil: "load" });
await page.clock.runFor(600);

if (isPlay) {
  // real KeyboardEvents through the real handlers, advanced on the fake
  // clock so the frame sequence is identical on every run
  const keys = keySpec.split(",").flatMap((tok) => {
    const [k, n] = tok.split("*");
    return Array.from({ length: Number(n ?? 1) }, () => k);
  });
  for (const k of keys) {
    await page.keyboard.down(k);
    await page.clock.runFor(40); // short tap: auto-repeat can never overshoot
    await page.keyboard.up(k);
    await page.clock.runFor(120);
  }
  await page.clock.runFor(900);
} else {
  await page.clock.runFor(700);
}
if (outPng) await page.screenshot({ path: outPng });
const draws = await page.evaluate(() => window.__REC.draws);
await browser.close();

const inter = (a, b) => ({
  w: Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
  h: Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0),
});
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const canvasArea = 1280 * 720;

// signature -> worst measured value, so a finding's identity is stable even
// when the number of frames it appears in is not
const found = new Map();
const note = (sig, measured, worse) => {
  const prev = found.get(sig);
  if (!prev || worse(measured, prev.measured)) found.set(sig, { measured });
};

const byFrame = new Map();
for (const d of draws) {
  if (!byFrame.has(d.frame)) byFrame.set(d.frame, []);
  byFrame.get(d.frame).push(d);
}

for (const frame of byFrame.values()) {
  const texts = frame.filter(
    (d) => d.kind === "text" && d.text.trim().length > 1 && d.size >= 9 && d.alpha > 0.35,
  );

  // ---- invariant 1: text does not collide with text ----
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.text === b.text) continue; // the same string twice is a shadow or outline pass
      const o = inter(a.box, b.box);
      if (o.w <= 0 || o.h <= 0) continue;
      const minH = Math.min(a.box.y1 - a.box.y0, b.box.y1 - b.box.y0);
      const minW = Math.min(a.box.x1 - a.box.x0, b.box.x1 - b.box.x0);
      if (o.h < minH * 0.35 || o.w < minW * 0.2) continue; // descender slop, not a collision
      note(
        `TEXT COLLISION: "${a.text.slice(0, 44)}" over "${b.text.slice(0, 44)}"`,
        Math.round(o.w) * Math.round(o.h),
        (m, p) => m > p,
      );
    }
  }

  // ---- invariant 2: text stays inside the card it is drawn on ----
  const panels = frame
    .filter(
      (d) =>
        (d.kind === "shape" || d.kind === "outline") &&
        area(d.box) > 12000 &&
        area(d.box) < canvasArea * 0.6,
    )
    .filter((d) => d.box.x1 - d.box.x0 > 120 && d.box.y1 - d.box.y0 > 28)
    .filter((d) => d.alpha > 0.5);
  for (const t of texts) {
    const cx = (t.box.x0 + t.box.x1) / 2, cy = (t.box.y0 + t.box.y1) / 2;
    // A card is drawn as: panel, then the text that lives on it, contiguously.
    // Proximity in the op stream separates "text on a card" from "a world
    // label floating over a light shaft"; without it this invariant produced
    // 2 false positives out of 3 findings when first run.
    const owner = panels
      .filter((p) => p.i < t.i && t.i - p.i <= 4)
      .filter((p) => cx > p.box.x0 && cx < p.box.x1 && cy > p.box.y0 && cy < p.box.y1)
      .sort((a, b) => b.i - a.i)[0];
    if (!owner) continue;
    const gap = {
      l: t.box.x0 - owner.box.x0, r: owner.box.x1 - t.box.x1,
      t: t.box.y0 - owner.box.y0, b: owner.box.y1 - t.box.y1,
    };
    const worst = Math.min(gap.l, gap.r, gap.t, gap.b);
    if (worst < PAD) {
      const side = worst === gap.b ? "bottom" : worst === gap.t ? "top" : worst === gap.l ? "left" : "right";
      note(
        `TEXT CLIPPED: "${t.text.slice(0, 44)}" against its card's ${side} edge (needs ${PAD})`,
        worst,
        (m, p) => m < p,
      );
    }
  }
}

const sigs = [...found.entries()].sort(([a], [b]) => a.localeCompare(b));
console.log(`D1 LAYOUT  ${mode}  ${byFrame.size} frames observed, ${draws.length} draw ops`);
for (const e of errors) console.log(`PAGE ERROR  ${e}`);
for (const [sig, { measured }] of sigs) console.log(`FINDING  ${sig}  [measured worst: ${measured}]`);
console.log(sigs.length ? `D1: ${sigs.length} signature(s)` : "D1: layout clean");
process.exit(sigs.length ? 1 : 0);
