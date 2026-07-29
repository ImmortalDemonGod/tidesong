// Rendering reads state; it never owns it. 2.5D per DESIGN.md: parallax
// layers, underwater aerial perspective (far = bluer, dimmer), scale-by-depth
// combat staging, all presentation-only. Palette follows the greybox sketch.

import { ABILITIES, BASE, CONDITION_INFO, enemyIntent, getCondition, type CombatState, type PartKey } from "./game";
import { AREAS, D1, HUB, nextObjective, optionalHere, type WorldState } from "./world";

export interface Floater {
  text: string;
  color: string;
  age: number; // seconds since spawn
  side: "player" | "enemy";
  lane?: number; // same-drain spawn index: separates chorded floats
}

export interface UIState {
  screen: "title" | "play" | "pause" | "victory";
  time: number;
  animX: number;
  animY: number;
  muted: boolean;
  selectedPart?: PartKey;
  deathFlash: number; // seconds remaining on the death overlay
  lastLines: string[];
  shake: number; // seconds remaining on screen shake
  enemyFlash: number; // seconds remaining on enemy hit flash
  zoomPulse: number; // seconds remaining on the combat-entry/phase zoom
  enemyBeat: number; // seconds until the enemy's answering beat lands
  storyCard?: { text: string; age: number; kind: "story" | "song" | "npc" | "relic" | "heal"; ph?: boolean }; // explore cards; ph = placeholder text for Marc
  victoryHold?: { combat: CombatState; t: number }; // hold the win beat on screen
  floaters: Floater[];
  // fun pass: per-ability cast effects and bodies that move (diagnosis:
  // "neither combatant ever moves; every ability is the same white flash")
  castFx: { kind: string; age: number }[];
  attackAnim?: { kind: string; t: number }; // player lunge, counts down from 0.3
  enemyStrike: number; // enemy lunge snap when its beat resolves
  playerFlinch: number; // player recoil + red tint on taking a hit
  buttonFlash: number[]; // pressed flash per ability card
  hitStop: number; // brief presentation freeze on impact
  reducedMotion: boolean; // positional offsets collapse to flashes
  facing: 1 | -1; // the fish turns to swim: -1 when heading west
  bossIntro?: { title: string; sub: string; t: number; dur: number }; // set-piece title card
  beatPulse: number; // refused-input acknowledgment on the turn pill
}

export const ABILITY_ORDER = ["tailStrike", "siltBurst", "finSlash", "healSong", "analyze", "bubble"];

// One cast beat: long enough to read as a move, short enough to stay
// inside the 550ms answer beat (played report: the casts were a blip).
export const CAST_TIME = 0.42;

// One line per ability, in the player's words, printed on the card.
const ABILITY_EFFECT: Record<string, string> = {
  tailStrike: "reliable damage",
  siltBurst: "blind: it starts missing",
  finSlash: "slow: it skips turns",
  healSong: "mend your own wounds",
  analyze: "name its weakness",
  bubble: "soften the next hit",
};

// Per-ability identity: an accent color and a small painted glyph, matched
// by the cast effect and the synth voice so each ability reads as itself in
// the menu, in motion, and in sound (fun diagnosis, all three agents HIGH).
export const ABILITY_META: Record<string, { accent: string; glyph: (ctx: CanvasRenderingContext2D, x: number, y: number) => void }> = {
  tailStrike: {
    accent: "#D8E9EE",
    glyph: (ctx, x, y) => {
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 8 + i * 7, y + 7);
        ctx.lineTo(x + 2 + i * 7, y - 7);
        ctx.stroke();
      }
    },
  },
  siltBurst: {
    accent: "#E8C98A",
    glyph: (ctx, x, y) => {
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(i * 2.4) * (4 + i * 1.3), y + Math.sin(i * 2.4) * (3 + i), 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  finSlash: {
    accent: "#35C8D6",
    glyph: (ctx, x, y) => {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y + 4, 12, Math.PI * 1.15, Math.PI * 1.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + 8, 12, Math.PI * 1.2, Math.PI * 1.85);
      ctx.stroke();
    },
  },
  healSong: {
    accent: "#7FE8A9",
    glyph: (ctx, x, y) => {
      ctx.beginPath();
      ctx.ellipse(x - 4, y + 6, 4, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x, y - 8);
      ctx.lineTo(x + 7, y - 10);
      ctx.stroke();
    },
  },
  analyze: {
    accent: "#B99CFF",
    glyph: (ctx, x, y) => {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 11, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  bubble: {
    accent: "#7FB8E8",
    glyph: (ctx, x, y) => {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 3, y - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

const C = {
  deep: "#06121C",
  mid: "#0E3450",
  panel: "#0B1D2A",
  line: "#1B3A50",
  ink: "#D8E9EE",
  muted: "#7FA0AC",
  glow: "#35C8D6",
  biolum: "#7FE8A9",
  coral: "#FF8A5C",
  danger: "#FF6B5D",
  sand: "#E8C98A",
};

const TILE = 46;

function water(ctx: CanvasRenderingContext2D, w: number, h: number, topShade: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, topShade);
  g.addColorStop(1, C.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function lightRays(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#7FE8D9";
  for (let i = 0; i < 3; i++) {
    const x = ((i * 400 + t * 6) % (w + 300)) - 150;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 90, 0);
    ctx.lineTo(x - 60, h);
    ctx.lineTo(x - 150, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function particles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, depth: number): void {
  ctx.save();
  ctx.fillStyle = C.muted;
  for (let i = 0; i < 24; i++) {
    const speed = 4 + depth * 7;
    const x = (i * 173 + t * speed) % w;
    const y = (i * 97 + Math.sin(t * 0.6 + i) * 8 + t * 2 * depth) % h;
    ctx.globalAlpha = 0.05 + depth * 0.08;
    ctx.fillRect(x, (y + h) % h, 2 + depth, 2 + depth);
  }
  ctx.restore();
}

function fish(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number, facing: number): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2.2) * 3 * scale);
  ctx.scale(facing * scale, scale);
  ctx.fillStyle = C.glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2AA7B4";
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-34 - Math.sin(t * 6) * 4, -10);
  ctx.lineTo(-34 - Math.sin(t * 6) * 4, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.deep;
  ctx.beginPath();
  ctx.arc(10, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function merfolk(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.6) * 4);
  ctx.fillStyle = "#5E7A8C";
  ctx.beginPath();
  ctx.arc(0, -26, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3, -6, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#47616F";
  ctx.beginPath();
  ctx.moveTo(2, 4);
  ctx.quadraticCurveTo(-6, 26, 4, 40);
  ctx.quadraticCurveTo(18, 34, 10, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function squidSprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number, variant: "vampire" | "elder" | "ink" = "vampire"): void {
  const elder = variant === "elder";
  const ink = variant === "ink";
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.8) * 6);
  ctx.scale(scale, scale);
  // elders wear the deep's colors and a crown of spines; ink squids are
  // night-dark with a drifting ink veil (enemy type 2's tell)
  const body = elder ? "#3F6E64" : ink ? "#2A3350" : "#6E4A8C";
  const shade = elder ? "#2E544C" : ink ? "#1C2338" : "#5A3B75";
  if (ink) {
    ctx.fillStyle = "#141A2E";
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(-30 + i * 13, 16 + Math.sin(t * 2 + i) * 8, 8 + (i % 3) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (elder) {
    ctx.fillStyle = shade;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 13 - 5, -42);
      ctx.lineTo(i * 13, -60 - Math.abs(i) * -4);
      ctx.lineTo(i * 13 + 5, -42);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -20, 34, 30, 0, Math.PI, 0);
  ctx.fill();
  // swept side-fins so the silhouette reads squid, not jellyfish
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(-30, -34);
  ctx.quadraticCurveTo(-58, -52, -44, -14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, -34);
  ctx.quadraticCurveTo(58, -52, 44, -14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const sway = Math.sin(t * 2 + i) * 6;
    ctx.beginPath();
    ctx.moveTo(-24 + i * 12, -8);
    ctx.quadraticCurveTo(-24 + i * 12 + sway, 26, -24 + i * 12 - sway, 52);
    ctx.stroke();
  }
  ctx.fillStyle = "#FFD9D9";
  ctx.beginPath();
  ctx.arc(-11, -18, 6, 0, Math.PI * 2);
  ctx.arc(11, -18, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function sharkSprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number, broken: Set<PartKey>): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.4) * 8);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#3D5A73";
  ctx.beginPath();
  ctx.ellipse(0, 0, 150, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  // tail
  ctx.fillStyle = broken.has("tail") ? "#233648" : "#33506A";
  ctx.beginPath();
  ctx.moveTo(142, -8);
  ctx.lineTo(196, -40 + Math.sin(t * 3) * 6);
  ctx.lineTo(186, 6);
  ctx.lineTo(196, 44);
  ctx.lineTo(142, 12);
  ctx.closePath();
  ctx.fill();
  // dorsal fin
  ctx.fillStyle = broken.has("fin") ? "#233648" : "#33506A";
  ctx.beginPath();
  ctx.moveTo(-26, -50);
  ctx.lineTo(6, -92);
  ctx.lineTo(26, -48);
  ctx.closePath();
  ctx.fill();
  // jaw
  ctx.fillStyle = broken.has("jaw") ? "#1C2C3C" : "#2C4763";
  ctx.beginPath();
  ctx.moveTo(-148, 8);
  ctx.quadraticCurveTo(-120, 44, -66, 46);
  ctx.quadraticCurveTo(-100, 56, -132, 46);
  ctx.quadraticCurveTo(-150, 30, -148, 8);
  ctx.closePath();
  ctx.fill();
  if (!broken.has("jaw")) {
    ctx.fillStyle = C.ink;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-128 + i * 16, 30);
      ctx.lineTo(-122 + i * 16, 42);
      ctx.lineTo(-134 + i * 16, 42);
      ctx.closePath();
      ctx.fill();
    }
  }
  // eye
  ctx.fillStyle = broken.has("eye") ? "#44222a" : "#FFD9D9";
  ctx.beginPath();
  ctx.arc(-96, -18, 9, 0, Math.PI * 2);
  ctx.fill();
  if (!broken.has("eye")) {
    ctx.fillStyle = "#7A1F1F";
    ctx.beginPath();
    ctx.arc(-96, -18, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // corruption veins (placeholder mood, palette is not an art pitch)
  ctx.strokeStyle = "#8C4AA8";
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(20, -24);
  ctx.quadraticCurveTo(48, 0, 30, 28);
  ctx.moveTo(70, -18);
  ctx.quadraticCurveTo(92, 8, 78, 30);
  ctx.stroke();
  ctx.restore();
}

function eelSprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number, broken: Set<PartKey>): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.2) * 8);
  ctx.scale(scale, scale);
  // serpentine body: layered segments along a sine
  ctx.strokeStyle = "#4A6455";
  ctx.lineCap = "round";
  ctx.lineWidth = 46;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const px2 = -110 + i * 14;
    const py2 = Math.sin(t * 1.6 + i * 0.55) * 26;
    if (i === 0) ctx.moveTo(px2, py2);
    else ctx.lineTo(px2, py2);
  }
  ctx.stroke();
  // coil highlight (the Coil part is the mid-body knot)
  ctx.strokeStyle = broken.has("fin") ? "#2C3E33" : "#5C7A66";
  ctx.lineWidth = 50;
  ctx.beginPath();
  ctx.arc(30, Math.sin(t * 1.6 + 4.4) * 26, 30, 0.4, 2.4);
  ctx.stroke();
  // head
  ctx.fillStyle = "#4A6455";
  ctx.beginPath();
  ctx.ellipse(-120, Math.sin(t * 1.6) * 10, 42, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  // maw
  ctx.fillStyle = broken.has("jaw") ? "#1C2C24" : "#2E4438";
  ctx.beginPath();
  ctx.moveTo(-158, 6);
  ctx.quadraticCurveTo(-130, 34, -92, 30);
  ctx.quadraticCurveTo(-124, 44, -152, 30);
  ctx.closePath();
  ctx.fill();
  if (!broken.has("jaw")) {
    ctx.fillStyle = C.ink;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-142 + i * 14, 22);
      ctx.lineTo(-136 + i * 14, 32);
      ctx.lineTo(-148 + i * 14, 32);
      ctx.closePath();
      ctx.fill();
    }
  }
  // lure: a dangling light ahead of the head
  ctx.strokeStyle = "#3A5245";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-140, -22);
  ctx.quadraticCurveTo(-170, -52, -150, -66 + Math.sin(t * 3) * 5);
  ctx.stroke();
  ctx.fillStyle = broken.has("eye") ? "#3a4a42" : C.biolum;
  ctx.beginPath();
  ctx.arc(-150, -66 + Math.sin(t * 3) * 5, broken.has("eye") ? 6 : 9, 0, Math.PI * 2);
  ctx.fill();
  // tail fin
  ctx.fillStyle = broken.has("tail") ? "#2C3E33" : "#3A5245";
  ctx.beginPath();
  ctx.moveTo(168, Math.sin(t * 1.6 + 11) * 26);
  ctx.lineTo(206, -30);
  ctx.lineTo(198, 8);
  ctx.lineTo(206, 40);
  ctx.closePath();
  ctx.fill();
  // corruption veins
  ctx.strokeStyle = "#8C4AA8";
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.quadraticCurveTo(12, 4, -2, 24);
  ctx.stroke();
  ctx.restore();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  ctx.fillStyle = "#123044";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fill();
  }
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): number {
  ctx.font = "600 13px ui-monospace, monospace";
  const w = ctx.measureText(text).width + 18;
  ctx.strokeStyle = color;
  ctx.fillStyle = C.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 22, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, x + 9, y + 16);
  return w;
}

