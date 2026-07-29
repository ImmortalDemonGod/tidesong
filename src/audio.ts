// Tiny WebAudio synth: classified events, per-ability cast voices, and a
// mood-aware pad, mute toggle, master gain 0.16 so nothing clips. Context
// unlocks on the first input (the TRUNK! lesson). Musical quality is
// explicitly UNVERIFIED by machine; wiring is verified via src/events.ts.

import type { GameEvent } from "./events";

export type Mood = "explore" | "combat" | "boss" | "victory";

// The faded song, returning: each mood is a note table + tick period. The
// boss tables sit lower and tighter so the fight reads as menace; combat
// drives faster than exploration; victory resolves warm.
const PADS: Record<Mood, { notes: number[]; period: number; drive: boolean }> = {
  explore: { notes: [220, 261.6, 329.6, 293.7, 261.6, 196], period: 2200, drive: false },
  combat: { notes: [196, 233.1, 293.7, 261.6, 220], period: 1500, drive: true },
  boss: { notes: [174.6, 207.7, 246.9, 220, 164.8], period: 1050, drive: true },
  victory: { notes: [261.6, 329.6, 392, 523.3], period: 1900, drive: false },
};

// Pentatonic pool for the fragment verse phrases: each fragment sings a
// different 4-note line (placeholder melodies; Marc's verses will replace
// the words, these give them a voice tonight).
const VERSE_POOL = [392, 440, 523.3, 587.3, 659.3, 784];

export class Sound {
  private ctx: AudioContext | null = null;
  private padTimer: ReturnType<typeof setInterval> | null = null;
  private padStep = 0;
  private mood: Mood = "explore";
  private intensity = 0; // boss phase 2 tightens the pad
  private fragments = 0; // collected verses add harmony voices to the pad
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.startPad();
  }

  // The song literally returns: collected fragments layer harmony voices
  // over the pad, and moods reshape it (the playtester asked why the music
  // never changes at the boss; now it does).
  setMood(mood: Mood, fragments: number, intensity = 0): void {
    const changed = mood !== this.mood || intensity !== this.intensity;
    this.mood = mood;
    this.intensity = intensity;
    this.fragments = fragments;
    if (changed && this.padTimer) {
      clearInterval(this.padTimer);
      this.padTimer = null;
      this.startPad();
    }
  }

  private startPad(): void {
    if (this.padTimer || !this.ctx) return;
    const pad = PADS[this.mood];
    const period = this.intensity > 0 ? Math.round(pad.period * 0.8) : pad.period;
    this.padTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const pd = PADS[this.mood];
      const f = pd.notes[this.padStep % pd.notes.length];
      this.padStep += 1;
      this.tone(f, 2.4, "sine", 0.35);
      this.tone(f / 2, 2.4, "sine", 0.22);
      // harmony voices: one per act of restoration, capped and quiet
      if (this.fragments >= 1) this.tone(f * 1.5, 2.2, "sine", 0.12, undefined, 0.05);
      if (this.fragments >= 3) this.tone(f * 2, 2.0, "sine", 0.09, undefined, 0.1);
      if (this.fragments >= 5) this.tone(f * 3, 1.8, "sine", 0.06, undefined, 0.15);
      // the drive pulse under fights: a low heartbeat, heavier at bosses
      if (pd.drive) {
        const pf = this.mood === "boss" ? 55 : 73.4;
        this.tone(pf, 0.14, "triangle", this.mood === "boss" ? 0.5 : 0.3);
        if (this.intensity > 0) this.tone(pf, 0.12, "triangle", 0.4, undefined, period / 2000);
      }
    }, period);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    // silence already-scheduled tones too (played-experience hunt, LOW-13)
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
    return this.muted;
  }

  private master: GainNode | null = null;

  private out(): AudioNode {
    if (!this.ctx) throw new Error("no ctx");
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    }
    return this.master;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(gain * 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.out());
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Every ability has its own voice (the playtester's "abilities don't
  // feel distinct"): a thunk is not a hiss is not a song.
  castVoice(ability: string, delay = 0): void {
    switch (ability) {
      case "tailStrike": // punchy double thunk
        this.tone(150, 0.08, "square", 1.0, 90, delay);
        this.tone(300, 0.05, "square", 0.4, undefined, delay + 0.03);
        break;
      case "siltBurst": // sandy falling shimmer
        this.tone(1200, 0.25, "triangle", 0.5, 300, delay);
        this.tone(1450, 0.22, "triangle", 0.35, 380, delay + 0.02);
        break;
      case "finSlash": // rising swish
        this.tone(300, 0.12, "sawtooth", 0.55, 900, delay);
        break;
      case "healSong": // an actual song: three rising notes
        this.tone(392, 0.16, "sine", 0.8, undefined, delay);
        this.tone(523.3, 0.16, "sine", 0.8, undefined, delay + 0.14);
        this.tone(659.3, 0.24, "sine", 0.9, undefined, delay + 0.28);
        break;
      case "analyze": // clean high ping
        this.tone(990, 0.1, "sine", 0.7, 1320, delay);
        break;
      case "bubble": // soft blub and swell
        this.tone(320, 0.18, "sine", 0.8, 160, delay);
        this.tone(480, 0.1, "sine", 0.4, 240, delay + 0.06);
        break;
    }
  }

  // A fragment's verse, sung: a deterministic 4-note line per collection
  // count, drawn from the pentatonic pool the pad harmonies use.
  versePhrase(count: number, delay = 0): void {
    for (let i = 0; i < 4; i++) {
      const n = VERSE_POOL[(count * 2 + i * (1 + (count % 3))) % VERSE_POOL.length];
      this.tone(n, 0.22, "sine", 0.7, undefined, delay + i * 0.17);
    }
  }

  // a quiet acknowledgment for inputs refused during the answer beat:
  // audible, but nothing like the jar (which means "you cannot afford")
  tick(): void {
    this.tone(520, 0.04, "sine", 0.3);
  }

  // delay staggers chorded drains so climaxes read as a phrase, not mush
  play(event: GameEvent, delay = 0): void {
    switch (event) {
      case "hit":
        this.tone(170, 0.09, "square", 0.9, 120, delay);
        break;
      case "disable":
        this.tone(420, 0.07, "triangle", 0.9, undefined, delay);
        this.tone(640, 0.12, "triangle", 0.7, undefined, delay + 0.05);
        break;
      case "payoff": // your condition paid: a bright triumphant pair
        this.tone(587.3, 0.1, "triangle", 0.9, undefined, delay);
        this.tone(880, 0.16, "triangle", 0.9, undefined, delay + 0.08);
        break;
      case "phaseBreak":
        this.tone(300, 0.35, "sawtooth", 1.0, 60, delay);
        break;
      case "pickup":
        this.tone(880, 0.12, "sine", 0.8, 1320, delay);
        break;
      case "death":
        this.tone(220, 0.6, "sawtooth", 0.9, 40, delay);
        break;
      case "rebuff":
        this.tone(90, 0.18, "sine", 1.0, 60, delay);
        break;
      case "note":
        this.tone(660, 0.14, "sine", 0.8, 880, delay);
        break;
      case "jar":
        this.tone(180, 0.16, "square", 0.7, 90, delay);
        break;
      case "victory":
        this.tone(523, 0.14, "triangle", 0.8, undefined, delay);
        this.tone(659, 0.2, "triangle", 0.8, undefined, delay + 0.12);
        this.tone(784, 0.34, "triangle", 0.9, undefined, delay + 0.26);
        break;
    }
  }
}
