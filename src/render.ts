// Rendering reads state; it never owns it. 2.5D per DESIGN.md: parallax
// layers, underwater aerial perspective (far = bluer, dimmer), scale-by-depth
// combat staging, all presentation-only. Palette follows the greybox sketch.

import { ABILITIES, getCondition, type CombatState, type PartKey } from "./game";
import { AREAS, D1, HUB, type WorldState } from "./world";

export interface Floater {
  text: string;
  color: string;
  age: number; // seconds since spawn
  side: "player" | "enemy";
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
  floaters: Floater[];
}

export const ABILITY_ORDER = ["tailStrike", "siltBurst", "finSlash", "healSong", "analyze", "bubble"];

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

function squidSprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.8) * 6);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#6E4A8C";
  ctx.beginPath();
  ctx.ellipse(0, -20, 34, 30, 0, Math.PI, 0);
  ctx.fill();
  // swept side-fins so the silhouette reads squid, not jellyfish
  ctx.fillStyle = "#5A3B75";
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
  ctx.strokeStyle = "#5A3B75";
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
    ctx.fillText(w.doorOpen ? "song-seal door (open)" : "song-seal door", px(HUB.door.x), py(HUB.door.y) + 52);
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
  } else {
    // dungeon dressing: pillars and bones of the ruin
    ctx.fillStyle = w.area === "dungeon2" ? "#123528" : "#0D2A40";
    for (let i = 2; i < 24; i += 5) {
      ctx.fillRect(px(i) - 8, 150, 16, 60);
    }
    ctx.fillStyle = C.muted;
    ctx.font = "12px system-ui";
    ctx.fillText(w.area === "dungeon2" ? "the second ruin" : "the first ruin", px(2) - 20, 140);
  }

  // fragments
  for (const f of w.fragments) {
    if (f.collected || f.area !== w.area) continue;
    const pulse = 0.6 + Math.sin(t * 3 + f.id) * 0.4;
    ctx.save();
    ctx.translate(px(f.x), py(f.y));
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillStyle = C.sand;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
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
      squidSprite(ctx, px(e.x), py(e.y) - 12, 0.62, t + e.id);
      label = "elder squid";
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
  fish(ctx, ui.animX * TILE + TILE / 2 - camX, 200 + ui.animY * TILE, 1, t, 1);

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
  ctx.fillText("STA", 32, 66);
  bar(ctx, 62, 56, 150, 12, 1, C.glow);
  ctx.fillStyle = C.muted;
  ctx.fillText("20/20", 220, 66);
  ctx.fillText("SONG", 32, 90);
  ctx.fillStyle = C.ink;
  ctx.fillText(`${"~".repeat(w.healSongUses) || "-"}`, 76, 90);
  ctx.fillStyle = C.muted;
  ctx.fillText(`fragments ${w.fragments.filter((f) => f.collected).length}/${w.fragments.length}`, 120, 90);
  if (w.hasTideRelic) chip(ctx, 304, 24, "TIDE RELIC", C.glow);

  const hint =
    w.area === "hub"
      ? Math.abs(w.pos.x - HUB.npc.x) + Math.abs(w.pos.y - HUB.npc.y) <= 1 ||
        Math.abs(w.pos.x - HUB.door.x) + Math.abs(w.pos.y - HUB.door.y) <= 1
        ? "E: talk / listen"
        : "arrows or WASD: swim"
      : "arrows or WASD: swim";
  ctx.fillStyle = C.muted;
  ctx.font = "13px system-ui";
  ctx.fillText(hint, 20, 700);

  if (w.npcLine) {
    ctx.fillStyle = "rgba(6,18,28,0.9)";
    ctx.beginPath();
    ctx.roundRect(cw / 2 - 280, 620, 560, 40, 10);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = "15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`"${w.npcLine}"`, cw / 2, 645);
    ctx.textAlign = "left";
  }
}

// ---------- combat ----------

