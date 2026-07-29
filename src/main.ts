import { abilityCast, classifyLogLine } from "./events";
import { Sound, type Mood } from "./audio";
import { chooseEnding, combatAction, combatPass, createWorld, enemySlot, interact, playerAct, step, type Dir, type WorldState } from "./world";
import { ABILITY_ORDER, CAST_TIME, render, type UIState } from "./render";
import type { PartKey } from "./game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = 1280;
canvas.height = 720;
const ctx = canvas.getContext("2d")!;

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

const sound = new Sound();
let world: WorldState = createWorld((Math.random() * 1e9) | 0);
let logCursor = 0;
let lastDeaths = 0;
let lastArea = world.area;

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
  castFx: [],
  attackAnim: undefined,
  enemyStrike: 0,
  playerFlinch: 0,
  buttonFlash: [0, 0, 0, 0, 0, 0],
  hitStop: 0,
  reducedMotion: false,
  beatPulse: 0,
};

function resetRun(): void {
  world = createWorld((Math.random() * 1e9) | 0);
  logCursor = 0;
  lastDeaths = 0;
  lastArea = world.area;
  victorySung = false;
  firstFightShown = false;
  barrierBannerShown = false;
  ui.animX = world.pos.x;
  ui.animY = world.pos.y;
  ui.selectedPart = undefined;
  ui.lastLines = [];
  ui.floaters = [];
  ui.storyCard = undefined;
  ui.victoryHold = undefined;
  ui.shake = 0;
  ui.enemyFlash = 0;
  ui.zoomPulse = 0;
  ui.enemyBeat = 0;
  ui.deathFlash = 0;
  ui.castFx = [];
  ui.attackAnim = undefined;
  ui.enemyStrike = 0;
  ui.playerFlinch = 0;
  ui.buttonFlash = [0, 0, 0, 0, 0, 0];
  ui.hitStop = 0;
  ui.bossIntro = undefined;
  ui.beatPulse = 0;
  ui.screen = "play";
}

