import { classifyLogLine } from "./events";
import { Sound } from "./audio";
import { createWorld, combatPass, enemySlot, interact, playerAct, step, type Dir, type WorldState } from "./world";
import { ABILITY_ORDER, render, type UIState } from "./render";
import type { PartKey } from "./game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = 1280;
canvas.height = 720;
const ctx = canvas.getContext("2d")!;

const sound = new Sound();
let world: WorldState = createWorld((Math.random() * 1e9) | 0);
let logCursor = 0;
let lastDeaths = 0;

const ui: UIState = {
  screen: "title",
  time: 0,
  animX: world.pos.x,
  animY: world.pos.y,
  muted: false,
  selectedPart: undefined,
  deathFlash: 0,
  lastLines: [],
  shake: 0,
  enemyFlash: 0,
  zoomPulse: 0,
  enemyBeat: 0,
  floaters: [],
};

function resetRun(): void {
  world = createWorld((Math.random() * 1e9) | 0);
  logCursor = 0;
  lastDeaths = 0;
  ui.animX = world.pos.x;
  ui.animY = world.pos.y;
  ui.selectedPart = undefined;
  ui.screen = "play";
}

// Drain new sim log lines: drive audio and the on-screen ticker from the
// same classifier G7's tests verify.
function drainLog(): void {
  while (logCursor < world.log.length) {
    const line = world.log[logCursor++];
    ui.lastLines.push(line);
    if (ui.lastLines.length > 6) ui.lastLines.shift();
    const ev = classifyLogLine(line);
    if (ev) sound.play(ev);

    // juice: floaters, shake, hit flash, parsed from the same lines
    const enemyHit = line.match(/hits (?:the \w+: |for )?(\d+)/);
    if (line.includes("enemy hits for")) {
      ui.shake = 0.5;
      ui.floaters.push({ text: `-${line.match(/for (\d+)/)?.[1] ?? ""}`, color: "#FF6B5D", age: 0, side: "player" });
    } else if (enemyHit && !line.startsWith("enemy")) {
      ui.enemyFlash = 0.3;
      ui.floaters.push({ text: `-${enemyHit[1]}`, color: "#D8E9EE", age: 0, side: "enemy" });
    }
    if (line.includes("+2 STA") || line.includes("disable landed")) {
      ui.floaters.push({ text: "+2 STA", color: "#7FE8A9", age: 0, side: "player" });
    }
    if (line.includes("BREAKS")) {
      ui.shake = 0.8;
      ui.zoomPulse = 0.9;
    }
    if (line.startsWith("combat:")) {
      ui.zoomPulse = 1.0;
    }
    if (line.includes("missed")) {
      ui.floaters.push({ text: "miss", color: "#7FA0AC", age: 0, side: "enemy" });
    }
    if (line.includes("Heal Song: +")) {
      ui.floaters.push({ text: "+40", color: "#7FE8A9", age: 0, side: "player" });
    }
  }
  if (world.deaths > lastDeaths) {
    lastDeaths = world.deaths;
    ui.deathFlash = 1.6;
  }
}

function cyclePart(dirn: 1 | -1): void {
  const parts = world.combat?.boss?.parts.filter((p) => !p.broken) ?? [];
  if (parts.length === 0) return;
  const keys = parts.map((p) => p.key);
  const idx = ui.selectedPart ? keys.indexOf(ui.selectedPart) : -1;
  ui.selectedPart = keys[(idx + dirn + keys.length) % keys.length];
}

const MOVE_KEYS: Record<string, Dir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
};
const EXPLORE_VERTICAL: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down" };

let lastMoveAt = 0;
const heldDirs = new Set<Dir>();

function onKey(e: KeyboardEvent): void {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (ui.screen === "title") {
    sound.unlock();
    ui.screen = "play";
    return;
  }
  if (k === "m") {
    ui.muted = sound.toggleMute();
    return;
  }
  if (k === "p") {
    if (ui.screen === "play") ui.screen = "pause";
    else if (ui.screen === "pause") ui.screen = "play";
    return;
  }
  if (ui.screen === "pause") return;
  if (world.mode === "victory") {
    if (k === "r") resetRun();
    return;
  }
  if (world.mode === "combat") {
    if (k in MOVE_KEYS || k in EXPLORE_VERTICAL) {
      if (k === "ArrowUp" || k === "w") cyclePart(-1);
      if (k === "ArrowDown" || k === "s") cyclePart(1);
      return;
    }
    // input locks while the sea answers: the exchange must be watchable
    if (ui.enemyBeat > 0) return;
    const slot = Number.parseInt(k, 10);
    if (slot >= 1 && slot <= ABILITY_ORDER.length) {
      if (playerAct(world, ABILITY_ORDER[slot - 1], ui.selectedPart as PartKey | undefined)) {
        if (world.mode === "combat") ui.enemyBeat = 0.55;
        else ui.selectedPart = undefined;
      }
    }
    if (k === " " && world.mode === "combat") ui.enemyBeat = 0.3;
    return;
  }
  // explore
  const dir = MOVE_KEYS[k] ?? EXPLORE_VERTICAL[k];
  if (dir) heldDirs.add(dir);
  if (k === "e") interact(world);
}