function renderCombat(ctx: CanvasRenderingContext2D, w: WorldState, ui: UIState, cw: number, ch: number): void {
  const c = w.combat!;
  const t = ui.time;
  water(ctx, cw, ch, "#122036");
  lightRays(ctx, cw, ch, t * 0.5);
  particles(ctx, cw, ch, t, 0.5);

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

  // player, small and near (left); enemy staged big (right): scale-by-depth
  fish(ctx, 250, 430, 1.7, t, 1);

  const broken = new Set<PartKey>((c.boss?.parts ?? []).filter((p) => p.broken).map((p) => p.key));
  if (c.boss?.kind === "eel") eelSprite(ctx, 800, 300, 1.25, t, broken);
  else if (c.boss) sharkSprite(ctx, 800, 300, 1.25, t, broken);
  else squidSprite(ctx, 810, 300, 2.1, t);

  // On-body part anchors: labels always, dashed reticle on the aimed part
  // (G6 HIGH fix: the panel-to-body mapping must be unambiguous).
  if (c.boss) {
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
    ctx.ellipse(800, 300, c.boss ? 210 : 110, c.boss ? 120 : 110, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // condition tint: blinded enemies dim, slowed enemies trail
  if (getCondition(c.enemy, "blind")) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#0A0614";
    ctx.beginPath();
    ctx.ellipse(800, 300, c.boss ? 220 : 120, c.boss ? 130 : 120, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // damage floaters
  for (const f of ui.floaters) {
    const x = f.side === "enemy" ? 800 + (f.age * 20) : 250;
    const y = (f.side === "enemy" ? 180 : 360) - f.age * 46;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - f.age / 1.3);
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
  let chipX = headX;
  for (const cond of c.enemy.conditions) {
    chipX += chip(ctx, chipX, 108, `${cond.kind.toUpperCase()} ${cond.level === 2 ? "II" : "I"} · ${cond.turns}`, C.glow) + 8;
  }

  // phase banner
  if (c.boss) {
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

    // part panel
    const panelX = 24;
    let py2 = 120;
    ctx.fillStyle = "rgba(6,18,28,0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX - 8, py2 - 26, 190, 4 * 54 + 30, 10);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillText("TARGET (up/down keys)", panelX, py2 - 8);
    for (const p of c.boss.parts) {
      const selected = ui.selectedPart === p.key;
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
      if (!p.broken) bar(ctx, panelX + 4, py2 + 20, 150, 8, p.durability / p.maxDurability, C.coral);
      py2 += 54;
    }
    if (c.analyzed) {
      ctx.fillStyle = C.biolum;
      ctx.font = "12px system-ui";
      ctx.fillText(`analyze: break the ${c.boss.keyPartByPhase[c.boss.phase]} to end this phase`, panelX, py2 + 4);
    }
  } else if (c.analyzed) {
    ctx.fillStyle = C.biolum;
    ctx.font = "13px system-ui";
    ctx.fillText(`analyze: ${c.enemy.analyzeHint} works best here`, 640, 140);
  }

  // turn pill: input is always the player's to give in this turn flow
  ctx.fillStyle = C.panel;
  ctx.strokeStyle = C.glow;
  ctx.beginPath();
  ctx.roundRect(cw / 2 - 70, c.boss ? 60 : 20, 140, 30, 15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.glow;
  ctx.font = "600 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("YOUR MOVE", cw / 2, c.boss ? 80 : 40);
  ctx.textAlign = "left";

  // aim confirm line (boss): what will a number key hit right now?
  if (c.boss) {
    ctx.fillStyle = ui.selectedPart ? C.glow : C.muted;
    ctx.font = "13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      ui.selectedPart
        ? `aiming at the ${ui.selectedPart.toUpperCase()}`
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

  ABILITY_ORDER.forEach((key, i) => {
    const a = ABILITIES[key];
    const x = 330 + i * 152;
    const canAfford = c.player.sta >= a.staCost && !(a.heals !== undefined && c.healSongUses <= 0);
    ctx.strokeStyle = canAfford ? C.line : "#152836";
    ctx.fillStyle = C.panel;
    ctx.beginPath();
    ctx.roundRect(x, ch - 92, 140, 64, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = canAfford ? C.ink : "#4a5c66";
    ctx.font = "600 13px system-ui";
    ctx.fillText(`${i + 1} ${a.name}`, x + 10, ch - 68);
    ctx.fillStyle = canAfford ? C.muted : "#3a4c56";
    ctx.font = "12px ui-monospace, monospace";
    const extra = a.heals !== undefined ? ` · ${c.healSongUses} left` : "";
    ctx.fillText(`${a.staCost} STA${extra}`, x + 10, ch - 46);
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

  if (ui.screen === "title") {
    water(ctx, cw, ch, C.mid);
    lightRays(ctx, cw, ch, ui.time);
    particles(ctx, cw, ch, ui.time, 0.7);
    fish(ctx, cw / 2 - 350, 190 + Math.sin(ui.time) * 12, 2.2, ui.time, 1);
    centered(ctx, "TIDESONG", 260, "900 84px system-ui", C.glow, cw);
    centered(ctx, "working title · the songs faded · follow the fragments", 300, "600 15px system-ui", C.muted, cw);
    centered(ctx, "click or press any key to begin", 420 + Math.sin(ui.time * 2) * 4, "16px system-ui", C.ink, cw);
    centered(ctx, "design Marc · art Glass_Goat (all visuals here are placeholders) · code ImmortalDemon", 660, "13px system-ui", C.muted, cw);
    return;
  }

  if (w.mode === "combat" && w.combat) renderCombat(ctx, w, ui, cw, ch);
  else renderExplore(ctx, w, ui, cw, ch);

  if (ui.deathFlash > 0) {
    ctx.fillStyle = `rgba(10,4,8,${Math.min(0.75, ui.deathFlash)})`;
    ctx.fillRect(0, 0, cw, ch);
    centered(ctx, "the sea reclaims you", ch / 2 - 12, "600 34px system-ui", C.danger, cw);
    centered(ctx, "waking at the last checkpoint...", ch / 2 + 24, "15px system-ui", C.muted, cw);
  }

  if (ui.screen === "pause") {
    ctx.fillStyle = "rgba(6,18,28,0.82)";
    ctx.fillRect(0, 0, cw, ch);
    centered(ctx, "PAUSED", 250, "700 46px system-ui", C.ink, cw);
    centered(ctx, "arrows/WASD swim · E talk · 1-6 abilities · up/down pick boss part", 320, "15px system-ui", C.muted, cw);
    centered(ctx, "SPACE pass turn · P resume · M mute", 350, "15px system-ui", C.muted, cw);
    return;
  }

  if (ui.screen === "victory" || w.mode === "victory") {
    ctx.fillStyle = "rgba(4,12,20,0.96)";
    ctx.fillRect(0, 0, cw, ch);
    centered(ctx, "the sea remembers its song", 230, "700 52px system-ui", C.glow, cw);
    centered(ctx, "both ruins stand quiet; the corruption recedes", 280, "17px system-ui", C.ink, cw);
    const frags = w.fragments.filter((f) => f.collected).length;
    centered(ctx, `memory fragments ${frags}/${w.fragments.length} · deaths ${w.deaths} · strokes ${w.steps}`, 340, "600 15px ui-monospace, monospace", C.muted, cw);
    centered(ctx, "TIDESONG (vertical slice)", 470, "600 20px system-ui", C.ink, cw);
    centered(ctx, "design and story · Marc", 505, "15px system-ui", C.muted, cw);
    centered(ctx, "art (everything you saw is a placeholder skeleton) · Glass_Goat", 530, "15px system-ui", C.muted, cw);
    centered(ctx, "code · ImmortalDemon", 555, "15px system-ui", C.muted, cw);
    centered(ctx, "R: swim it again", 620, "14px system-ui", C.glow, cw);
  }

  if (ui.muted) {
    ctx.fillStyle = C.muted;
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillText("MUTED (M)", cw - 96, 30);
  }
}