// Drain new sim log lines: drive audio and the on-screen ticker from the
// same classifier G7's tests verify.
function drainLog(): void {
  let soundSlot = 0;
  let lastEv: string | null = null;
  let sawRestore = false;
  let sawMend = false;
  // same-drain floats spawn on separate lanes so a chorded moment (a
  // payoff plus a damage number) never overprints (panel 2 seat C HIGH)
  const lanes = { player: 0, enemy: 0 };
  const addFloater = (text: string, color: string, side: "player" | "enemy"): void => {
    ui.floaters.push({ text, color, age: 0, side, lane: lanes[side]++ });
  };
  while (logCursor < world.log.length) {
    const line = world.log[logCursor++];
    if (line.startsWith("combat:")) {
      ui.lastLines.length = 0; // fresh fight, fresh ticker
      heldDirs.clear(); // a key held into the fight must not walk you out of it
    }
    ui.lastLines.push(line);
    if (ui.lastLines.length > 6) ui.lastLines.shift();
    const ev = classifyLogLine(line);
    // per-ability identity: the cast line drives its own voice and effect
    // (the generic event tone yields for the same line so casts never
    // double-thunk); world-mode lines get no combat FX
    const cast = world.mode === "combat" || ui.victoryHold ? abilityCast(line) : null;
    if (cast) {
      sound.castVoice(cast, soundSlot * 0.12);
      soundSlot += 1;
      ui.castFx.push({ kind: cast, age: 0 });
      // every ability poses the fish differently now (played report:
      // "it always just moves forward a little")
      ui.attackAnim = { kind: cast, t: CAST_TIME };
    }
    // stagger chorded drains; dedupe immediate repeats (hunt, MED-8)
    if (ev && ev !== lastEv && !(cast && (ev === "hit" || ev === "note"))) {
      sound.play(ev, soundSlot * 0.12);
      soundSlot += 1;
    }
    lastEv = ev ?? lastEv;
    // a verse returns to the song: each fragment sings its phrase after
    // the pickup chime
    if (line.includes("memory fragment")) {
      sound.versePhrase(world.fragments.filter((f) => f.collected).length, 0.3);
    }

    // juice: floaters, shake, hit flash, parsed from the same lines
    const enemyHit = line.match(/hits (?:the \w+: |for )?(\d+)/) ?? line.match(/: (\d+) dmg/);
    if (line.includes("enemy hits for")) {
      const heavyHit = line.includes("(heavy)");
      ui.shake = heavyHit ? 0.85 : 0.5;
      ui.playerFlinch = heavyHit ? 0.5 : 0.35;
      ui.hitStop = reducedMotion ? 0 : heavyHit ? 0.09 : 0.06;
      if (heavyHit) {
        ui.zoomPulse = Math.max(ui.zoomPulse, 0.5);
        sound.play("rebuff", soundSlot * 0.12); // a deep thud under the hit
        soundSlot += 1;
      }
      addFloater(`-${line.match(/for (\d+)/)?.[1] ?? ""}${heavyHit ? "!" : ""}`, "#FF6B5D", "player");
    } else if (enemyHit && !line.startsWith("enemy")) {
      ui.enemyFlash = 0.3;
      if (!reducedMotion) ui.hitStop = Math.max(ui.hitStop, 0.04);
      addFloater(`-${enemyHit[1]}`, "#D8E9EE", "enemy");
    }
    if (line.includes(": dodged")) {
      addFloater("dodged", "#7FA0AC", "enemy");
    }
    // the pillar's payoff moments celebrate on screen, not just in a log
    // line: your blind made it miss, your slow made it skip, your bubble
    // held (fun diagnosis, agent 3 HIGH)
    if (line.includes("missed (blind)")) {
      addFloater("MISS · blinded", "#7FE8A9", "enemy");
    }
    if (line.includes("skips its action")) {
      addFloater("turn lost · slowed", "#7FE8A9", "enemy");
    }
    if (line.includes("Bubble absorbed")) {
      addFloater("absorbed", "#7FB8E8", "player");
    }
    // the ink squid's twist, both directions
    if (line.includes("ink takes your eyes")) {
      addFloater("INKED", "#8FA3E8", "player");
    }
    if (line.includes("goes wide (inked)")) {
      addFloater("wide", "#7FA0AC", "enemy");
    }
    if (line.includes("+2 STA") || line.includes("disable landed")) {
      addFloater("+2 STA", "#7FE8A9", "player");
    }
    if (line.includes("BREAKS") && (world.mode === "combat" || ui.victoryHold)) {
      ui.shake = 0.8;
      ui.zoomPulse = 0.9;
    }
    if (line.startsWith("combat:")) {
      ui.zoomPulse = 1.0;
      ui.bossIntro = undefined; // an arrival banner never outranks a fight
      if (!ui.bossIntro && !firstFightShown && !line.includes("corrupted")) {
        firstFightShown = true;
        const name = line.replace("combat: ", "").toUpperCase();
        const article = /^[AEIOU]/.test(name) ? "AN" : "A";
        ui.bossIntro = { title: `${article} ${name}`, sub: "something that forgot its own name", t: 1.8, dur: 1.8 };
      }
      if (line.startsWith("combat:")) firstFightShown = true;
      if (line.includes("corrupted shark") && !ui.bossIntro) {
        ui.bossIntro = { title: "THE CORRUPTED SHARK", sub: "guardian of the first ruin", t: 2.6, dur: 2.6 };
      } else if (line.includes("corrupted eel") && !ui.bossIntro) {
        ui.bossIntro = { title: "THE CORRUPTED EEL", sub: "it swallowed the name of the sea", t: 2.6, dur: 2.6 };
      } else if (line.includes("ink squid") && !ui.bossIntro) {
        // the validation playtest's one pre-11am ask: enemy type 2's
        // debut deserves more than a 12px intent token
        ui.bossIntro = { title: "AN INK SQUID", sub: "it takes your eyes the way the dark took its name", t: 2.2, dur: 2.2 };
      }
    }
    if (line.includes("missed") && !line.includes("missed (blind)")) {
      addFloater("miss", "#7FA0AC", "enemy");
    }
    const healedMatch = line.match(/Heal Song: \+(\d+)/);
    if (healedMatch) {
      addFloater(`+${healedMatch[1]}`, "#7FE8A9", "player");
    }
    // the story must be VISIBLE: fragment verses surface as a card in
    // exploration (found via sketch re-check: verses only reached the
    // combat-only log ticker, so the narrative pillar never displayed)
    const verse = line.match(/^memory fragment: "(.+)"$/);
    if (verse) {
      // the placeholder mark stays in the DATA for Marc; the card shows
      // the verse as a verse with a small tag instead (playtester: the
      // "(placeholder)" prefix made every story moment read as scaffolding)
      const clean = verse[1].replace(/^\(placeholder\) /, "");
      ui.storyCard = { text: clean, age: 0, kind: "story", ph: clean !== verse[1] };
    }
    // the song-seal puzzle speaks on screen, not into a hidden log
    // (hunt, HIGH-1); the merfolk line ages out instead of living forever
    // (hunt, MED-5); the relic award is announced (hunt, HIGH-2)
    if (line.includes("shoves you back")) {
      ui.storyCard = { text: "the current shoves you back: the first ruin's guardian holds the Tide Relic", age: 0, kind: "song" };
    }
    if (line.includes("song-seal") || line.includes("rings true") || line.includes("jars against") || line.includes("seal holds")) {
      ui.storyCard = { text: line, age: 0, kind: "song" };
    }
    const npc = line.match(/^npc: (.+)$/);
    if (npc) {
      const clean = npc[1].replace(/^\(placeholder\) /, "");
      ui.storyCard = { text: `"${clean}"`, age: 0, kind: "npc", ph: clean !== npc[1] };
    }
    if (line.includes("the low dark bites")) {
      ui.playerFlinch = 0.35; // the trench's red pulse in exploration
    }
    if (line.includes("(Heal Song restored)")) {
      sawRestore = true;
      ui.storyCard = { text: "the entrance current mends your song: Heal Song restored", age: 0, kind: "heal" };
    }
    if (line.includes("mends your wounds")) sawMend = true;
    if (line.includes("Tide Relic is yours")) {
      ui.storyCard = { text: `${line} · the wall to the east will part for you`, age: 0, kind: "relic" };
    }
  }
  if (world.deaths > lastDeaths) {
    lastDeaths = world.deaths;
    ui.deathFlash = 1.6;
    ui.storyCard = undefined; // stale cards do not outlive a death
    heldDirs.clear(); // the key you died holding must not walk the respawn
    // respawn teleports: the camera must snap, not glide across the map
    ui.animX = world.pos.x;
    ui.animY = world.pos.y;
  }
  if (world.area !== lastArea) {
    lastArea = world.area;
    // area transitions teleport too (user-found class: plays wrong vs
    // tests right; a lerp here slides the fish across the whole level)
    ui.animX = world.pos.x;
    ui.animY = world.pos.y;
    // the transition must be FELT (playtest: crossed two ruins without
    // noticing): momentum dies, stale cards clear, the place announces
    heldDirs.clear();
    areaGraceUntil = performance.now() + 500;
    ui.storyCard = undefined;
    const banners: Record<string, { title: string; sub: string }> = {
      hub: { title: "THE HUB REEF", sub: "the songs faded here first" },
      dungeon1: { title: "THE FIRST RUIN", sub: "the choir hall" },
      dungeon2: { title: "THE SECOND RUIN", sub: "the drowned gullet" },
    };
    const b = { ...banners[world.area] };
    // the first relic-bearing arrival at the second ruin IS the parting
    // moment (the separate banner lived 70ms before this one ate it)
    if (world.area === "dungeon2" && world.hasTideRelic && !barrierBannerShown) {
      barrierBannerShown = true;
      b.title = "THE CURRENT PARTS";
      b.sub = "the second ruin: the drowned gullet";
    }
    // the mend news rides the arrival banner instead of dying under it
    if (sawMend) b.sub += " · the current mends you";
    else if (sawRestore) b.sub += " · Heal Song restored";
    ui.bossIntro = { title: b.title, sub: b.sub, t: sawMend || sawRestore ? 2.2 : 1.6, dur: sawMend || sawRestore ? 2.2 : 1.6 };
  }
}