// ---------- exploration ----------

function renderExplore(ctx: CanvasRenderingContext2D, w: WorldState, ui: UIState, cw: number, ch: number): void {
  const t = ui.time;
  water(ctx, cw, ch, w.area === "hub" ? C.mid : w.area === "dungeon2" ? "#0B2A26" : "#0B2036");
  lightRays(ctx, cw, ch, t);

  const area = AREAS[w.area];
  const worldW = area.w * TILE;
  const camX = Math.max(0, Math.min(worldW - cw, ui.animX * TILE - cw / 2));
  const groundY = 560;

  // L1 distant ruins (0.35x parallax, heavy fog)
  ctx.save();
  ctx.translate(-camX * 0.35, 0);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#0D2A40";
  for (let i = 0; i < 8; i++) {
    const x = i * 340 + (i % 3) * 60;
    ctx.fillRect(x, 240 + (i % 2) * 50, 52, 320);
    ctx.fillRect(x + 70, 300, 44, 260);
  }
  ctx.restore();
  particles(ctx, cw, ch, t, 0.4);

  // L2 mid reef (0.65x)
  ctx.save();
  ctx.translate(-camX * 0.65, 0);
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#0A2233";
  for (let i = 0; i < 14; i++) {
    const x = i * 210;
    ctx.beginPath();
    ctx.ellipse(x, 600, 130, 70 + (i % 3) * 24, 0, Math.PI, 0);
    ctx.fill();
  }
  // ambient life: small fish silhouettes drifting through the mid layer
  // (fun diagnosis: nothing on screen moved but the player)
  ctx.fillStyle = "#0F3048";
  for (let i = 0; i < 5; i++) {
    const speed = 26 + (i % 3) * 14;
    const range = worldW * 0.65 + 500;
    const drift = ((t * speed + i * 460) % range) - 250;
    const fy = 210 + (i % 4) * 70 + Math.sin(t * 0.9 + i * 2) * 16;
    const flip = i % 2 === 0 ? 1 : -1;
    const fx2 = flip === 1 ? drift : worldW * 0.65 - drift;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(fx2, fy, 14, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx2 - 13 * flip, fy);
    ctx.lineTo(fx2 - 20 * flip, fy - 5);
    ctx.lineTo(fx2 - 20 * flip, fy + 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // L3 play plane
  ctx.save();
  ctx.translate(-camX, 0);
  ctx.fillStyle = "#081B2A";
  ctx.fillRect(-100, groundY, worldW + 200, ch - groundY);

  const px = (tx: number) => tx * TILE + TILE / 2;
  const py = (ty: number) => 200 + ty * TILE;

  if (w.area === "hub") {
    // trench: a dark cut with a warning glow
    const tr = HUB.trench;
    ctx.fillStyle = "#03101A";
    ctx.beginPath();
    ctx.moveTo(px(tr.x0) - 36, ch + 20);
    ctx.quadraticCurveTo(px(tr.x0) + 10, py(tr.y0) - 4, px((tr.x0 + tr.x1) / 2), py(tr.y0) - 10);
    ctx.quadraticCurveTo(px(tr.x1) - 10, py(tr.y0) - 4, px(tr.x1) + 36, ch + 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = "12px system-ui";
    ctx.fillText("the low dark", px(tr.x0) + 10, py(tr.y0) - 20);

    // song-seal door, set into a rock spire so it does not float
    ctx.fillStyle = "#0D2A40";
    ctx.beginPath();
    ctx.moveTo(px(HUB.door.x) - 44, groundY + 30);
    ctx.quadraticCurveTo(px(HUB.door.x) - 52, py(HUB.door.y) - 60, px(HUB.door.x), py(HUB.door.y) - 72);
    ctx.quadraticCurveTo(px(HUB.door.x) + 52, py(HUB.door.y) - 60, px(HUB.door.x) + 44, groundY + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = w.doorOpen ? "#0A2233" : "#12354E";
    ctx.strokeStyle = w.doorOpen ? C.biolum : C.glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(px(HUB.door.x) - 22, py(HUB.door.y) - 34, 44, 70, 8);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(px(HUB.door.x) - 10 + i * 10, py(HUB.door.y) - 12, 4, 0, Math.PI * 2);
      if (w.doorOpen || i < w.attempt.length) {
        ctx.fillStyle = C.biolum;
        ctx.fill();
      } else {
        ctx.strokeStyle = C.muted;
        ctx.stroke();
      }
    }
    ctx.fillStyle = C.muted;
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(w.doorOpen ? "song-seal (open)" : "song-seal (the alcove)", px(HUB.door.x), py(HUB.door.y) + 52);
    ctx.textAlign = "left";

    // dungeon entrance arch on twin pillars rooted in the floor
    ctx.fillStyle = "#0D2A40";
    ctx.fillRect(px(HUB.dungeonEntrance.x) - 34, py(HUB.dungeonEntrance.y) + 20, 14, groundY - py(HUB.dungeonEntrance.y) + 20);
    ctx.fillRect(px(HUB.dungeonEntrance.x) + 20, py(HUB.dungeonEntrance.y) + 20, 14, groundY - py(HUB.dungeonEntrance.y) + 20);
    ctx.strokeStyle = "#1E4560";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(px(HUB.dungeonEntrance.x) - 26, py(HUB.dungeonEntrance.y) + 40);
    ctx.quadraticCurveTo(px(HUB.dungeonEntrance.x), py(HUB.dungeonEntrance.y) - 46, px(HUB.dungeonEntrance.x) + 26, py(HUB.dungeonEntrance.y) + 40);
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.font = "12px system-ui";
    ctx.fillText("first ruin", px(HUB.dungeonEntrance.x) - 22, py(HUB.dungeonEntrance.y) - 60);

    // current barrier
    ctx.strokeStyle = C.glow;
    ctx.lineWidth = 5;
    ctx.globalAlpha = w.hasTideRelic ? 0.25 : 0.8;
    for (let i = 0; i < 3; i++) {
      const bx = px(HUB.barrierX) + i * 14;
      ctx.beginPath();
      for (let yy = 140; yy <= groundY + 20; yy += 8) {
        const wob = Math.sin(t * 3 + yy * 0.05 + i) * 8;
        if (yy === 140) ctx.moveTo(bx + wob, yy);
        else ctx.lineTo(bx + wob, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.font = "600 13px ui-monospace, monospace";
    ctx.fillStyle = C.glow;
    ctx.textAlign = "center";
    ctx.fillText("current wall", px(HUB.barrierX) - 60, 120);
    ctx.font = "12px system-ui";
    ctx.fillStyle = C.muted;
    ctx.fillText(w.hasTideRelic ? "the relic parts it" : "needs the Tide Relic", px(HUB.barrierX) - 60, 138);
    ctx.textAlign = "left";

    // song stones (dusk, dawn, tide)
    for (const st of HUB.stones) {
      ctx.fillStyle = "#1E4560";
      ctx.beginPath();
      ctx.ellipse(px(st.x), py(st.y) + 10, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.biolum;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(px(st.x), py(st.y), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.muted;
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(st.name, px(st.x), py(st.y) + 36);
      ctx.textAlign = "left";
    }

    // the mouth of the second ruin: the slice's second gate gets a landmark
    ctx.fillStyle = "#0D2A40";
    ctx.fillRect(px(HUB.mouth.x) - 30, py(HUB.mouth.y) + 20, 12, groundY - py(HUB.mouth.y) + 20);
    ctx.strokeStyle = w.hasTideRelic ? C.biolum : "#1E4560";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(px(HUB.mouth.x) - 24, py(HUB.mouth.y) + 36);
    ctx.quadraticCurveTo(px(HUB.mouth.x) + 4, py(HUB.mouth.y) - 40, px(HUB.mouth.x) + 30, py(HUB.mouth.y) + 36);
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("second ruin", px(HUB.mouth.x) - 78, py(HUB.mouth.y) - 62);
    ctx.textAlign = "left";

    merfolk(ctx, px(HUB.npc.x), py(HUB.npc.y), t);
    ctx.fillStyle = C.muted;
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("merfolk", px(HUB.npc.x), py(HUB.npc.y) + 58);
    ctx.textAlign = "left";
    if (Math.abs(w.pos.x - HUB.npc.x) + Math.abs(w.pos.y - HUB.npc.y) <= 1) {
      ctx.fillStyle = "rgba(6,18,28,0.9)";
      ctx.beginPath();
      ctx.roundRect(px(HUB.npc.x) - 44, py(HUB.npc.y) - 78, 88, 26, 13);
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Talk [E]", px(HUB.npc.x), py(HUB.npc.y) - 60);
      ctx.textAlign = "left";
    }
  } else if (w.area === "dungeon1") {
    // the first ruin, a drowned choir hall: pillars joined by arches,
    // biolum votives still burning ("beauty with decay" was hub-only:
    // fun diagnosis, agent 3 LOW)
    ctx.fillStyle = "#0D2A40";
    for (let i = 2; i < 24; i += 5) {
      ctx.fillRect(px(i) - 8, 150, 16, 410);
    }
    ctx.strokeStyle = "#12354E";
    ctx.lineWidth = 9;
    for (let i = 2; i < 19; i += 5) {
      ctx.beginPath();
      ctx.moveTo(px(i), 190);
      ctx.quadraticCurveTo(px(i + 2.5), 96, px(i + 5), 190);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const gx = px(2 + ((i * 2.4) % 20));
      ctx.fillStyle = C.biolum;
      ctx.globalAlpha = 0.25 + Math.sin(t * 1.4 + i * 1.9) * 0.15;
      ctx.beginPath();
      ctx.arc(gx + (i % 3) * 9, 240 + (i % 4) * 74, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.muted;
    ctx.font = "12px system-ui";
    ctx.fillText("the first ruin: the choir hall", px(2) - 20, 140);
  } else {
    // the second ruin, the drowned gullet: a ribcage swallows the path
    ctx.strokeStyle = "#1C4A40";
    ctx.lineWidth = 12;
    for (let i = 2; i < 24; i += 4) {
      ctx.beginPath();
      ctx.moveTo(px(i) - 14, 560);
      ctx.quadraticCurveTo(px(i) + 26, 140 + (i % 3) * 24, px(i) + 66, 560);
      ctx.stroke();
    }
    ctx.fillStyle = "#123528";
    for (let i = 3; i < 24; i += 6) {
      ctx.beginPath();
      ctx.ellipse(px(i), 556, 40, 12, 0, Math.PI, 0);
      ctx.fill();
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = C.glow;
      ctx.globalAlpha = 0.18 + Math.sin(t * 1.1 + i * 2.3) * 0.1;
      ctx.beginPath();
      ctx.arc(px(3 + ((i * 2.7) % 19)), 210 + (i % 5) * 66, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.muted;
    ctx.font = "12px system-ui";
    ctx.fillText("the second ruin: the drowned gullet", px(2) - 20, 140);
  }

  // once the ruin is cleared, the current visibly runs west: the way out
  // must be legible from the boss chamber (played report: stuck at the
  // east wall of an emptied dungeon)
  const ruinBoss = w.encounters.find((e) => e.area === w.area && (e.kind === "boss" || e.kind === "boss2"));
  if (w.area !== "hub" && ruinBoss?.defeated) {
    ctx.save();
    ctx.strokeStyle = C.biolum;
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const flow = ((t * 90 + i * 190) % (worldW + 260)) - 130;
      const ay = 250 + (i % 3) * 120;
      ctx.globalAlpha = 0.16 + Math.sin(t * 2 + i) * 0.07;
      ctx.beginPath();
      ctx.moveTo(worldW - flow, ay);
      ctx.lineTo(worldW - flow - 54, ay);
      ctx.moveTo(worldW - flow - 54, ay);
      ctx.lineTo(worldW - flow - 40, ay - 9);
      ctx.moveTo(worldW - flow - 54, ay);
      ctx.lineTo(worldW - flow - 40, ay + 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  // fragments
  for (const f of w.fragments) {
    if (f.collected || f.area !== w.area) continue;
    const sealed = w.area === "hub" && !w.doorOpen && f.x === HUB.alcove.x && f.y === HUB.alcove.y;
    const pulse = 0.6 + Math.sin(t * 3 + f.id) * 0.4;
    ctx.save();
    ctx.translate(px(f.x), py(f.y));
    if (sealed) {
      // the alcove verse is LOCKED until the song opens the seal: it must
      // read locked, not broken (the playtester's trust-breaker: it pulsed
      // exactly like a free pickup)
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = C.muted;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = C.biolum;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.muted;
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("a verse sleeps here: the door wants its song", 0, 34);
      ctx.textAlign = "left";
    } else {
      // a soft glow pulls the eye from a distance (collect ceremony)
      ctx.globalAlpha = 0.16 * pulse;
      ctx.fillStyle = C.sand;
      ctx.beginPath();
      ctx.arc(0, 0, 20 + pulse * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // encounters visible as lurking silhouettes, labeled by kind
  for (const e of w.encounters) {
    if (e.defeated || e.area !== w.area) continue;
    let label = "";
    if (e.kind === "squid") {
      squidSprite(ctx, px(e.x), py(e.y) - 10, 0.5, t + e.id);
      label = "vampire squid";
    } else if (e.kind === "elder") {
      squidSprite(ctx, px(e.x), py(e.y) - 12, 0.62, t + e.id, "elder");
      label = "elder squid";
    } else if (e.kind === "ink") {
      squidSprite(ctx, px(e.x), py(e.y) - 12, 0.58, t + e.id, "ink");
      label = "ink squid";
    } else if (e.kind === "boss") {
      sharkSprite(ctx, px(e.x), py(e.y) - 20, 0.42, t, new Set());
      label = "the corrupted shark";
    } else {
      eelSprite(ctx, px(e.x), py(e.y) - 16, 0.4, t, new Set());
      label = "the corrupted eel";
    }
    ctx.fillStyle = C.muted;
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(label, px(e.x), py(e.y) + 52);
    ctx.textAlign = "left";
  }

  ctx.restore();

  // player drawn in screen space for smooth camera
  const fishX = ui.animX * TILE + TILE / 2 - camX;
  const fishY = 200 + ui.animY * TILE;
  // swimming stirs the water: a small bubble trail while moving
  const swimming = Math.abs(ui.animX - w.pos.x) + Math.abs(ui.animY - w.pos.y) > 0.03;
  if (swimming && !ui.reducedMotion) {
    ctx.save();
    ctx.strokeStyle = "#9CC8D8";
    for (let i = 0; i < 4; i++) {
      const bp = (t * 2 + i * 0.7) % 1;
      ctx.globalAlpha = 0.4 * (1 - bp);
      ctx.beginPath();
      ctx.arc(fishX - ui.facing * (26 + i * 12), fishY - bp * 26 + Math.sin(t * 6 + i) * 3, 2 + (i % 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  fish(ctx, fishX, fishY, 1, t, ui.facing);
  // the low dark bites back: a red pulse from the depths on each chip
  if (ui.playerFlinch > 0) {
    ctx.save();
    const g2 = ctx.createLinearGradient(0, ch - 260, 0, ch);
    g2.addColorStop(0, "rgba(140,30,30,0)");
    g2.addColorStop(1, `rgba(140,30,30,${Math.min(0.5, ui.playerFlinch * 1.4)})`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, ch - 260, cw, 260);
    ctx.restore();
  }

  // L4 foreground fronds (1.4x, dark)
  ctx.save();
  ctx.translate(-camX * 1.4, 0);
  ctx.strokeStyle = "#123528";
  ctx.lineWidth = 10;
  ctx.globalAlpha = 0.55;
  ctx.lineCap = "round";
  for (let i = 0; i < 20; i++) {
    const x = i * 260 + 60;
    ctx.beginPath();
    ctx.moveTo(x, ch + 10);
    ctx.quadraticCurveTo(x + Math.sin(t * 1.3 + i) * 14, ch - 90, x + Math.sin(t * 1.3 + i) * 26, ch - 170);
    ctx.stroke();
  }
  ctx.restore();
  particles(ctx, cw, ch, t, 1.2);

  // trench danger treatment: darkness closes in inside the low dark
  const inLowDark =
    w.area === "hub" &&
    w.pos.x >= HUB.trench.x0 &&
    w.pos.x <= HUB.trench.x1 &&
    w.pos.y >= HUB.trench.y0;
  if (inLowDark) {
    const g = ctx.createRadialGradient(cw / 2, ch / 2, 200, cw / 2, ch / 2, 700);
    g.addColorStop(0, "rgba(2,6,10,0)");
    g.addColorStop(1, "rgba(2,6,10,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = C.danger;
    ctx.font = "600 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("the low dark bites: swim up", cw / 2, 130);
    ctx.textAlign = "left";
  }

  // HUD
  ctx.fillStyle = "rgba(6,18,28,0.85)";
  ctx.beginPath();
  ctx.roundRect(18, 16, 274, 92, 10);
  ctx.fill();
  ctx.fillStyle = C.muted;
  ctx.font = "600 12px ui-monospace, monospace";
  ctx.fillText("HP", 32, 42);
  bar(ctx, 62, 32, 150, 12, w.hp / w.maxHp, C.coral);
  ctx.fillStyle = C.muted;
  ctx.fillText(`${w.hp}/${w.maxHp}`, 220, 42);
  const verses = w.fragments.filter((f) => f.collected).length;
  ctx.fillText("STA", 32, 66);
  bar(ctx, 62, 56, 150, 12, 1, C.glow);
  ctx.fillStyle = C.muted;
  ctx.fillText(`${BASE.playerSta + verses}/${BASE.playerSta + verses}`, 220, 66);
  ctx.fillText("SONG", 32, 90);
  ctx.fillStyle = C.ink;
  ctx.fillText(`${"~".repeat(w.healSongUses) || "-"}`, 76, 90);
  ctx.fillStyle = C.muted;
  ctx.fillText(`verses ${verses}/${w.fragments.length}`, 120, 90);
  if (verses > 0) {
    ctx.fillStyle = C.biolum;
    ctx.fillText(`+${verses} STA`, 214, 90);
  }
  if (w.hasTideRelic) chip(ctx, 304, 24, "TIDE RELIC", C.glow);

  // the standing objective: the player must never wonder where to go
  // (played report: "I defeat the boss but I'm just stuck here")
  const optional = optionalHere(w);
  ctx.fillStyle = "rgba(6,18,28,0.82)";
  ctx.beginPath();
  ctx.roundRect(18, 116, 292, optional ? 48 : 30, 8);
  ctx.fill();
  ctx.fillStyle = C.biolum;
  ctx.font = "600 11px ui-monospace, monospace";
  ctx.fillText("NEXT", 32, 135);
  ctx.fillStyle = C.ink;
  ctx.font = "12px system-ui";
  ctx.fillText(nextObjective(w), 70, 135);
  if (optional) {
    // optional treasure in THIS area, so nothing is silently missable
    ctx.fillStyle = C.sand;
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillText("ALSO", 32, 154);
    ctx.font = "12px system-ui";
    ctx.fillText(optional, 70, 154);
  }

  const hint =
    w.area === "hub"
      ? Math.abs(w.pos.x - HUB.npc.x) + Math.abs(w.pos.y - HUB.npc.y) <= 1 ||
        Math.abs(w.pos.x - HUB.door.x) + Math.abs(w.pos.y - HUB.door.y) <= 1
        ? "E: talk / listen · P: help"
        : "arrows or WASD: swim · P: help"
      : "arrows or WASD: swim · P: help";
  ctx.fillStyle = C.muted;
  ctx.font = "13px system-ui";
  ctx.fillText(hint, 20, 700);

  if (ui.storyCard) {
    const titles = { story: "MEMORY FRAGMENT", song: "THE SONG-SEAL", npc: "MERFOLK", relic: "THE TIDE RELIC", heal: "HEAL SONG" } as const;
    const colors = { story: C.sand, song: C.biolum, npc: C.glow, relic: C.glow, heal: C.coral } as const;
    const accent = colors[ui.storyCard.kind];
    const alpha = Math.min(1, Math.max(0, 5.5 - ui.storyCard.age));
    // wrap long lines onto a second row instead of running off the card
    const words = ui.storyCard.text.split(" ");
    const rows: string[] = [""];
    for (const word of words) {
      const probe = rows[rows.length - 1] === "" ? word : `${rows[rows.length - 1]} ${word}`;
      if (probe.length > 78 && rows.length < 2) rows.push(word);
      else rows[rows.length - 1] = probe;
    }
    const cardH = rows.length > 1 ? 76 : 56;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(6,18,28,0.92)";
    ctx.beginPath();
    ctx.roundRect(cw / 2 - 320, 540, 640, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillText(titles[ui.storyCard.kind], cw / 2 - 300, 562);
    if (ui.storyCard.ph) {
      // the mark Marc's story replaces, out of the verse and into a tag
      ctx.fillStyle = C.muted;
      ctx.textAlign = "right";
      ctx.fillText("placeholder · Marc", cw / 2 + 300, 562);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = C.ink;
    ctx.font = "15px system-ui";
    rows.forEach((row, i) => ctx.fillText(row, cw / 2 - 300, 584 + i * 20));
    ctx.restore();
  }
}

// ---------- combat ----------

function renderCombat(ctx: CanvasRenderingContext2D, w: WorldState, ui: UIState, cw: number, ch: number): void {
  const c = w.combat!;
  const t = ui.time;
  water(ctx, cw, ch, "#122036");
  lightRays(ctx, cw, ch, t * 0.5);
  particles(ctx, cw, ch, t, 0.5);
  // phase 2 stains the water: the fight must LOOK escalated, not just
  // deal bigger numbers (fun diagnosis, agent 3 MED)
  if (c.boss?.phase === 2) {
    ctx.fillStyle = "rgba(120,20,26,0.10)";
    ctx.fillRect(0, 0, cw, ch);
  }

  // screen shake while a hit lands on the player; zoom pulse on combat
  // entry and phase breaks (DESIGN 2.5D item 4: camera moments)
  ctx.save();
  if (ui.zoomPulse > 0) {
    const z = 1 + 0.07 * ui.zoomPulse;
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(z, z);
    ctx.translate(-cw / 2, -ch / 2);
  }
  if (ui.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 14 * ui.shake, (Math.random() - 0.5) * 10 * ui.shake);
  }
  ctx.fillStyle = "#081B2A";
  ctx.beginPath();
  ctx.ellipse(cw / 2, 640, 700, 90, 0, 0, Math.PI * 2);
  ctx.fill();

  // bodies that move (fun diagnosis: both combatants were frozen at fixed
  // coordinates through the whole exchange). All offsets are presentation
  // reading ui timers; reduced motion collapses them to flashes.
  const rm = ui.reducedMotion;
  const heavyBeat = c.outcome === "ongoing" && enemyIntent(c).heavy;
  const beatAmp = heavyBeat ? 2 : 1; // a heavy windup reads twice as big
  const beatP = (ui.enemyBeat > 0 ? 1 - ui.enemyBeat / 0.55 : 0) * beatAmp; // windup progress
  const strikeP = ui.enemyStrike > 0 ? Math.sin(Math.PI * (1 - ui.enemyStrike / 0.22)) : 0;
  // linear progress 0..1 through the cast, plus its arc, so each ability
  // can pose the fish differently (played report: "it always just moves
  // forward a little, no real animations")
  const castLin = ui.attackAnim ? 1 - ui.attackAnim.t / CAST_TIME : 0;
  const attackP = ui.attackAnim ? Math.sin(Math.PI * castLin) : 0;
  const flinch = rm ? 0 : Math.min(1, ui.playerFlinch / 0.35) * 16;
  // per-ability body language: where the fish goes, how it turns, how it
  // squashes. Reduced motion keeps the flashes and drops the travel.
  const pose = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
  if (ui.attackAnim && !rm) {
    const k = ui.attackAnim.kind;
    if (k === "tailStrike") {
      // a committed dash: stretch into it, snap back
      pose.dx = attackP * 215;
      pose.rot = Math.sin(Math.PI * castLin) * 0.12;
      pose.sx = 1 + attackP * 0.22;
      pose.sy = 1 - attackP * 0.12;
    } else if (k === "finSlash") {
      // an arc: rise, roll through the cut, come down
      pose.dx = attackP * 165;
      pose.dy = -Math.sin(Math.PI * castLin) * 70;
      pose.rot = -0.9 * Math.sin(Math.PI * castLin);
      pose.sx = 1 + attackP * 0.1;
    } else if (k === "siltBurst") {
      // a tail-flick that kicks the silt out and shoves the fish back
      pose.dx = -attackP * 46;
      pose.rot = 0.3 * Math.sin(Math.PI * castLin);
      pose.sy = 1 + attackP * 0.16;
    } else if (k === "healSong") {
      // rises and swells while it sings
      pose.dy = -attackP * 46;
      pose.sx = 1 + attackP * 0.14;
      pose.sy = 1 + attackP * 0.14;
    } else if (k === "analyze") {
      // leans in and holds still, reading
      pose.dx = attackP * 26;
      pose.rot = -0.2 * attackP;
    } else if (k === "bubble") {
      // curls in behind the forming shell
      pose.dx = -attackP * 16;
      pose.rot = 0.5 * attackP;
      pose.sx = 1 - attackP * 0.16;
      pose.sy = 1 + attackP * 0.16;
    }
  }
  const lunge = pose.dx;
  const recoil = rm ? 0 : Math.min(1, ui.enemyFlash / 0.3);
  const sink = ui.victoryHold ? 1 - Math.max(0, ui.victoryHold.t) / 1.1 : 0;

  // player, small and near (left); enemy staged big (right): scale-by-depth
  const fx = 250 + pose.dx - flinch;
  const fy = 430 + pose.dy;
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(pose.rot);
  ctx.scale(pose.sx, pose.sy);
  fish(ctx, 0, 0, 1.7, t, 1);
  ctx.restore();
  // motion trail behind a committed dash so the strike reads as travel
  if (ui.attackAnim && !rm && attackP > 0.15 && (ui.attackAnim.kind === "tailStrike" || ui.attackAnim.kind === "finSlash")) {
    ctx.save();
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.16 * attackP * (1 - i / 4);
      ctx.translate(-26, 0);
      fish(ctx, fx, fy, 1.7, t, 1);
    }
    ctx.restore();
  }
  if (ui.playerFlinch > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.3, ui.playerFlinch);
    ctx.fillStyle = C.danger;
    ctx.beginPath();
    ctx.ellipse(250 - flinch, 430, 90, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // bubble guard: a visible shield ring while the charge holds
  if (c.bubbleCharge && !ui.victoryHold) {
    ctx.save();
    ctx.strokeStyle = ABILITY_META.bubble.accent;
    ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(250 + lunge - flinch, 430, 84 + Math.sin(t * 3) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const broken = new Set<PartKey>((c.boss?.parts ?? []).filter((p) => p.broken).map((p) => p.key));
  const slowed = getCondition(c.enemy, "slow");
  const blinded = getCondition(c.enemy, "blind");
  // enemy body offset: windup pulls back and swells, strike snaps toward
  // the player, hits recoil away, the kill sinks it into the dark
  const ex = 800 + (rm ? 0 : beatP * 14 - strikeP * 120 + recoil * 16);
  const eyBase = 300 + (rm ? 0 : beatP * -8) + sink * (rm ? 40 : 150);
  const eScale = (1 + (rm ? 0 : beatP * 0.08 + recoil * 0.1 - strikeP * 0.02)) * (1 - sink * 0.12);
  const drawEnemy = (x: number, y: number, alpha: number): void => {
    ctx.save();
    ctx.globalAlpha = alpha;
    const rage = c.boss?.phase === 2 ? 1 + Math.sin(t * 6) * 0.015 : 1;
    if (c.boss?.kind === "eel") eelSprite(ctx, x, y, 1.32 * eScale * rage, t, broken);
    else if (c.boss) sharkSprite(ctx, x, y, 1.32 * eScale * rage, t, broken);
    else squidSprite(ctx, x + 10, y, 2.1 * eScale, t, c.enemy.name.includes("elder") ? "elder" : c.enemy.name.includes("ink") ? "ink" : "vampire");
    ctx.restore();
  };
  // slow afterimages: the enemy drags ghosts of itself
  if (slowed && !ui.victoryHold && !rm) {
    drawEnemy(ex - 22, eyBase, 0.14);
    if (slowed.level === 2) drawEnemy(ex - 40, eyBase, 0.07);
  }
  drawEnemy(ex, eyBase, 1 - sink * 0.65);

  // On-body part anchors: labels always, dashed reticle on the aimed part
  // (G6 HIGH fix: the panel-to-body mapping must be unambiguous). Hidden
  // once the fight is decided (the body is sinking).
  if (c.boss && !ui.victoryHold) {
    const sharkAnchors: Record<PartKey, { x: number; y: number }> = {
      jaw: { x: 800 - 110 * 1.25, y: 300 + 38 * 1.25 },
      eye: { x: 800 - 96 * 1.25, y: 300 - 18 * 1.25 },
      fin: { x: 800, y: 300 - 68 * 1.25 },
      tail: { x: 800 + 168 * 1.25, y: 300 },
    };
    const eelAnchors: Record<PartKey, { x: number; y: number }> = {
      jaw: { x: 800 - 125 * 1.25, y: 300 + 40 * 1.25 },
      eye: { x: 800 - 150 * 1.25, y: 300 - 66 * 1.25 },
      fin: { x: 800 + 30 * 1.25, y: 300 - 16 * 1.25 },
      tail: { x: 800 + 190 * 1.25, y: 300 + 10 },
    };
    const anchors = c.boss.kind === "eel" ? eelAnchors : sharkAnchors;
    for (const p of c.boss.parts) {
      const a = anchors[p.key];
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.fillStyle = p.broken ? "#4a5c66" : C.ink;
      ctx.textAlign = "center";
      ctx.fillText(p.broken ? `${p.name.toUpperCase()} x` : p.name.toUpperCase(), a.x, a.y - 26);
      ctx.textAlign = "left";
      if (ui.selectedPart === p.key && !p.broken) {
        ctx.save();
        ctx.strokeStyle = C.glow;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(a.x, a.y, 30 + Math.sin(t * 4) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  if (ui.enemyFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, ui.enemyFlash * 1.8);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(ex, eyBase, c.boss ? 210 : 110, c.boss ? 120 : 110, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // condition states, readable on the body: blinded enemies dim under a
  // lingering silt haze with dark bars over the eye line; slowed enemies
  // drag the afterimages drawn above
  if (blinded) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#0A0614";
    ctx.beginPath();
    ctx.ellipse(ex, eyBase, c.boss ? 220 : 120, c.boss ? 130 : 120, 0, 0, Math.PI * 2);
    ctx.fill();
    // drifting silt motes while the blind holds
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = C.sand;
    for (let i = 0; i < 12; i++) {
      const a = t * (0.6 + (i % 4) * 0.2) + i * 2.1;
      ctx.beginPath();
      ctx.arc(ex - 60 + Math.cos(a) * (60 + i * 6), eyBase - 60 + Math.sin(a * 1.3) * 34, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // eye bars, heavier at level II
    ctx.globalAlpha = blinded.level === 2 ? 0.9 : 0.6;
    ctx.fillStyle = "#0A0614";
    const eyeY = eyBase - (c.boss ? 40 : 20);
    ctx.fillRect(ex - (c.boss ? 190 : 70), eyeY - 8, c.boss ? 150 : 110, 16);
    ctx.restore();
  }

  // per-ability cast effects, colored like their cards (fun diagnosis:
  // every cast was one shared white ellipse)
  for (const fx of ui.castFx) {
    const p = Math.min(1, fx.age / 0.6);
    const fade = 1 - p;
    const accent = ABILITY_META[fx.kind]?.accent ?? C.ink;
    const fx2x = 250 + pose.dx - flinch;
    const fx2y = 430 + pose.dy;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    if (fx.kind === "tailStrike") {
      // impact star at the enemy
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = i * (Math.PI / 3) + 0.3;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * 26, eyBase + Math.sin(a) * 26);
        ctx.lineTo(ex + Math.cos(a) * (26 + 34 * p), eyBase + Math.sin(a) * (26 + 34 * p));
        ctx.stroke();
      }
    } else if (fx.kind === "siltBurst") {
      // sand cloud billowing over the enemy's eyes
      ctx.fillStyle = accent;
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4;
        ctx.beginPath();
        ctx.arc(ex - 50 + Math.cos(a) * 90 * p, eyBase - 40 + Math.sin(a) * 55 * p, 3.5 + p * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx.kind === "finSlash") {
      // cyan crescent swipe across the body
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(ex - 20, eyBase, 90 + p * 40, Math.PI * (1.1 + p * 0.3), Math.PI * (1.7 + p * 0.3));
      ctx.stroke();
    } else if (fx.kind === "healSong") {
      // green motes rising off the fish
      ctx.fillStyle = accent;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(fx2x - 30 + (i % 5) * 16, fx2y + 12 - p * 150 - i * 8, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx.kind === "analyze") {
      // scanline sweeping the enemy
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      const sy = eyBase - 120 + p * 240;
      ctx.beginPath();
      ctx.moveTo(ex - 200, sy);
      ctx.lineTo(ex + 200, sy);
      ctx.stroke();
    } else if (fx.kind === "bubble") {
      // the shield ring forming
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3 + (1 - p) * 3;
      ctx.beginPath();
      ctx.arc(fx2x, fx2y, 26 + p * 64, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // kill ceremony: sand motes rise off the sinking body
  if (sink > 0 && !rm) {
    ctx.save();
    ctx.fillStyle = C.sand;
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = Math.max(0, 0.7 - sink * 0.6 - (i % 5) * 0.08);
      ctx.beginPath();
      ctx.arc(ex - 120 + (i * 37) % 240, eyBase - sink * (90 + (i % 6) * 30) + 20, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // your inked eyes: the water itself darkens at the edges while the
  // player is blinded, and a chip under the fish says why (enemy type 2)
  const pBlindUi = getCondition(c.player, "blind");
  if (pBlindUi && !ui.victoryHold) {
    ctx.save();
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, 230, cw / 2, ch / 2, 700);
    vg.addColorStop(0, "rgba(8,6,20,0)");
    vg.addColorStop(1, "rgba(8,6,20,0.6)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
    chip(ctx, 196, 496, `INKED · ${pBlindUi.turns}`, "#8FA3E8");
  }

  // damage floaters: enemy floats rise off the BODY and fade before the
  // nameplate band (panel 2: they blanked the intent line mid-payoff);
  // lanes keep chorded floats apart
  for (const f of ui.floaters) {
    const lane = f.lane ?? 0;
    const x = (f.side === "enemy" ? 800 + f.age * 20 : 250) + lane * 12;
    const y = (f.side === "enemy" ? 285 : 370) + lane * 24 - f.age * 46;
    ctx.save();
    let alpha = Math.max(0, 1 - f.age / 1.3);
    if (f.side === "enemy" && y < 195) alpha *= Math.max(0, (y - 165) / 30);
    ctx.globalAlpha = alpha;
    ctx.font = "700 20px ui-monospace, monospace";
    ctx.fillStyle = f.color;
    ctx.textAlign = "center";
    ctx.fillText(f.text, x, y);
    ctx.restore();
    ctx.textAlign = "left";
  }
  ctx.restore();

  // enemy header: name, HP, condition chips with levels (shifted right in
  // boss fights so the YOUR MOVE pill never overlaps the name)
  const headX = c.boss ? 900 : 640;
  ctx.fillStyle = C.ink;
  ctx.font = "600 16px system-ui";
  ctx.fillText(c.enemy.name, headX, 78);
  bar(ctx, headX, 88, 260, 12, c.enemy.hp / c.enemy.maxHp, C.danger);
  ctx.fillStyle = C.muted;
  ctx.font = "600 11px ui-monospace, monospace";
  ctx.fillText(`${c.enemy.hp}/${c.enemy.maxHp}`, headX + 268, 97);
  let chipX = headX;
  for (const cond of c.enemy.conditions) {
    chipX += chip(ctx, chipX, 108, `${cond.kind.toUpperCase()} ${cond.level === 2 ? "II" : "I"} · ${cond.turns}`, C.glow) + 8;
  }
  // a chip that reads SLOW I means nothing on its own: say what it does
  // (played report: "analyze said slow is effective, what does that mean")
  if (c.enemy.conditions.length > 0 && !ui.victoryHold) {
    ctx.fillStyle = C.biolum;
    ctx.font = "12px system-ui";
    c.enemy.conditions.forEach((cond, i) => {
      ctx.fillText(`${cond.kind}: ${CONDITION_INFO[cond.kind].effect(cond.level)}`, headX, 148 + i * 16);
    });
  }

  // intent telegraph: what the sea will do next, so abilities become
  // answers to visible threats (the playtester's "make sense to use
  // during key moments"; enemyIntent is a pure reader, RNG untouched)
  if (c.outcome === "ongoing" && !ui.victoryHold) {
    const intent = enemyIntent(c);
    let text: string;
    let color: string;
    ctx.font = "600 13px ui-monospace, monospace";
    if (intent.skip) {
      text = "NEXT: held by the slow current, it will skip";
      color = C.biolum;
    } else {
      text = intent.heavy ? `NEXT: WINDS UP · heavy blow for ${intent.dmg}` : `NEXT: strikes for ${intent.dmg}`;
      // break consequences for the AIMED part in breaking range: the key
      // part raises the answer (phase 2), a utility part lowers it. The
      // final panel proved the old compact branch DROPPED this clause on
      // exactly the crowded lines that carry it; information is now
      // never dropped, the line wraps instead.
      if (c.boss && ui.selectedPart) {
        const aimedPart = c.boss.parts.find((p2) => p2.key === ui.selectedPart);
        const maxHit = c.relicEcho ? BASE.relicTailStrike : 8;
        if (aimedPart && !aimedPart.broken && aimedPart.durability <= maxHit) {
          const isKey = c.boss.phase === 1 && ui.selectedPart === c.boss.keyPartByPhase[1];
          const isUtility = ui.selectedPart !== c.boss.keyPartByPhase[1] && ui.selectedPart !== c.boss.keyPartByPhase[2];
          if (isKey) text += ` · ${enemyIntent(c, 2).dmg} if it breaks`;
          else if (isUtility) text += ` · ${enemyIntent(c, undefined, 1).dmg} if it breaks`;
        }
      }
      if (intent.missChance > 0) text += ` · ${Math.round(intent.missChance * 100)}% miss (blinded)`;
      if (intent.bubbled) text += " · your bubble holds";
      if (c.enemy.ink) text += " · ink in the water";
      color = intent.missChance > 0 || intent.bubbled ? C.glow : C.danger;
    }
    ctx.fillStyle = color;
    const intentY = c.enemy.conditions.length > 0 ? 152 + c.enemy.conditions.length * 16 : 116;
    const budget = cw - headX - 16;
    // wrap at token boundaries; EVERY row respects the budget and every
    // token survives (final panel: compaction dropped the break warning;
    // confirmation: an unbudgeted second row clipped at the canvas edge)
    const tokens = text.split(" · ");
    let rowIdx = 0;
    while (tokens.length > 0) {
      let row = tokens.shift() ?? "";
      while (tokens.length > 0 && ctx.measureText(`${row} · ${tokens[0]}`).width <= budget) {
        row += ` · ${tokens.shift()}`;
      }
      ctx.fillText(row, headX, intentY + rowIdx * 16);
      rowIdx += 1;
    }
  }

  // phase banner (not over the SPENT hold: the fight is decided)
  if (c.boss) {
    if (!ui.victoryHold) {
      ctx.strokeStyle = C.danger;
      ctx.fillStyle = C.panel;
      ctx.beginPath();
      ctx.roundRect(cw / 2 - 130, 20, 260, 34, 17);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.danger;
      ctx.font = "600 14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`PHASE ${c.boss.phase} · ${c.boss.phaseName}`, cw / 2, 42);
      ctx.textAlign = "left";
    }

    // part panel
    const panelX = 24;
    let py2 = 120;
    ctx.fillStyle = "rgba(6,18,28,0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX - 8, py2 - 26, 190, 4 * 54 + 30, 10);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = "600 11px ui-monospace, monospace";
    // no aiming prompt or selection highlight over a decided fight
    ctx.fillText(ui.victoryHold ? "SPENT" : "TARGET (up/down keys)", panelX, py2 - 8);
    for (const p of c.boss.parts) {
      const selected = !ui.victoryHold && ui.selectedPart === p.key;
      if (selected && !p.broken) {
        ctx.strokeStyle = C.glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(panelX - 4, py2 - 4, 168, 44, 6);
        ctx.stroke();
      }
      ctx.fillStyle = p.broken ? "#3a4a56" : selected ? C.glow : C.ink;
      ctx.font = "600 13px ui-monospace, monospace";
      ctx.fillText(`${selected ? "> " : "  "}${p.name.toUpperCase()}${p.broken ? " (broken)" : ""}`, panelX, py2 + 12);
      if (!p.broken) {
        bar(ctx, panelX + 4, py2 + 20, 150, 8, p.durability / p.maxDurability, C.coral);
        ctx.fillStyle = C.muted;
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(String(p.durability), panelX + 158, py2 + 27);
      }
      py2 += 54;
    }
    if (c.analyzed && !ui.victoryHold) {
      ctx.fillStyle = C.biolum;
      ctx.font = "12px system-ui";
      const keyName = c.boss.parts.find((p) => p.key === c.boss!.keyPartByPhase[c.boss!.phase])?.name ?? "";
      ctx.fillText(`analyze: break the ${keyName} to end this phase`, panelX, py2 + 4);
    }
  } else if (c.analyzed) {
    ctx.fillStyle = C.biolum;
    ctx.font = "13px system-ui";
    ctx.fillText(
      `analyze: ${CONDITION_INFO[c.enemy.analyzeHint].ability} (${CONDITION_INFO[c.enemy.analyzeHint].key}) works best: ${CONDITION_INFO[c.enemy.analyzeHint].effect(1)}`,
      640,
      ch - 150,
    );
  }

  // turn pill: input is always the player's to give in this turn flow
  // (suppressed under the victory hold: the fight is over)
  if (ui.victoryHold) {
    // no pill on a corpse
  } else {
  ctx.fillStyle = C.panel;
  ctx.strokeStyle = ui.enemyBeat > 0 ? C.danger : C.glow;
  // a refused press during the answer flashes the pill so the lock is
  // acknowledged, never silent (panel 2 seat C LOW)
  ctx.lineWidth = ui.beatPulse > 0 ? 1 + ui.beatPulse * 8 : 1;
  ctx.beginPath();
  ctx.roundRect(cw / 2 - 85, c.boss ? 60 : 20, 170, 30, 15);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = ui.enemyBeat > 0 ? C.danger : C.glow;
  ctx.font = "600 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(ui.enemyBeat > 0 ? "THE SEA ANSWERS" : "YOUR MOVE", cw / 2, c.boss ? 80 : 40);
  ctx.textAlign = "left";
  }

  // aim confirm line (boss): what will a number key hit right now?
  // (suppressed on the corpse frame: the fight is over, seat 1 LOW-5)
  if (c.boss && !ui.victoryHold) {
    ctx.fillStyle = ui.selectedPart ? C.glow : C.muted;
    ctx.font = "13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      ui.selectedPart
        ? `aiming at the ${(c.boss.parts.find((p2) => p2.key === ui.selectedPart)?.name ?? ui.selectedPart).toUpperCase()}`
        : "no aim: hits drift (up/down to aim)",
      cw / 2,
      ch - 128,
    );
    ctx.textAlign = "left";
  }

  // ability teach line
  ctx.fillStyle = C.muted;
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Silt Burst blinds · Fin Slash slows · Heal Song mends · Analyze reveals · Bubble guards the next hit", cw / 2, ch - 110);
  ctx.textAlign = "left";

  // recent log lines
  ctx.fillStyle = C.muted;
  ctx.font = "13px system-ui";
  ui.lastLines.slice(-3).forEach((line, i) => {
    ctx.globalAlpha = 0.45 + i * 0.25;
    ctx.fillText(line, 380, 540 + i * 18);
  });
  ctx.globalAlpha = 1;

  // bottom bar: resources + abilities
  ctx.fillStyle = "rgba(6,18,28,0.92)";
  ctx.beginPath();
  ctx.roundRect(18, ch - 104, cw - 36, 88, 12);
  ctx.fill();
  ctx.fillStyle = C.muted;
  ctx.font = "600 12px ui-monospace, monospace";
  ctx.fillText("HP", 36, ch - 74);
  bar(ctx, 66, ch - 84, 170, 12, c.player.hp / c.player.maxHp, C.coral);
  ctx.fillText(`${c.player.hp}/${c.player.maxHp}`, 244, ch - 74);
  ctx.fillText("STA", 36, ch - 44);
  bar(ctx, 66, ch - 54, 170, 12, c.player.sta / c.player.maxSta, C.glow);
  ctx.fillText(`${c.player.sta}/${c.player.maxSta}`, 244, ch - 44);

  // the hand disappears once the fight is decided (confirmation seat A,
  // LOW-B: live-looking ability cards under the SPENT banner read as
  // actionable)
  if (ui.victoryHold) return;
  ABILITY_ORDER.forEach((key, i) => {
    const a = ABILITIES[key];
    const meta = ABILITY_META[key];
    const x = 330 + i * 152;
    const canAfford =
      c.player.sta >= a.staCost &&
      !(a.heals !== undefined && (c.healSongUses <= 0 || c.player.hp >= c.player.maxHp));
    const locked = ui.enemyBeat > 0; // the sea is answering; the hand waits
    const pressed = ui.buttonFlash[i] > 0;
    ctx.strokeStyle = pressed ? meta.accent : canAfford && !locked ? C.line : "#152836";
    ctx.lineWidth = pressed ? 2.5 : 1;
    ctx.fillStyle = pressed ? "#12293A" : C.panel;
    ctx.beginPath();
    ctx.roundRect(x, ch - 92, 140, 64, 9);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    // identity: accent edge + glyph, dimmed when unusable
    const on = canAfford && !locked;
    ctx.save();
    ctx.globalAlpha = on ? 1 : 0.35;
    ctx.fillStyle = meta.accent;
    ctx.beginPath();
    ctx.roundRect(x, ch - 92, 5, 64, 2);
    ctx.fill();
    ctx.strokeStyle = meta.accent;
    meta.glyph(ctx, x + 118, ch - 60);
    ctx.restore();
    ctx.fillStyle = on ? C.ink : "#4a5c66";
    ctx.font = "600 13px system-ui";
    ctx.fillText(`${i + 1} ${a.name}`, x + 12, ch - 74);
    ctx.fillStyle = on ? C.muted : "#3a4c56";
    ctx.font = "12px ui-monospace, monospace";
    const extra = a.heals !== undefined ? ` · ${c.healSongUses} left` : "";
    ctx.fillText(`${a.staCost} STA${extra}`, x + 12, ch - 54);
    // what it DOES, on the button itself: the answer to "what is slow"
    ctx.fillStyle = on ? "#7E9AA6" : "#33454e";
    ctx.font = "10px system-ui";
    ctx.fillText(ABILITY_EFFECT[key] ?? "", x + 12, ch - 36);
  });
}

// ---------- screens ----------

function centered(ctx: CanvasRenderingContext2D, text: string, y: number, font: string, color: string, cw: number): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, cw / 2, y);
  ctx.textAlign = "left";
}

export function render(ctx: CanvasRenderingContext2D, w: WorldState, ui: UIState): void {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  // the win beat: hold the final combat frame with a banner so the kill
  // is watchable (played-experience hunt, HIGH-2)
  if (ui.victoryHold && (ui.screen === "play" || ui.screen === "pause")) {
    const held = { ...w, mode: "combat" as const, combat: ui.victoryHold.combat };
    renderCombat(ctx, held as WorldState, ui, cw, ch);
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = C.biolum;
    ctx.beginPath();
    ctx.roundRect(cw / 2 - 150, ch / 2 - 60, 300, 44, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.biolum;
    ctx.font = "700 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    // "SPENT" read as stamina and "THE SONG QUIETS" read as mourning
    // (masher playtest): the win now sounds like one
    ctx.fillText("THE WATER CLEARS", cw / 2, ch / 2 - 31);
    ctx.textAlign = "left";
    if (ui.screen === "pause") {
      // pause draws OVER the held frame instead of leaking the world
      ctx.fillStyle = "rgba(6,18,28,0.72)";
      ctx.fillRect(0, 0, cw, ch);
      centered(ctx, "PAUSED", ch / 2, "700 40px system-ui", C.ink, cw);
    }
    if (ui.muted) {
      ctx.fillStyle = C.muted;
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillText("MUTED (M)", cw - 96, 30);
    }
    return;
  }

  if (ui.screen === "title") {
    water(ctx, cw, ch, C.mid);
    lightRays(ctx, cw, ch, ui.time);
    particles(ctx, cw, ch, ui.time, 0.7);
    // a living reef behind the title, not an empty aquarium (pitch judge)
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#0D2A40";
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 220;
      ctx.fillRect(x, 380 + (i % 3) * 60, 46, 340);
      ctx.fillRect(x + 60, 460 + (i % 2) * 40, 34, 260);
    }
    ctx.fillStyle = "#0F3048";
    for (let i = 0; i < 6; i++) {
      const drift = ((ui.time * (22 + (i % 3) * 12) + i * 300) % (cw + 300)) - 150;
      const fy = 120 + (i % 4) * 60 + Math.sin(ui.time + i * 2) * 12;
      const flip = i % 2 === 0 ? 1 : -1;
      const fx2 = flip === 1 ? drift : cw - drift;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(fx2, fy, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx2 - 12 * flip, fy);
      ctx.lineTo(fx2 - 19 * flip, fy - 5);
      ctx.lineTo(fx2 - 19 * flip, fy + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    fish(ctx, cw / 2 - 350, 190 + Math.sin(ui.time) * 12, 2.2, ui.time, 1);
    centered(ctx, "TIDESONG", 260, "900 84px system-ui", C.glow, cw);
    centered(ctx, "the songs that kept the sea in balance have faded", 302, "600 16px system-ui", C.ink, cw);
    centered(ctx, "a small fish goes down to learn the words", 328, "600 16px system-ui", C.ink, cw);
    centered(ctx, "click or press any key to begin", 430 + Math.sin(ui.time * 2) * 4, "16px system-ui", C.biolum, cw);
    centered(ctx, "swim with WASD · sing with 1-6 in combat · P for help at any time", 462, "13px ui-monospace, monospace", C.muted, cw);
    centered(ctx, "overnight prototype · working title · design Marc · art direction to come from Glass_Goat · code ImmortalDemon", 660, "13px system-ui", C.muted, cw);
    return;
  }

  if (w.mode === "combat" && w.combat) renderCombat(ctx, w, ui, cw, ch);
  else renderExplore(ctx, w, ui, cw, ch);

  // the announcement band: boss intros, area arrivals, the wall parting
  // (playtest: zone transitions were completely silent; every place and
  // set-piece now names itself for a breath)
  if (ui.bossIntro && !ui.victoryHold) {
    const bi = ui.bossIntro;
    const boss = bi.title.startsWith("THE CORRUPTED");
    const accent = boss ? C.danger : C.glow;
    const fade = Math.min(1, Math.min((bi.dur - bi.t) / 0.35 + 0.001, bi.t / 0.6));
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade) * 0.92;
    ctx.fillStyle = "rgba(4,10,18,0.85)";
    ctx.fillRect(0, 208, cw, 132);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cw / 2 - 260, 214);
    ctx.lineTo(cw / 2 + 260, 214);
    ctx.moveTo(cw / 2 - 260, 334);
    ctx.lineTo(cw / 2 + 260, 334);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.font = "700 44px system-ui";
    ctx.fillText(bi.title, cw / 2, 276);
    ctx.fillStyle = C.muted;
    ctx.font = "600 16px ui-monospace, monospace";
    ctx.fillText(bi.sub, cw / 2, 314);
    ctx.textAlign = "left";
    ctx.restore();
  }

  if (ui.deathFlash > 0) {
    ctx.fillStyle = `rgba(10,4,8,${Math.min(0.75, ui.deathFlash)})`;
    ctx.fillRect(0, 0, cw, ch);
    centered(ctx, "the sea reclaims you", ch / 2 - 12, "600 34px system-ui", C.danger, cw);
    centered(ctx, "waking at the last checkpoint...", ch / 2 + 24, "15px system-ui", C.muted, cw);
    if (w.lastDeathHint) {
      // the pity ladder escalates HP; these lines escalate knowledge
      // (and announce mercy: the panel proved the story card version was
      // wiped by the death handler in the same frame, dead code)
      w.lastDeathHint.split(" || ").forEach((line, i) => {
        centered(ctx, line, ch / 2 + 58 + i * 26, "600 15px system-ui", C.biolum, cw);
      });
    }
  }

  // victory outranks pause (hunt, MED-4); the pause-state normalization
  // lives in the frame loop, because rendering never mutates state
  if (ui.screen === "pause" && w.mode !== "victory") {
    ctx.fillStyle = "rgba(6,18,28,0.93)";
    ctx.fillRect(0, 0, cw, ch);
    centered(ctx, "PAUSED", 92, "700 40px system-ui", C.ink, cw);
    centered(ctx, "arrows/WASD swim · E talk · 1-6 abilities · up/down pick boss part", 128, "14px system-ui", C.muted, cw);
    centered(ctx, "SPACE pass turn · P resume · M mute", 152, "14px system-ui", C.muted, cw);
    // THE SONG SO FAR: what the verses taught, not just that you have
    // them (Marc's doc: collectibles deepen understanding). The stat
    // half lives in the HUD; this is the half you read.
    const got = w.fragments.filter((f) => f.collected).sort((a, b) => a.id - b.id);
    centered(ctx, "THE SONG SO FAR", 206, "700 18px ui-monospace, monospace", C.biolum, cw);
    if (got.length === 0) {
      centered(ctx, "you have not gathered a verse yet: the sea is quiet", 240, "italic 15px system-ui", C.muted, cw);
      centered(ctx, "verses are scattered through the reef and the ruins", 264, "14px system-ui", C.muted, cw);
    } else {
      let y = 244;
      for (const f of got) {
        centered(ctx, f.title, y, "700 13px ui-monospace, monospace", C.sand, cw);
        centered(ctx, `"${f.verse.replace(/^\(placeholder\) /, "")}"`, y + 20, "italic 15px system-ui", C.ink, cw);
        // the lesson wraps to two rows so a whole teaching fits
        const lesson = f.lesson.replace(/^\(placeholder\) /, "");
        const words = lesson.split(" ");
        const rows: string[] = [""];
        for (const word of words) {
          const probe = rows[rows.length - 1] === "" ? word : `${rows[rows.length - 1]} ${word}`;
          if (probe.length > 92 && rows.length < 2) rows.push(word);
          else rows[rows.length - 1] = probe;
        }
        rows.forEach((row, i) => centered(ctx, row, y + 40 + i * 17, "13px system-ui", C.muted, cw));
        y += 40 + rows.length * 17 + 14;
      }
      centered(ctx, `${got.length}/${w.fragments.length} verses · +${got.length} max stamina · the pad carries them`, y + 6, "600 13px ui-monospace, monospace", C.biolum, cw);
    }
    centered(ctx, "all verses are placeholder drafts for Marc", ch - 26, "12px system-ui", C.muted, cw);
    return;
  }

  if (ui.screen === "victory" || w.mode === "victory") {
    ctx.fillStyle = "rgba(4,12,20,0.99)";
    ctx.fillRect(0, 0, cw, ch);
    const collected = w.fragments.filter((f) => f.collected).sort((a, b) => a.id - b.id);

    // THE CHOICE (Marc's proposal, the question the slice was missing):
    // "determine whether its legacy should be restored or left to
    // disappear". The eel is dead and the sea's name is loose.
    if (!w.ending) {
      centered(ctx, "the name of the sea", 150, "700 46px system-ui", C.glow, cw);
      centered(ctx, "it spills out of the eel and hangs in the water, waiting to be carried", 196, "17px system-ui", C.ink, cw);
      centered(ctx, "the keepers let the songs die on purpose, so the deep could not learn it", 224, "15px system-ui", C.muted, cw);
      const cards: Array<[string, string, string, string]> = [
        ["1", "SING IT BACK", "the sea can be called again", "and anything listening learns the name"],
        ["2", "LET IT GO", "the sea keeps its silence", "smaller, and beyond the deep's reach"],
      ];
      cards.forEach(([key, title, line1, line2], i) => {
        const x = i === 0 ? cw / 2 - 300 : cw / 2 + 20;
        ctx.fillStyle = "rgba(10,26,38,0.9)";
        ctx.strokeStyle = i === 0 ? C.biolum : C.muted;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, 288, 280, 132, 12);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = i === 0 ? C.biolum : C.ink;
        ctx.font = "700 20px system-ui";
        ctx.fillText(`${key}   ${title}`, x + 140, 328);
        ctx.fillStyle = C.ink;
        ctx.font = "14px system-ui";
        ctx.fillText(line1, x + 140, 360);
        ctx.fillStyle = C.muted;
        ctx.font = "13px system-ui";
        ctx.fillText(line2, x + 140, 384);
        ctx.textAlign = "left";
      });
      centered(ctx, `you carry ${collected.length} of ${w.fragments.length} verses: that is how much song you have to sing`, 462, "600 14px ui-monospace, monospace", C.sand, cw);
      centered(ctx, "press 1 or 2, or click a card", 500, "15px system-ui", C.glow, cw);
      centered(ctx, "this choice is Marc's central question, made playable: placeholder wording", ch - 26, "12px system-ui", C.muted, cw);
      return;
    }

    const sung = w.ending === "sung";
    const whole = collected.length >= 5;
    const headline = sung
      ? whole
        ? "the sea remembers its name"
        : "the sea half remembers"
      : "the sea keeps its silence";
    const under = sung
      ? whole
        ? "every current answers at once, and the deep hears it too"
        : `you sang back ${collected.length} of ${w.fragments.length} verses: it answers, thinly`
      : "the name thins and is gone: nothing can call the sea, and nothing can hunt it";
    centered(ctx, headline, 176, "700 50px system-ui", sung ? C.glow : C.muted, cw);
    centered(ctx, under, 220, "17px system-ui", C.ink, cw);
    centered(ctx, `verses ${collected.length}/${w.fragments.length} · deaths ${w.deaths} · strokes ${w.steps}`, 254, "600 15px ui-monospace, monospace", C.muted, cw);
    if (collected.length > 0) {
      // recited in NARRATIVE order, never pickup order, so the song reads
      // as a song (analysis: pickup order made the arc noise)
      centered(ctx, sung ? "what you sang back:" : "what you let go:", 292, "600 13px ui-monospace, monospace", C.sand, cw);
      collected.forEach((f, i) => {
        centered(ctx, `"${f.verse.replace(/^\(placeholder\) /, "")}"`, 316 + i * 21, "italic 14px system-ui", sung ? C.sand : "#5E7480", cw);
      });
    }
    if (collected.length < w.fragments.length) {
      centered(ctx, `${w.fragments.length - collected.length} verse(s) stayed lost down there`, 316 + collected.length * 21 + 8, "13px system-ui", C.muted, cw);
    }
    centered(ctx, "TIDESONG (vertical slice)", 512, "600 20px system-ui", C.ink, cw);
    centered(ctx, "design and story (all verses placeholder) · Marc", 540, "15px system-ui", C.muted, cw);
    centered(ctx, "art (everything you saw is a placeholder skeleton) · Glass_Goat", 563, "15px system-ui", C.muted, cw);
    centered(ctx, "code · ImmortalDemon", 586, "15px system-ui", C.muted, cw);
    centered(ctx, "R or click: back to the title, then swim it again", 634, "14px system-ui", C.glow, cw);
  }

  if (ui.muted) {
    ctx.fillStyle = C.muted;
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillText("MUTED (M)", cw - 96, 30);
  }
}
