// Tiny WebAudio synth: 7 events, mute toggle, master gain 0.16 so nothing
// clips. Context unlocks on the title-card click (the TRUNK! lesson).
// Musical quality is explicitly UNVERIFIED by machine; wiring is verified
// via src/events.ts.

import type { GameEvent } from "./events";

export class Sound {
  private ctx: AudioContext | null = null;
  private padTimer: ReturnType<typeof setInterval> | null = null;
  private padStep = 0;
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.startPad();
  }

  // The faded song, returning: a slow four-note pad on a pentatonic drift.
  // Gain 0.35 of the 0.16 master: far under any clipping, under the SFX.
  private startPad(): void {
    if (this.padTimer) return;
    const notes = [220, 261.6, 329.6, 293.7, 261.6, 196];
    this.padTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = notes[this.padStep % notes.length];
      this.padStep += 1;
      this.tone(f, 2.6, "sine", 0.35);
      this.tone(f / 2, 2.6, "sine", 0.22);
    }, 2200);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(gain * 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  play(event: GameEvent): void {
    switch (event) {
      case "hit":
        this.tone(170, 0.09, "square", 0.9, 120);
        break;
      case "disable":
        this.tone(420, 0.07, "triangle", 0.9);
        this.tone(640, 0.12, "triangle", 0.7);
        break;
      case "phaseBreak":
        this.tone(300, 0.35, "sawtooth", 1.0, 60);
        break;
      case "pickup":
        this.tone(880, 0.12, "sine", 0.8, 1320);
        break;
      case "death":
        this.tone(220, 0.6, "sawtooth", 0.9, 40);
        break;
      case "rebuff":
        this.tone(90, 0.18, "sine", 1.0, 60);
        break;
      case "victory":
        this.tone(523, 0.14, "triangle", 0.8);
        this.tone(659, 0.2, "triangle", 0.8);
        this.tone(784, 0.34, "triangle", 0.9);
        break;
    }
  }
}