function onKeyUp(e: KeyboardEvent): void {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const dir = MOVE_KEYS[k] ?? EXPLORE_VERTICAL[k];
  if (dir) heldDirs.delete(dir);
}

window.addEventListener("keydown", onKey);
window.addEventListener("keyup", onKeyUp);
canvas.addEventListener("pointerdown", () => {
  if (ui.screen === "title") {
    sound.unlock();
    ui.screen = "play";
  }
});
window.addEventListener("blur", () => {
  if (ui.screen === "play") ui.screen = "pause";
});

// ?demo=<state> jumps to a state for screenshots and reviews (TRUNK! recipe).
const demo = new URLSearchParams(location.search).get("demo");
if (demo) {
  world = createWorld(7);
  ui.screen = "play";
  if (demo === "combat") {
    world.area = "dungeon1";
    world.pos = { x: 7, y: 4 };
    world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
    step(world, "right");
    if (world.combat) {
      combatAction(world, "siltBurst");
    }
  } else if (demo === "boss") {
    world.area = "dungeon1";
    for (const e of world.encounters) if (e.kind === "squid") e.defeated = true;
    world.pos = { x: 20, y: 4 };
    world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
    step(world, "right");
    if (world.combat) {
      combatAction(world, "analyze");
      combatAction(world, "finSlash");
      ui.selectedPart = "jaw";
    }
  } else if (demo === "boss2") {
    world.hasTideRelic = true;
    world.area = "dungeon2";
    for (const e of world.encounters) if (e.kind !== "boss2") e.defeated = true;
    world.pos = { x: 20, y: 4 };
    world.checkpoint = { area: "dungeon2", pos: { x: 1, y: 4 } };
    step(world, "right");
    if (world.combat) {
      combatAction(world, "analyze");
      ui.selectedPart = world.combat.boss?.keyPartByPhase[1];
    }
  } else if (demo === "victory") {
    world.hasTideRelic = true;
    for (const f of world.fragments) if (f.id <= 4) f.collected = true;
    world.steps = 340;
    world.area = "dungeon2";
    for (const e of world.encounters) if (e.kind !== "boss2") e.defeated = true;
    world.pos = { x: 20, y: 4 };
    world.checkpoint = { area: "dungeon2", pos: { x: 1, y: 4 } };
    step(world, "right");
    let guard = 0;
    while (world.mode === "combat" && world.combat && guard++ < 300) {
      world.combat.player.sta = world.combat.player.maxSta;
      world.combat.player.hp = world.combat.player.maxHp;
      combatAction(world, "tailStrike");
    }
  } else if (demo === "dungeon1") {
    world.area = "dungeon1";
    world.pos = { x: 4, y: 4 };
    world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
  } else if (demo === "talk") {
    world.pos = { x: 5, y: 4 };
    interact(world);
  } else if (demo === "pause") {
    ui.screen = "pause";
  } else if (demo === "defeat") {
    ui.deathFlash = 1.1;
  } else if (demo === "dungeon2") {
    world.hasTideRelic = true;
    world.area = "dungeon2";
    world.pos = { x: 4, y: 4 };
    world.checkpoint = { area: "dungeon2", pos: { x: 1, y: 4 } };
  } else if (demo === "trench") {
    world.pos = { x: 13, y: 6 };
    step(world, "down");
  }
  ui.animX = world.pos.x;
  ui.animY = world.pos.y;
  logCursor = world.log.length;
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Any runtime error paints the canvas so headless screenshots can never
// silently show an empty page (a blank shot once hid a thrown exception
// behind a first-paint race).
window.addEventListener("error", (e) => {
  ctx.fillStyle = "#3a0f14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FFD9D9";
  ctx.font = "16px ui-monospace, monospace";
  ctx.fillText("RUNTIME ERROR:", 40, 60);
  String(e.message)
    .match(/.{1,110}/g)
    ?.forEach((chunk, i) => ctx.fillText(chunk, 40, 90 + i * 22));
  ctx.fillText(`${e.filename ?? ""}:${e.lineno ?? ""}`, 40, 200);
});

let last = performance.now();
let virtualClock = false; // filmstrip mode: no self-rescheduling
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  ui.time += reducedMotion ? dt * 0.25 : dt;
  if (ui.deathFlash > 0) ui.deathFlash = Math.max(0, ui.deathFlash - dt * 0.7);
  if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt * (reducedMotion ? 8 : 2.2));
  if (ui.zoomPulse > 0) ui.zoomPulse = Math.max(0, ui.zoomPulse - dt * (reducedMotion ? 10 : 1.8));
  if (ui.enemyBeat > 0) {
    ui.enemyBeat = Math.max(0, ui.enemyBeat - dt * (reducedMotion ? 3 : 1));
    if (ui.enemyBeat === 0 && world.mode === "combat") {
      enemySlot(world);
      if (world.mode !== "combat") ui.selectedPart = undefined;
    }
  }
  if (ui.enemyFlash > 0) ui.enemyFlash = Math.max(0, ui.enemyFlash - dt * 2.5);
  for (const f of ui.floaters) f.age += dt;
  ui.floaters = ui.floaters.filter((f) => f.age < 1.3);

  if (ui.screen === "play" && world.mode === "explore" && heldDirs.size > 0 && now - lastMoveAt > 130) {
    lastMoveAt = now;
    const dir = [...heldDirs][heldDirs.size - 1];
    step(world, dir);
  }

  // No auto-selected boss part: unaimed hits drift to a random part in the
  // sim, so choosing a target (and Analyze) stays a real decision.
  if (ui.selectedPart && world.combat?.boss?.parts.find((p) => p.key === ui.selectedPart)?.broken) {
    ui.selectedPart = undefined;
  }

  drainLog();
  ui.animX += (world.pos.x - ui.animX) * Math.min(1, dt * 9);
  ui.animY += (world.pos.y - ui.animY) * Math.min(1, dt * 9);

  render(ctx, world, ui);
  if (!virtualClock) requestAnimationFrame(frame);
}
// ?filmstrip=combat: played-game verification (user-found gap: every shot
// was a static state; nobody had pressed a key). Dispatches REAL
// KeyboardEvents through the REAL handlers and steps the REAL frame
// function on a virtual clock, snapshotting the canvas at beats and
// composing the strip synchronously so a load-time screenshot captures
// proof that the exchange is visible and sequential, not instant.
const filmstrip = new URLSearchParams(location.search).get("filmstrip");
if (filmstrip === "combat") {
  virtualClock = true;
  last = 0;
  world = createWorld(7);
  ui.screen = "play";
  world.area = "dungeon1";
  world.pos = { x: 7, y: 4 };
  world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
  step(world, "right"); // trigger the squid: real encounter path
  ui.animX = world.pos.x;
  ui.animY = world.pos.y;
  logCursor = world.log.length;

  const snaps: { label: string; img: HTMLCanvasElement }[] = [];
  const snap = (label: string) => {
    const c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    c.getContext("2d")!.drawImage(canvas, 0, 0);
    const hp = world.combat ? `you ${world.combat.player.hp} · squid ${world.combat.enemy.hp}` : "";
    snaps.push({ label: `${label}  [${hp}]`, img: c });
  };
  const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key }));

  // step the virtual clock in <=100ms increments (frame clamps dt at 0.1s)
  let vt = 0;
  const advanceTo = (target: number) => {
    while (vt < target) {
      vt = Math.min(target, vt + 80);
      frame(vt);
    }
  };
  frame(0);
  snap("t=0 your move: nothing has happened");
  press("2"); // Silt Burst through the real handler
  advanceTo(16);
  snap("t=16ms you act: squid hit + blinded, sea has NOT answered");
  advanceTo(320);
  snap("t=320ms the sea answers pending: still no counterattack");
  advanceTo(920);
  snap("t=920ms the sea answered: counterattack landed, your move again");

  // compose 2x2 strip
  ctx.fillStyle = "#06121C";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  snaps.forEach((sn, i) => {
    const x = (i % 2) * (canvas.width / 2);
    const y = Math.floor(i / 2) * (canvas.height / 2);
    ctx.drawImage(sn.img, x, y, canvas.width / 2, canvas.height / 2);
    ctx.strokeStyle = "#35C8D6";
    ctx.strokeRect(x + 1, y + 1, canvas.width / 2 - 2, canvas.height / 2 - 2);
    ctx.fillStyle = "#0B1D2A";
    ctx.fillRect(x + 4, y + 4, 640, 24);
    ctx.fillStyle = "#D8E9EE";
    ctx.font = "600 13px ui-monospace, monospace";
    ctx.fillText(sn.label, x + 10, y + 21);
  });
} else {
  // Synchronous first paint: headless screenshots capture on page load, which
  // can precede the first rAF tick (the cause of intermittently blank shots).
  render(ctx, world, ui);
  requestAnimationFrame(frame);
}
