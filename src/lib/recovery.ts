import { MUSCLES, MUSCLE_INFO, musclesFor, type Muscle } from "@/data/muscles";
import type { Exercise, Workout } from "./types";

/**
 * Muscle recovery model.
 *
 * Every completed working set adds fatigue to the muscles it trains (100% to
 * primary movers, 50% to secondary). Fatigue fades linearly over the muscle's
 * recovery window (36–72 h). Fatigue is capped at 100%; recovery = 100 − fatigue.
 */

/** Fatigue (in %) added by one hard working set to a primary muscle. */
const SET_FATIGUE: Record<"large" | "small", number> = { large: 11, small: 14 };
const SECONDARY_FACTOR = 0.5;

export interface MuscleRecovery {
  muscle: Muscle;
  /** 0–100, where 100 means fully recovered */
  recovery: number;
  /** Hours until ~fully recovered (0 if fresh) */
  hoursLeft: number;
  lastTrained: string | null;
}

export type RecoveryMap = Record<Muscle, MuscleRecovery>;

export function computeRecovery(
  workouts: Workout[],
  getExercise: (id: string) => Pick<Exercise, "id" | "muscleGroup"> | undefined,
  now: number = Date.now(),
): RecoveryMap {
  const fatigue = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  const remaining = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  const last = Object.fromEntries(MUSCLES.map((m) => [m, null])) as Record<Muscle, string | null>;
  const horizon = now - 4 * 24 * 3600 * 1000;

  for (const w of workouts) {
    const t = new Date(w.finishedAt ?? w.startedAt).getTime();
    for (const we of w.exercises) {
      const ex = getExercise(we.exerciseId);
      if (!ex) continue;
      const sets = we.sets.filter((s) => s.completed && s.type !== "warmup").length;
      if (!sets) continue;
      const targets = musclesFor(ex);
      const apply = (m: Muscle, factor: number) => {
        if (!last[m] || w.startedAt > last[m]!) last[m] = w.startedAt;
        if (t < horizon) return;
        const info = MUSCLE_INFO[m];
        const hours = (now - t) / 3_600_000;
        const left = info.recoveryHours - hours;
        if (left <= 0) return;
        fatigue[m] += sets * SET_FATIGUE[info.size] * factor * (left / info.recoveryHours);
        remaining[m] = Math.max(remaining[m], left);
      };
      targets.primary.forEach((m) => apply(m, 1));
      targets.secondary.forEach((m) => apply(m, SECONDARY_FACTOR));
    }
  }

  return Object.fromEntries(
    MUSCLES.map((m) => {
      const recovery = Math.round(100 - Math.min(100, fatigue[m]));
      return [m, { muscle: m, recovery, hoursLeft: recovery >= 95 ? 0 : Math.ceil(remaining[m]), lastTrained: last[m] }];
    }),
  ) as RecoveryMap;
}

export type RecoveryLevel = "fresh" | "ready" | "recovering" | "fatigued";

export function recoveryLevel(r: number): RecoveryLevel {
  if (r >= 90) return "fresh";
  if (r >= 70) return "ready";
  if (r >= 40) return "recovering";
  return "fatigued";
}

export const LEVEL_LABEL: Record<RecoveryLevel, string> = {
  fresh: "Fresh",
  ready: "Ready",
  recovering: "Recovering",
  fatigued: "Fatigued",
};

/** CSS color per level (fresh → accent, fatigued → danger) */
export const LEVEL_COLOR: Record<RecoveryLevel, string> = {
  fresh: "var(--accent)",
  ready: "color-mix(in srgb, var(--accent) 55%, var(--warn))",
  recovering: "var(--warn)",
  fatigued: "var(--danger)",
};

export function recoveryColor(r: number) {
  return LEVEL_COLOR[recoveryLevel(r)];
}

/** Hard working sets per muscle over the last `days` days (primary = 1, secondary = 0.5). */
export function weeklySetsPerMuscle(
  workouts: Workout[],
  getExercise: (id: string) => Pick<Exercise, "id" | "muscleGroup"> | undefined,
  days = 7,
  now: number = Date.now(),
): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  const since = now - days * 24 * 3600 * 1000;
  for (const w of workouts) {
    if (new Date(w.startedAt).getTime() < since) continue;
    for (const we of w.exercises) {
      const ex = getExercise(we.exerciseId);
      if (!ex) continue;
      const sets = we.sets.filter((s) => s.completed && s.type !== "warmup").length;
      const tg = musclesFor(ex);
      tg.primary.forEach((m) => (out[m] += sets));
      tg.secondary.forEach((m) => (out[m] += sets * SECONDARY_FACTOR));
    }
  }
  return out;
}
