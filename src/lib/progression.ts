import { musclesFor } from "@/data/muscles";
import { e1rm } from "./stats";
import { uuid } from "./utils";
import type { Exercise, FitnessGoal, Units, Workout, WorkoutSet } from "./types";

/**
 * Progressive-overload engine ("double progression"):
 *  - hit the top of the rep range on every working set → add weight, drop to the bottom of the range
 *  - inside the range → same weight, aim for one more rep
 *  - well below the range → back off ~7.5%
 *  - no comparable history (different rep range) → derive from estimated 1RM
 */

export function parseRange(reps: string | undefined, fallback: [number, number] = [8, 12]): [number, number] {
  if (!reps) return fallback;
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return fallback;
  const lo = nums[0];
  const hi = nums[1] ?? nums[0];
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

/** Weight step for an exercise, in kg. */
export function weightStep(ex: Pick<Exercise, "id" | "muscleGroup" | "equipment">, units: Units): number {
  const lower = ["Quadriceps", "Hamstrings", "Glutes"].includes(ex.muscleGroup) && musclesFor(ex).compound;
  if (units === "lbs") {
    const lb = ex.equipment === "Dumbbell" || ex.equipment === "Kettlebell" ? 5 : lower ? 10 : 5;
    return lb / 2.2046226218;
  }
  if (ex.equipment === "Dumbbell" || ex.equipment === "Kettlebell") return 2;
  return lower && ex.equipment === "Barbell" ? 5 : 2.5;
}

/** Round a kg value to the nearest loadable increment in the user's units. */
export function roundLoad(kg: number, ex: Pick<Exercise, "equipment">, units: Units): number {
  if (kg <= 0) return 0;
  if (units === "lbs") {
    const lb = kg * 2.2046226218;
    return Math.max(5, Math.round(lb / 5) * 5) / 2.2046226218;
  }
  const step = ex.equipment === "Dumbbell" || ex.equipment === "Kettlebell" ? 1 : 2.5;
  return Math.max(step, Math.round(kg / step) * step);
}

interface Session {
  date: string;
  sets: WorkoutSet[];
}

function sessionsFor(workouts: Workout[], exerciseId: string, max = 6): Session[] {
  const out: Session[] = [];
  for (const w of workouts) {
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      const sets = we.sets.filter((s) => s.completed && s.type !== "warmup" && (s.reps ?? 0) > 0);
      if (sets.length) out.push({ date: w.startedAt, sets });
    }
    if (out.length >= max) break;
  }
  return out;
}

export interface Suggestion {
  sets: WorkoutSet[];
  /** Short explanation shown under the exercise */
  tip: string;
  /** "up" when we increased the load/reps vs last time */
  trend: "up" | "same" | "down" | "new";
}