function cyclePart(dirn: 1 | -1): void {
  const parts = world.combat?.boss?.parts.filter((p) => !p.broken) ?? [];
  if (parts.length === 0) return;
  const keys = parts.map((p) => p.key);
  if (!ui.selectedPart) {
    // first press aims where the finger pointed: top for up, bottom for
    // down (playtest: the old wrap sent 'aim at the JAW' to the FIN)
    ui.selectedPart = dirn === -1 ? keys[0] : keys[keys.length - 1];
    return;
  }
  const idx = keys.indexOf(ui.selectedPart);
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
let areaGraceUntil = 0; // held keys do not walk you through a fresh transition
// raw keys, directions derived: two keys for one direction must not cancel
// each other on release (seat 1 LOW-7)
const heldKeys = new Set<string>();
const heldDirs = {
  get size(): number {
    return this.dirs().length;
  },
  dirs(): Dir[] {
    const out = new Set<Dir>();
    for (const k of heldKeys) {
      const d = MOVE_KEYS[k] ?? EXPLORE_VERTICAL[k];
      if (d) out.add(d);
    }
    return [...out];
  },
  add(_d: Dir, key?: string): void {
    if (key) heldKeys.add(key);
  },
  clear(): void {
    heldKeys.clear();
  },
};

function onKey(e: KeyboardEvent): void {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  sound.unlock(); // idempotent; also covers demo sessions that skip title
  if (ui.screen === "title") {
    ui.screen = "play";
    return;
  }
  if (k === "m") {
    ui.muted = sound.toggleMute();
    return;
  }
  if (k === "p") {
    // pause may never erase the victory screen (hunt, MED-4)
    if (world.mode === "victory") return;
    if (ui.screen === "play") ui.screen = "pause";
    else if (ui.screen === "pause") ui.screen = "play";
    return;
  }
  if (ui.screen === "pause") return;
  if (world.mode === "victory") {
    // R waits out the final SPENT hold: the climax must render (seat 1 MED-2)
    if (world.mode === "victory" && !world.ending && !ui.victoryHold) {
      // the last decision: answer it before the run can be replayed
      if (k === "1") chooseEnding(world, "sung");
      if (k === "2") chooseEnding(world, "released");
      return;
    }
    if (k === "r" && !ui.victoryHold) {
      resetRun();
      ui.screen = "title";
    }
    return;
  }
  if (world.mode === "combat") {
    if (k in MOVE_KEYS || k in EXPLORE_VERTICAL) {
      if (k === "ArrowUp" || k === "w") cyclePart(-1);
      if (k === "ArrowDown" || k === "s") cyclePart(1);
      return;
    }
    // input locks while the sea answers: the exchange must be watchable,
    // and a refused press acknowledges itself (panel 2 seat C LOW)
    if (ui.enemyBeat > 0 || ui.victoryHold) {
      if (ui.enemyBeat > 0) {
        ui.beatPulse = 0.3;
        sound.tick();
      }
      return;
    }
    const slot = Number.parseInt(k, 10);
    if (slot >= 1 && slot <= ABILITY_ORDER.length) {
      const before = world.combat;
      if (playerAct(world, ABILITY_ORDER[slot - 1], ui.selectedPart as PartKey | undefined)) {
        ui.buttonFlash[slot - 1] = 0.18;
        if (world.mode === "combat") {
          ui.enemyBeat = 0.55;
        } else {
          // hold the winning frame: the kill must be watchable (HIGH-2)
          if (before) ui.victoryHold = { combat: before, t: 1.1 };
          ui.selectedPart = undefined;
        }
      } else {
        // a refused input answers audibly instead of doing nothing (MED-7)
        sound.play("jar");
      }
    }
    if (k === " " && world.mode === "combat") ui.enemyBeat = 0.3;
    return;
  }
  // explore; the death veil and the victory hold suppress action
  if (ui.deathFlash > 0.8 || ui.victoryHold) return;
  const dir = MOVE_KEYS[k] ?? EXPLORE_VERTICAL[k];
  if (dir) {
    heldDirs.add(dir, k);
    // a deliberate fresh press is intent; only auto-repeat momentum
    // waits out the transition grace (round-2: taps died silently)
    if (!e.repeat) areaGraceUntil = 0;
  }
  if (k === "e") interact(world);
}

function onKeyUp(e: KeyboardEvent): void {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  heldKeys.delete(k);
}

window.addEventListener("keydown", onKey);
window.addEventListener("keyup", onKeyUp);
// Combat is clickable per DESIGN ("clickable ability buttons plus 1 to 6
// hotkeys"; G8 round 2 F1: a mouse-first player could not act at all).
// Clicks route through the exact same beat-locked path as the hotkeys.
function combatClick(cx: number, cy: number): void {
  if (ui.screen !== "play" || world.mode !== "combat" || !world.combat) return;
  const ch = canvas.height;
  // ability cards: x = 330 + i*152, y = ch-92, 140x64 (matches render.ts)
  if (cy >= ch - 92 && cy <= ch - 28) {
    for (let i = 0; i < ABILITY_ORDER.length; i++) {
      const x = 330 + i * 152;
      if (cx >= x && cx <= x + 140) {
        if (ui.enemyBeat > 0 || ui.victoryHold) {
          if (ui.enemyBeat > 0) {
            ui.beatPulse = 0.3;
            sound.tick();
          }
          return;
        }
        const before = world.combat;
        if (playerAct(world, ABILITY_ORDER[i], ui.selectedPart as PartKey | undefined)) {
          ui.buttonFlash[i] = 0.18;
          if (world.mode === "combat") {
            ui.enemyBeat = 0.55;
          } else {
            if (before) ui.victoryHold = { combat: before, t: 1.1 };
            ui.selectedPart = undefined;
          }
        } else {
          sound.play("jar");
        }
        return;
      }
    }
  }
  // boss part panel rows: x 16..206, rows at y = 120 + i*54 (height 44)
  if (world.combat.boss && cx >= 16 && cx <= 206) {
    world.combat.boss.parts.forEach((part, i) => {
      const rowY = 120 + i * 54 - 4;
      if (cy >= rowY && cy <= rowY + 44 && !part.broken) {
        ui.selectedPart = part.key;
      }
    });
  }
}

canvas.addEventListener("pointerdown", (e) => {
  // unconditional and idempotent, like keydown: a mouse-only session
  // (incl. ?demo= review sessions that skip the title) still gets sound
  sound.unlock();
  if (ui.screen === "title") {
    ui.screen = "play";
    return;
  }
  // mouse parity for the non-combat states (seat 1 LOW-6)
  if (ui.screen === "pause") {
    if (world.mode !== "victory") ui.screen = "play";
    return;
  }
  if (world.mode === "victory" && !ui.victoryHold) {
    if (!world.ending) {
      // click a card: left card sings, right card releases
      const rect0 = canvas.getBoundingClientRect();
      const cx0 = ((e.clientX - rect0.left) / rect0.width) * canvas.width;
      const cy0 = ((e.clientY - rect0.top) / rect0.height) * canvas.height;
      if (cy0 >= 288 && cy0 <= 420) {
        if (cx0 >= canvas.width / 2 - 300 && cx0 <= canvas.width / 2 - 20) chooseEnding(world, "sung");
        else if (cx0 >= canvas.width / 2 + 20 && cx0 <= canvas.width / 2 + 300) chooseEnding(world, "released");
      }
      return;
    }
    resetRun();
    ui.screen = "title";
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
  combatClick(cx, cy);
});
window.addEventListener("blur", () => {
  // stale held keys auto-walked the fish after alt-tab (hunt, HIGH-3)
  heldDirs.clear();
  if (ui.screen === "play" && world.mode !== "victory") ui.screen = "pause";
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
  } else if (demo === "choice") {
    world.mode = "victory";
    world.fragments[0].collected = true;
    world.fragments[2].collected = true;
    world.fragments[4].collected = true;
    ui.screen = "play";
  } else if (demo === "sung") {
    world.mode = "victory";
    for (const f of world.fragments) f.collected = true;
    world.ending = "sung";
    ui.screen = "play";
  } else if (demo === "released") {
    world.mode = "victory";
    world.fragments[0].collected = true;
    world.fragments[1].collected = true;
    world.ending = "released";
    ui.screen = "play";
  } else if (demo === "song") {
    world.fragments[0].collected = true;
    world.fragments[1].collected = true;
    world.fragments[3].collected = true;
    ui.screen = "pause";
  } else if (demo === "bossp2") {
    world.area = "dungeon1";
    for (const e of world.encounters) if (e.kind === "squid") e.defeated = true;
    world.pos = { x: 20, y: 4 };
    world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
    step(world, "right");
    if (world.combat?.boss) {
      // break the jaw with direct durability writes so the staged shot
      // lands mid phase 2 deterministically
      const jaw = world.combat.boss.parts.find((pt) => pt.key === "jaw")!;
      while (!jaw.broken && world.combat.outcome === "ongoing") {
        world.combat.player.sta = world.combat.player.maxSta;
        world.combat.player.hp = world.combat.player.maxHp;
        combatAction(world, "tailStrike", "jaw");
      }
      ui.selectedPart = "eye";
    }
  } else if (demo === "bossintro") {
    world.area = "dungeon1";
    for (const e of world.encounters) if (e.kind === "squid") e.defeated = true;
    world.pos = { x: 20, y: 4 };
    world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
    step(world, "right");
    ui.bossIntro = { title: "THE CORRUPTED SHARK", sub: "guardian of the first ruin", t: 299, dur: 300 };
  } else if (demo === "ink") {
    world.hasTideRelic = true;
    world.area = "dungeon2";
    for (const e of world.encounters) if (e.kind !== "ink") e.defeated = true;
    world.pos = { x: 13, y: 4 };
    world.checkpoint = { area: "dungeon2", pos: { x: 1, y: 4 } };
    step(world, "right");
    if (world.combat) {
      combatAction(world, "tailStrike");
      // show the twist: the player inked, the veil down, the chip up
      world.combat.player.conditions.push({ kind: "blind", level: 1, turns: 2 });
      world.log.push("the ink takes your eyes: YOU are blinded");
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
    const npcLine = world.npcLine ?? "";
    const cleanNpc = npcLine.replace(/^\(placeholder\) /, "");
    if (cleanNpc) ui.storyCard = { text: `"${cleanNpc}"`, age: 0, kind: "npc", ph: cleanNpc !== npcLine };
  } else if (demo === "pause") {
    ui.screen = "pause";
  } else if (demo === "defeat") {
    ui.deathFlash = 1.1;
  } else if (demo === "dungeon2") {
    world.hasTideRelic = true;
    world.area = "dungeon2";
    world.pos = { x: 4, y: 4 };
    world.checkpoint = { area: "dungeon2", pos: { x: 1, y: 4 } };
  } else if (demo === "doorcard") {
    world.pos = { x: 11, y: 2 };
    interact(world);
    const hum = world.log.find((l) => l.includes("song-seal door hums"));
    if (hum) ui.storyCard = { text: hum, age: 0, kind: "song" };
  } else if (demo === "fragment") {
    world.pos = { x: 6, y: 5 };
    step(world, "right");
    // the demo logCursor guard skips drainLog, so surface the card
    // directly THROUGH the same strip+tag treatment players see
    // (panel 2: the gallery showed raw scaffolding the game never shows)
    const verse = world.fragments.find((f) => f.collected)?.verse;
    if (verse) {
      const clean = verse.replace(/^\(placeholder\) /, "");
      ui.storyCard = { text: clean, age: 0, kind: "story", ph: clean !== verse };
    }
  } else if (demo === "trench") {
    world.pos = { x: 13, y: 6 };
    step(world, "down");
  }
  ui.animX = world.pos.x;
  ui.animY = world.pos.y;
  lastArea = world.area;
  logCursor = world.log.length;
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


let last = performance.now();
let victorySung = false; // one-shot: the reassembled song plays once
let firstFightShown = false; // the first regular fight announces itself once
let barrierBannerShown = false; // the wall parting announces itself once
let virtualClock = false; // filmstrip mode: no self-rescheduling
function frame(now: number): void {
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  ui.reducedMotion = reducedMotion;
  // hit-stop: impacts freeze the presentation for a few frames so they
  // carry weight; the world clock is untouched (fun diagnosis)
  if (ui.hitStop > 0) {
    ui.hitStop = Math.max(0, ui.hitStop - dt);
    dt = 0;
  }
  ui.time += reducedMotion ? dt * 0.25 : dt;
  // the pad follows the state of play: explore calm, combat driving, boss
  // menace (tighter in phase 2), victory resolve; collected fragments add
  // harmony voices (the song returns). Held wins keep their fight's mood.
  if (!ui.victoryHold) {
    const mood: Mood =
      world.mode === "victory" || ui.screen === "victory"
        ? "victory"
        : world.mode === "combat"
          ? world.combat?.boss
            ? "boss"
            : "combat"
          : "explore";
    sound.setMood(mood, world.fragments.filter((f) => f.collected).length, world.combat?.boss?.phase === 2 ? 1 : 0);
  }
  // a victory can land while paused (blur mid-beat): normalize here, in
  // the state-owning loop, never in the renderer
  if (ui.screen === "pause" && world.mode === "victory") ui.screen = "play";
  // the payoff the fragments promised, HEARD: on the victory screen the
  // collected verses play back in order as one reassembled song
  if (world.mode === "victory" && world.ending === "sung" && !ui.victoryHold && !victorySung && sound.unlocked) {
    victorySung = true;
    const count = world.fragments.filter((f) => f.collected).length;
    for (let i = 1; i <= count; i++) sound.versePhrase(i, 0.8 + (i - 1) * 1.1);
  }
  // presentation freezes with the game: nothing decays while paused (MED-9)
  const live = ui.screen === "play";
  if (live && ui.deathFlash > 0) ui.deathFlash = Math.max(0, ui.deathFlash - dt * 0.7);
  if (live && ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt * (reducedMotion ? 8 : 2.2));
  if (live && ui.zoomPulse > 0) ui.zoomPulse = Math.max(0, ui.zoomPulse - dt * (reducedMotion ? 10 : 1.8));
  if (live && ui.victoryHold) {
    ui.victoryHold.t -= dt * (reducedMotion ? 3 : 1);
    if (ui.victoryHold.t <= 0) ui.victoryHold = undefined;
  }
  // the exchange freezes with the game: no enemy beat while paused
  if (ui.enemyBeat > 0 && ui.screen === "play") {
    ui.enemyBeat = Math.max(0, ui.enemyBeat - dt * (reducedMotion ? 3 : 1));
    if (ui.enemyBeat === 0 && world.mode === "combat") {
      ui.enemyStrike = 0.22; // the lunge snap lands with the resolution
      enemySlot(world);
      if (world.mode !== "combat") ui.selectedPart = undefined;
    }
  }
  if (ui.enemyFlash > 0) ui.enemyFlash = Math.max(0, ui.enemyFlash - dt * 2.5);
  if (live) {
    if (ui.attackAnim) {
      ui.attackAnim.t -= dt;
      if (ui.attackAnim.t <= 0) ui.attackAnim = undefined;
    }
    if (ui.enemyStrike > 0) ui.enemyStrike = Math.max(0, ui.enemyStrike - dt);
    if (ui.beatPulse > 0) ui.beatPulse = Math.max(0, ui.beatPulse - dt);
    if (ui.bossIntro) {
      ui.bossIntro.t -= dt * (reducedMotion ? 3 : 1);
      if (ui.bossIntro.t <= 0) ui.bossIntro = undefined;
    }
    if (ui.playerFlinch > 0) ui.playerFlinch = Math.max(0, ui.playerFlinch - dt);
    for (let i = 0; i < ui.buttonFlash.length; i++) {
      if (ui.buttonFlash[i] > 0) ui.buttonFlash[i] = Math.max(0, ui.buttonFlash[i] - dt);
    }
    for (const fx of ui.castFx) fx.age += dt;
    ui.castFx = ui.castFx.filter((fx) => fx.age < 0.65);
    for (const f of ui.floaters) f.age += dt;
    ui.floaters = ui.floaters.filter((f) => f.age < 1.3);
    if (ui.storyCard && world.mode === "explore" && !ui.victoryHold) {
      ui.storyCard.age += dt;
      if (ui.storyCard.age > 6) ui.storyCard = undefined;
    }
  }

  if (
    ui.screen === "play" &&
    world.mode === "explore" &&
    !ui.victoryHold &&
    ui.deathFlash <= 0.8 &&
    heldDirs.size > 0 &&
    now - lastMoveAt > 130 &&
    now > areaGraceUntil
  ) {
    lastMoveAt = now;
    const dirsNow = heldDirs.dirs();
    step(world, dirsNow[dirsNow.length - 1]);
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
if (filmstrip === "click") {
  // mouse-play verification: a REAL PointerEvent at the Silt Burst card's
  // on-screen position, through the real handler (G8-2 instrument gap)
  virtualClock = true;
  last = 0;
  world = createWorld(7);
  ui.screen = "play";
  world.area = "dungeon1";
  lastArea = world.area; // no arrival banner over the strip (final panel)
  world.pos = { x: 7, y: 4 };
  world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
  step(world, "right");
  logCursor = world.log.length;
  const snaps3: { label: string; img: HTMLCanvasElement }[] = [];
  const snap3 = (label: string) => {
    const c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    c.getContext("2d")!.drawImage(canvas, 0, 0);
    const m = `[sta=${world.combat?.player.sta ?? "-"} beat=${ui.enemyBeat.toFixed(2)} blind=${world.combat?.enemy.conditions.length ?? 0}]`;
    snaps3.push({ label: `${label} ${m}`, img: c });
  };
  let vt3 = 0;
  const adv3 = (target: number) => {
    while (vt3 < target) {
      vt3 = Math.min(target, vt3 + 80);
      frame(vt3);
    }
  };
  const clickCanvasAt = (cx: number, cy: number) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + (cx / canvas.width) * rect.width,
        clientY: rect.top + (cy / canvas.height) * rect.height,
        bubbles: true,
      }),
    );
  };
  frame(0);
  snap3("t=0 before any input");
  clickCanvasAt(330 + 1 * 152 + 70, canvas.height - 60); // Silt Burst card center
  adv3(16);
  snap3("t=16ms CLICKED Silt Burst: acted via mouse");
  adv3(920);
  snap3("t=920ms the sea answered the mouse action");
  ctx.fillStyle = "#06121C";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  snaps3.forEach((sn, i) => {
    const y = i * (canvas.height / 3);
    ctx.drawImage(sn.img, canvas.width * 0.17, y + 2, canvas.width * 0.66, canvas.height / 3 - 4);
    ctx.strokeStyle = "#35C8D6";
    ctx.strokeRect(canvas.width * 0.17, y + 2, canvas.width * 0.66, canvas.height / 3 - 4);
    ctx.fillStyle = "#0B1D2A";
    ctx.fillRect(canvas.width * 0.17 + 4, y + 6, 640, 22);
    ctx.fillStyle = "#D8E9EE";
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillText(sn.label, canvas.width * 0.17 + 10, y + 22);
  });
} else if (filmstrip === "kill") {
  // the win edge as played: the kill must hold on screen (HIGH-2 proof)
  virtualClock = true;
  last = 0;
  world = createWorld(7);
  ui.screen = "play";
  world.area = "dungeon1";
  lastArea = world.area; // no arrival banner over the strip (final panel)
  world.pos = { x: 7, y: 4 };
  world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
  step(world, "right");
  if (world.combat) {
    world.combat.enemy.hp = 8;
    world.combat.enemy.dodge = 0; // deterministic kill: the first strip run rolled a dodge
  }
  logCursor = world.log.length;
  const snaps2: { label: string; img: HTMLCanvasElement }[] = [];
  const snap2 = (label: string) => {
    const c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    c.getContext("2d")!.drawImage(canvas, 0, 0);
    // labels MEASURE state instead of asserting it: the first strip run
    // claimed a hold that a dodge roll had prevented
    const measured = `mode=${world.mode} hold=${ui.victoryHold ? "yes" : "no"}`;
    snaps2.push({ label: `${label}  [${measured}]`, img: c });
  };
  let vt2 = 0;
  const adv2 = (target: number) => {
    while (vt2 < target) {
      vt2 = Math.min(target, vt2 + 80);
      frame(vt2);
    }
  };
  frame(0);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
  adv2(16);
  snap2("t=16ms killing blow lands: SPENT banner holds the combat frame");
  adv2(600);
  snap2("t=600ms still held: the kill is watchable");
  adv2(1400);
  snap2("t=1400ms the hold releases: back to exploration");
  ctx.fillStyle = "#06121C";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  snaps2.forEach((sn, i) => {
    const y = i * (canvas.height / 3);
    ctx.drawImage(sn.img, canvas.width * 0.17, y + 2, canvas.width * 0.66, canvas.height / 3 - 4);
    ctx.strokeStyle = "#35C8D6";
    ctx.strokeRect(canvas.width * 0.17, y + 2, canvas.width * 0.66, canvas.height / 3 - 4);
    ctx.fillStyle = "#0B1D2A";
    ctx.fillRect(canvas.width * 0.17 + 4, y + 6, 620, 22);
    ctx.fillStyle = "#D8E9EE";
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillText(sn.label, canvas.width * 0.17 + 10, y + 22);
  });
} else if (filmstrip === "combat") {
  virtualClock = true;
  last = 0;
  world = createWorld(7);
  ui.screen = "play";
  world.area = "dungeon1";
  lastArea = world.area; // no arrival banner over the strip (final panel)
  world.pos = { x: 7, y: 4 };
  world.checkpoint = { area: "dungeon1", pos: { x: 1, y: 4 } };
  step(world, "right"); // trigger the squid: real encounter path
  ui.animX = world.pos.x;
  ui.animY = world.pos.y;
  lastArea = world.area;
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
  const m = () => `[hp=${world.combat?.player.hp ?? "-"} beat=${ui.enemyBeat.toFixed(2)} blind=${world.combat?.enemy.conditions.map((c) => c.kind + c.turns).join(",") || "none"}]`;
  frame(0);
  snap(`t=0 your move ${m()}`);
  press("2"); // Silt Burst through the real handler
  advanceTo(16);
  snap(`t=16ms you acted ${m()}`);
  advanceTo(320);
  snap(`t=320ms sea answer pending ${m()}`);
  advanceTo(920);
  snap(`t=920ms after the answer ${m()}`);

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
