// D1 layout invariants, run over the display list recovered by d1-recorder.js.
//
//   1. No two text draws in the same frame collide.
//   2. Every text draw that sits on a card stays inside it, with padding.
//
// Two modes, because a static state and a played sequence fail differently:
//   node verify/d1-layout.mjs dist/index.html demo:fragment [out.png]
//   node verify/d1-layout.mjs dist/index.html play:ArrowRight*5,ArrowDown [out.png]
import { chromium } from "/Users/tomriddle1/node_modules/playwright-core/index.mjs";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [html, mode, outPng] = process.argv.slice(2);
const RECORDER = readFileSync(new URL("./d1-recorder.js", import.meta.url), "utf8");
const PAD = 6; // minimum breathing room between text and the edge of its card
const SHELL =
  process.env.CHROME_SHELL ??
  "/Users/tomriddle1/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell";

const browser = await chromium.launch({ headless: true, executablePath: SHELL });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(RECORDER);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// mode is either "play:<keys>" from the title screen, or
// "demo:<state>" optionally followed by "|<keys>" to play on from that state
const [modeHead, modeKeys] = mode.split("|");
const isPlay = modeHead.startsWith("play:") || !!modeKeys;
const keySpec = modeHead.startsWith("play:") ? modeHead.slice(5) : (modeKeys ?? "");
const url = pathToFileURL(html).href + (modeHead.startsWith("play:") ? "" : `?demo=${modeHead.replace(/^demo:/, "")}`);
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(600);

if (isPlay) {
  // real KeyboardEvents through the real handlers, 40ms taps so auto-repeat
  // cannot overshoot (a probe that overshoots proves nothing)
  const keys = keySpec
    .split(",")
    .flatMap((tok) => {
      const [k, n] = tok.split("*");
      return Array.from({ length: Number(n ?? 1) }, () => k);
    });
  for (const k of keys) {
    await page.keyboard.down(k);
    await page.waitForTimeout(40);
    await page.keyboard.up(k);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(900);
} else {
  await page.waitForTimeout(700);
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
const findings = [];

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
      findings.push(
        `TEXT COLLISION: "${a.text.slice(0, 44)}" over "${b.text.slice(0, 44)}" by ${Math.round(o.w)}x${Math.round(o.h)}px`,
      );
    }
  }

  // ---- invariant 2: text stays inside the card it is drawn on ----
  const panels = frame
    .filter((d) => (d.kind === "shape" || d.kind === "outline") && area(d.box) > 12000 && area(d.box) < canvasArea * 0.6)
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
      findings.push(
        `TEXT CLIPPED: "${t.text.slice(0, 44)}" sits ${worst.toFixed(1)}px from its card's ${side} edge (needs ${PAD})`,
      );
    }
  }
}

const uniq = [...new Set(findings)];
console.log(`D1 LAYOUT  ${mode}  ${byFrame.size} frames, ${draws.length} draw ops`);
for (const e of errors) console.log(`PAGE ERROR  ${e}`);
for (const f of uniq) console.log(`FINDING  ${f}`);
console.log(uniq.length ? `D1: ${uniq.length} finding(s)` : "D1: layout clean");
process.exit(uniq.length ? 1 : 0);
