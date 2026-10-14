"use client";

/**
 * Lightweight Web-Audio sound engine — no asset files.
 * Generates short tones/blips for game events. Respects the
 * `soundEnabled` setting (callers check before invoking).
 */

type SoundName =
  | "select"
  | "place"
  | "placeWrong"
  | "erase"
  | "note"
  | "undo"
  | "redo"
  | "hint"
  | "win"
  | "levelUp"
  | "tick"
  | "error";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

/** Resume the audio context (browsers suspend until a user gesture). */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}

interface ToneOpts {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
}

function playTone({ freq, duration, type = "sine", gain = 0.18, delay = 0, sweepTo }: ToneOpts) {
  const c = getCtx();
  if (!c) return;
  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);
  }
  // envelope: quick attack, soft release
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

const PATTERNS: Record<SoundName, ToneOpts[] | (() => ToneOpts[])> = {
  select: [{ freq: 520, duration: 0.04, type: "sine", gain: 0.05 }],
  place: [{ freq: 660, duration: 0.09, type: "triangle", gain: 0.14 }],
  placeWrong: [
    { freq: 220, duration: 0.12, type: "sawtooth", gain: 0.16 },
    { freq: 160, duration: 0.16, type: "sawtooth", gain: 0.16, delay: 0.08 },
  ],
  erase: [{ freq: 320, duration: 0.06, type: "sine", gain: 0.08, sweepTo: 180 }],
  note: [{ freq: 880, duration: 0.05, type: "sine", gain: 0.06 }],
  undo: [{ freq: 440, duration: 0.07, type: "sine", gain: 0.08, sweepTo: 300 }],
  redo: [{ freq: 300, duration: 0.07, type: "sine", gain: 0.08, sweepTo: 440 }],
  hint: [
    { freq: 740, duration: 0.1, type: "triangle", gain: 0.12 },
    { freq: 988, duration: 0.14, type: "triangle", gain: 0.12, delay: 0.09 },
  ],
  tick: [{ freq: 1000, duration: 0.02, type: "square", gain: 0.03 }],
  error: [
    { freq: 200, duration: 0.18, type: "sawtooth", gain: 0.18 },
    { freq: 150, duration: 0.22, type: "sawtooth", gain: 0.18, delay: 0.1 },
  ],
  win: () =>
    [523.25, 659.25, 783.99, 1046.5].map((f, i) => ({
      freq: f,
      duration: 0.18,
      type: "triangle" as OscillatorType,
      gain: 0.16,
      delay: i * 0.12,
    })),
  levelUp: () =>
    [523.25, 659.25, 783.99, 1046.5, 1318.51].map((f, i) => ({
      freq: f,
      duration: 0.2,
      type: "sine" as OscillatorType,
      gain: 0.15,
      delay: i * 0.1,
    })),
};

let enabled = true;
export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  const pattern = PATTERNS[name];
  const tones = typeof pattern === "function" ? pattern() : pattern;
  for (const t of tones) playTone(t);
}