export function suggestSets(opts: {
  exercise: Pick<Exercise, "id" | "muscleGroup" | "equipment">;
  workouts: Workout[];
  sets: number;
  reps: string;
  units: Units;
  warmups?: boolean;
}): Suggestion {
  const { exercise, workouts, units } = opts;
  const [lo, hi] = parseRange(opts.reps);
  const sessions = sessionsFor(workouts, exercise.id);
  const last = sessions[0];
  const mk = (weight: number | null, reps: number | null, type: WorkoutSet["type"] = "normal"): WorkoutSet => ({
    id: uuid(),
    weight,
    reps,
    completed: false,
    type,
  });
  const fmt = (kg: number) => {
    const v = units === "lbs" ? kg * 2.2046226218 : kg;
    return `${Math.round(v * 10) / 10} ${units}`;
  };

  if (!last) {
    return {
      sets: Array.from({ length: opts.sets }, () => mk(null, lo)),
      tip: `New exercise — pick a weight you can lift ${lo}–${hi} times with 1–2 reps in reserve.`,
      trend: "new",
    };
  }

  const bodyweight = last.sets.every((s) => !s.weight);
  if (bodyweight) {
    const best = Math.max(...last.sets.map((s) => s.reps ?? 0));
    const allTop = last.sets.every((s) => (s.reps ?? 0) >= hi);
    const target = Math.max(lo, best + 1);
    return {
      sets: Array.from({ length: opts.sets }, () => mk(0, target)),
      tip: allTop ? `You hit ${hi}+ reps on every set — aim for ${target}.` : `Last time best ${best} reps — try ${target}.`,
      trend: target > best ? "up" : "same",
    };
  }

  // Working weight = heaviest weight used for at least one set last session
  const top = Math.max(...last.sets.map((s) => s.weight ?? 0));
  const atTop = last.sets.filter((s) => (s.weight ?? 0) >= top - 0.01);
  const minReps = Math.min(...atTop.map((s) => s.reps ?? 0));
  const maxReps = Math.max(...atTop.map((s) => s.reps ?? 0));
  const lastLo = minReps;

  let weight = top;
  let reps = lo;
  let trend: Suggestion["trend"] = "same";
  let tip: string;

  const comparable = maxReps >= lo - 2 && minReps <= hi + 3;
  if (!comparable) {
    // Different rep scheme — estimate from best recent e1RM.
    const best = Math.max(...sessions.slice(0, 3).flatMap((s) => s.sets.map((x) => e1rm(x.weight ?? 0, x.reps ?? 0))));
    weight = roundLoad((best / (1 + lo / 30)) * 0.95, exercise, units);
    reps = lo;
    trend = "new";
    tip = `Estimated from your 1RM (~${fmt(best)}) for ${lo}–${hi} reps.`;
  } else if (atTop.length >= Math.min(opts.sets, last.sets.length) && minReps >= hi) {
    weight = roundLoad(top + weightStep(exercise, units), exercise, units);
    if (weight <= top) weight = top + weightStep(exercise, units);
    reps = lo;
    trend = "up";
    tip = `You hit ${hi} reps on every set — time to go up to ${fmt(weight)}.`;
  } else if (lastLo < lo - 1) {
    weight = roundLoad(top * 0.925, exercise, units);
    reps = lo;
    trend = "down";
    tip = `Last time was a grind (${lastLo} reps) — back off to ${fmt(weight)} and build up.`;
  } else {
    reps = Math.min(hi, Math.max(lo, minReps + 1));
    trend = reps > minReps ? "up" : "same";
    tip = trend === "up" ? `Same weight, beat last time: aim for ${reps} reps.` : `Repeat ${fmt(top)} for ${reps} reps.`;
  }

  const sets: WorkoutSet[] = [];
  if (opts.warmups && weight >= 30) {
    sets.push(mk(roundLoad(weight * 0.5, exercise, units), 10, "warmup"));
    sets.push(mk(roundLoad(weight * 0.75, exercise, units), 5, "warmup"));
  }
  for (let i = 0; i < opts.sets; i++) sets.push(mk(weight, reps));
  return { sets, tip, trend };
}

/** Sets / reps / rest prescription by goal. */
export function prescription(goal: FitnessGoal, compound: boolean, group?: string): { sets: number; reps: string; rest: number } {
  if (group === "Abs") return { sets: 3, reps: "12-15", rest: 45 };
  if (group === "Cardio") return { sets: 1, reps: "10-20", rest: 60 };
  const table: Record<FitnessGoal, [{ sets: number; reps: string; rest: number }, { sets: number; reps: string; rest: number }]> = {
    strength: [{ sets: 5, reps: "3-5", rest: 180 }, { sets: 3, reps: "6-8", rest: 120 }],
    build_muscle: [{ sets: 4, reps: "6-10", rest: 120 }, { sets: 3, reps: "10-12", rest: 75 }],
    lose_fat: [{ sets: 3, reps: "8-12", rest: 75 }, { sets: 3, reps: "12-15", rest: 45 }],
    endurance: [{ sets: 3, reps: "12-15", rest: 60 }, { sets: 3, reps: "15-20", rest: 45 }],
    maintain: [{ sets: 3, reps: "8-10", rest: 90 }, { sets: 3, reps: "10-12", rest: 60 }],
  };
  return table[goal][compound ? 0 : 1];
}
