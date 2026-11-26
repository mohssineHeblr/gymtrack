import type { BodyMeasurement, PersonalRecord, Workout, WorkoutSet } from "./types";
import { addDays, startOfWeek, toDateKey } from "./utils";

/** Epley estimated one-rep max */
export function e1rm(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

const isWork = (s: WorkoutSet) => s.completed && s.type !== "warmup";

export function setVolume(s: WorkoutSet) {
  return (s.weight ?? 0) * (s.reps ?? 0);
}

export function workoutVolume(w: Workout) {
  return w.exercises.reduce((sum, we) => sum + we.sets.filter(isWork).reduce((a, s) => a + setVolume(s), 0), 0);
}

export function workoutSetCount(w: Workout) {
  return w.exercises.reduce((sum, we) => sum + we.sets.filter((s) => s.completed).length, 0);
}

export function workoutDurationSec(w: Workout) {
  const end = w.finishedAt ? new Date(w.finishedAt).getTime() : Date.now();
  return Math.max(0, (end - new Date(w.startedAt).getTime()) / 1000);
}

/** Personal records per exercise, computed from history (oldest → newest). */
export function computePRs(workouts: Workout[]): Map<string, PersonalRecord> {
  const prs = new Map<string, PersonalRecord>();
  const chronological = [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const w of chronological) {
    for (const we of w.exercises) {
      for (const s of we.sets.filter(isWork)) {
        const weight = s.weight ?? 0;
        const reps = s.reps ?? 0;
        if (!reps) continue;
        const cur = prs.get(we.exerciseId);
        const est = e1rm(weight, reps);
        const vol = weight * reps;
        if (!cur) {
          prs.set(we.exerciseId, {
            exerciseId: we.exerciseId,
            bestWeight: weight,
            bestWeightReps: reps,
            bestE1rm: est,
            bestVolumeSet: vol,
            maxReps: reps,
            achievedAt: w.startedAt,
            workoutId: w.id,
          });
          continue;
        }
        let improved = false;
        if (weight > cur.bestWeight || (weight === cur.bestWeight && reps > cur.bestWeightReps)) {
          cur.bestWeight = weight;
          cur.bestWeightReps = reps;
          improved = true;
        }
        if (est > cur.bestE1rm) {
          cur.bestE1rm = est;
          improved = true;
        }
        if (vol > cur.bestVolumeSet) cur.bestVolumeSet = vol;
        if (reps > cur.maxReps) cur.maxReps = reps;
        if (improved) {
          cur.achievedAt = w.startedAt;
          cur.workoutId = w.id;
        }
      }
    }
  }
  return prs;
}

/** Number of PRs (weight or e1RM) set in a given workout */
export function prsInWorkout(workout: Workout, all: Workout[]): number {
  const before = all.filter((w) => w.startedAt < workout.startedAt);
  const prior = computePRs(before);
  let count = 0;
  for (const we of workout.exercises) {
    const p = prior.get(we.exerciseId);
    const bestW = Math.max(0, ...we.sets.filter(isWork).map((s) => s.weight ?? 0));
    const bestE = Math.max(0, ...we.sets.filter(isWork).map((s) => e1rm(s.weight ?? 0, s.reps ?? 0)));
    if (!p) {
      if (bestW > 0) count++;
    } else if (bestW > p.bestWeight || bestE > p.bestE1rm) count++;
  }
  return count;
}

export function workoutsInRange(workouts: Workout[], from: Date, to: Date) {
  const f = from.getTime();
  const t = to.getTime();
  return workouts.filter((w) => {
    const ts = new Date(w.startedAt).getTime();
    return ts >= f && ts < t;
  });
}

export function thisWeek(workouts: Workout[]) {
  const start = startOfWeek();
  return workoutsInRange(workouts, start, addDays(start, 7));
}

/** Mon..Sun breakdown of the current week */
export function weeklyActivity(workouts: Workout[]) {
  const start = startOfWeek();
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, i) => {
    const day = addDays(start, i);
    const key = toDateKey(day);
    const ws = workouts.filter((w) => toDateKey(w.startedAt) === key);
    return {
      label,
      key,
      isToday: key === toDateKey(),
      minutes: Math.round(ws.reduce((a, w) => a + workoutDurationSec(w), 0) / 60),
      volume: Math.round(ws.reduce((a, w) => a + workoutVolume(w), 0)),
      count: ws.length,
    };
  });
}

/** Last N weeks: workouts count & volume */
export function weeklyTrend(workouts: Workout[], weeks = 12) {
  const thisStart = startOfWeek();
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisStart, -7 * (weeks - 1 - i));
    const ws = workoutsInRange(workouts, start, addDays(start, 7));
    return {
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      workouts: ws.length,
      volume: Math.round(ws.reduce((a, w) => a + workoutVolume(w), 0)),
      minutes: Math.round(ws.reduce((a, w) => a + workoutDurationSec(w), 0) / 60),
    };
  });
}

/** Per-session progression for an exercise */
export function exerciseProgression(workouts: Workout[], exerciseId: string) {
  return [...workouts]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((w) => {
      const sets = w.exercises.filter((we) => we.exerciseId === exerciseId).flatMap((we) => we.sets.filter(isWork));
      if (!sets.length) return null;
      return {
        date: w.startedAt,
        label: new Date(w.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        e1rm: Math.round(Math.max(...sets.map((s) => e1rm(s.weight ?? 0, s.reps ?? 0))) * 10) / 10,
        topWeight: Math.max(...sets.map((s) => s.weight ?? 0)),
        volume: Math.round(sets.reduce((a, s) => a + setVolume(s), 0)),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export function latestMeasurement(body: BodyMeasurement[], key: keyof BodyMeasurement) {
  for (let i = body.length - 1; i >= 0; i--) {
    const v = body[i][key];
    if (typeof v === "number") return { value: v, date: body[i].date, index: i };
  }
  return null;
}

export function previousMeasurement(body: BodyMeasurement[], key: keyof BodyMeasurement, beforeIndex: number) {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const v = body[i][key];
    if (typeof v === "number") return { value: v, date: body[i].date };
  }
  return null;
}

/** Consecutive weeks (ending this or last week) with at least one workout */
export function weekStreak(workouts: Workout[]) {
  let streak = 0;
  let start = startOfWeek();
  if (workoutsInRange(workouts, start, addDays(start, 7)).length === 0) start = addDays(start, -7);
  for (;;) {
    if (workoutsInRange(workouts, start, addDays(start, 7)).length === 0) break;
    streak++;
    start = addDays(start, -7);
  }
  return streak;
}
