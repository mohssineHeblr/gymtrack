"use client";

import type { AlarmSound } from "./types";

/**
 * Rest-timer alarm sounds, synthesised with the Web Audio API (no audio files to download).
 *
 * iOS notes: audio only plays after the AudioContext was unlocked by a user gesture, it is
 * muted by the ring/silent switch, and it can NOT play while the PWA is suspended in the
 * background or the screen is locked. Background alerts rely on notifications instead.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx && Ctx) ctx = new Ctx();
    if (ctx?.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a user gesture (tap) once so iOS allows sound later. */
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  // A silent, very short buffer fully unlocks output on older iOS versions.
  try {
    const b = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

export const audioUnlocked = () => ctx?.state === "running";

function tone(c: AudioContext, opts: { freq: number; start: number; dur: number; type?: OscillatorType; gain: number; attack?: number }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.value = opts.freq;
  const t = c.currentTime + opts.start;
  const peak = Math.max(0.0002, opts.gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + opts.dur + 0.05);
}

/** Bell-like strike made of inharmonic partials */
function strike(c: AudioContext, freq: number, start: number, vol: number, dur = 1.6) {
  [
    [1, 1],
    [2.76, 0.45],
    [5.4, 0.22],
    [8.93, 0.1],
  ].forEach(([ratio, amp]) => tone(c, { freq: freq * ratio, start, dur: dur / ratio ** 0.3, gain: vol * amp, attack: 0.004 }));
}

const SOUNDS: Record<AlarmSound, (c: AudioContext, vol: number) => void> = {
  beep: (c, v) => {
    for (let i = 0; i < 3; i++) tone(c, { freq: i === 2 ? 1320 : 880, start: i * 0.3, dur: 0.22, gain: 0.45 * v });
  },
  chime: (c, v) => {
    [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, { freq: f, start: i * 0.16, dur: 1.1, gain: 0.32 * v, attack: 0.006 }));
  },
  bell: (c, v) => {
    strike(c, 523.25, 0, 0.5 * v, 2.2);
    strike(c, 523.25, 0.9, 0.4 * v, 2);
  },
  digital: (c, v) => {
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 2; i++) tone(c, { freq: 2093, start: r * 0.5 + i * 0.12, dur: 0.08, type: "square", gain: 0.16 * v, attack: 0.002 });
  },
  boxing: (c, v) => {
    for (let i = 0; i < 3; i++) strike(c, 740, i * 0.22, 0.42 * v, 1.2);
  },
};

export function playAlarm(sound: AlarmSound, volume = 0.8) {
  const c = getCtx();
  if (!c) return false;
  try {
    (SOUNDS[sound] ?? SOUNDS.beep)(c, Math.min(1, Math.max(0.05, volume)));
    return true;
  } catch {
    return false;
  }
}

export const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function vibrate(pattern: number[] = [250, 120, 250, 120, 400]) {
  try {
    if (canVibrate()) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
