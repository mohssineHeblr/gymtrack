import { MUSCLE_INFO, musclesFor, type Muscle } from "@/data/muscles";
import { prescription, suggestSets } from "./progression";
import type { RecoveryMap } from "./recovery";
import type { Exercise, Profile, SplitFocus, Workout, WorkoutExercise } from "./types";
import { uuid } from "./utils";

export const SPLIT_MUSCLES: Record<Exclude<SplitFocus, "auto">, Muscle[]> = {
  push: ["chest", "frontDelts", "sideDelts", "triceps"],
  pull: ["lats", "upperBack", "rearDelts", "biceps", "traps", "forearms"],
  legs: ["quads", "hamstrings", "glutes", "calves", "adductors"],
  upper: ["chest", "lats", "upperBack", "frontDelts", "sideDelts", "rearDelts", "biceps", "triceps"],
  lower: ["quads", "hamstrings", "glutes", "calves", "lowerBack", "abs"],
  full: ["quads", "chest", "lats", "hamstrings", "glutes", "upperBack", "frontDelts", "sideDelts", "biceps", "triceps", "abs"],
};

/** Muscles that decide whether a split is "ready" */
const SPLIT_KEY: Record<Exclude<SplitFocus, "auto">, Muscle[]> = {
  push: ["chest", "frontDelts", "triceps"],
  pull: ["lats", "upperBack", "biceps"],
  legs: ["quads", "hamstrings", "glutes"],
  upper: ["chest", "lats", "upperBack", "frontDelts"],
  lower: ["quads", "hamstrings", "glutes"],
  full: ["quads", "chest", "lats", "hamstrings"],
};

export const SPLIT_LABEL: Record<SplitFocus, string> = {
  auto: "Auto",
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper Body",
  lower: "Lower Body",
  full: "Full Body",
};

export interface SmartPlan {
  id: string;
  createdAt: string;
  split: Exclude<SplitFocus, "auto">;
  name: string;
  muscles: Muscle[];
  exercises: WorkoutExercise[];
  estMinutes: number;
  /** Why this split was chosen */
  reason: string;
  seed: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function pickSplit(recovery: RecoveryMap, workouts: Workout[]): { split: Exclude<SplitFocus, "auto">; reason: string } {
  const scores = (Object.keys(SPLIT_KEY) as Exclude<SplitFocus, "auto">[]).map((s) => ({
    split: s,
    score: avg(SPLIT_KEY[s].map((m) => recovery[m].recovery)),
    min: Math.min(...SPLIT_KEY[s].map((m) => recovery[m].recovery)),
  }));
  const full = scores.find((s) => s.split === "full")!;
  const lastDays = workouts[0] ? (Date.now() - new Date(workouts[0].startedAt).getTime()) / 86_400_000 : Infinity;
  if (full.min >= 90 && (lastDays >= 3 || workouts.length < 2)) {
    return { split: "full", reason: workouts.length ? "Every muscle is fully recovered — a full-body session is ideal." : "Fresh start — a balanced full-body session to find your baselines." };
  }
  // Prefer push/pull/legs style splits; upper/lower only if clearly better.
  const ranked = scores
    .filter((s) => s.split !== "full")
    .map((s) => ({ ...s, score: s.score + (["push", "pull", "legs"].includes(s.split) ? 3 : 0) + s.min * 0.15 }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const names = SPLIT_KEY[best.split].map((m) => MUSCLE_INFO[m].label.toLowerCase());
  return { split: best.split, reason: `Your ${names.slice(0, -1).join(", ")} and ${names.at(-1)} are the most recovered muscles right now.` };
}

export interface GenerateInput {
  exercises: Exercise[];
  workouts: Workout[];
  recovery: RecoveryMap;
  profile: Profile;
  seed?: number;
  /** Force a split instead of profile.smart.split */
  split?: SplitFocus;
}

function minutesFor(sets: number, rest: number) {
  return (sets * (40 + rest) + 75) / 60;
}

export function exerciseScore(
  ex: Exercise,
  muscle: Muscle,
  ctx: { profile: Profile; recovery: RecoveryMap; usedRecently: Set<string>; done: Set<string>; rand: () => number; preferCompound: boolean },
) {
  const tg = musclesFor(ex);
  let score = tg.primary[0] === muscle ? 3 : tg.primary.includes(muscle) ? 2 : 0.5;
  if (ctx.preferCompound) score += tg.compound ? 3 : -1;
  else score += tg.compound ? 0.5 : 1;
  if (ctx.profile.favoriteExercises.includes(ex.id)) score += 4;
  // Familiar lifts first: you have history (and therefore suggested weights) for them
  if (ctx.done.has(ex.id)) score += 3;
  if (ctx.usedRecently.has(ex.id)) score -= 1.5;
  // Avoid hammering fatigued secondary muscles
  const sec = avg(tg.secondary.map((m) => ctx.recovery[m].recovery));
  if (tg.secondary.length && sec < 50) score -= 2;
  if (tg.primary.some((m) => ctx.recovery[m].recovery < 40)) score -= 3;
  return score + ctx.rand() * 1.8;
}

export function availableExercises(all: Exercise[], profile: Profile) {
  const eq = new Set(profile.equipment);
  return all.filter((e) => e.muscleGroup !== "Cardio" && eq.has(e.equipment) && !profile.excludedExercises.includes(e.id));
}

export function generateSmartPlan(input: GenerateInput): SmartPlan {
  const { profile, recovery, workouts } = input;
  const seed = input.seed ?? Math.floor(Math.random() * 1e9);
  const rand = rng(seed);
  const requested = input.split ?? profile.smart.split;
  const picked = requested === "auto" ? pickSplit(recovery, workouts) : { split: requested, reason: `${SPLIT_LABEL[requested]} focus selected in your settings.` };
  const split = picked.split as Exclude<SplitFocus, "auto">;

  const pool = availableExercises(input.exercises, profile);
  const done = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  const usedRecently = new Set(workouts.slice(0, 2).flatMap((w) => w.exercises.map((e) => e.exerciseId)));

  // Order target muscles: large first, then by recovery; drop muscles that are very fatigued.
  let targets = [...SPLIT_MUSCLES[split]]
    .filter((m) => recovery[m].recovery >= 35)
    .sort((a, b) => {
      const sa = MUSCLE_INFO[a].size === "large" ? 1 : 0;
      const sb = MUSCLE_INFO[b].size === "large" ? 1 : 0;
      return sb - sa || recovery[b].recovery - recovery[a].recovery;
    });
  if (!targets.length) targets = [...SPLIT_MUSCLES[split]];

  const budget = profile.smart.duration;
  const chosen: { ex: Exercise; muscle: Muscle; compound: boolean }[] = [];
  const coverage = new Map<Muscle, number>();
  let minutes = 0;
  let guard = 0;
  // Extra exercises per muscle allowed once every target is covered and time remains
  let extra = 0;
  const cap = (m: Muscle) => (MUSCLE_INFO[m].size === "large" ? 2 : 1) + extra;

  while (guard++ < 60) {
    // Next muscle = least-covered target (large muscles may take 2 exercises)
    const next = targets
      .map((m, i) => ({ m, i, c: (coverage.get(m) ?? 0) / cap(m) }))
      .filter(({ m }) => (coverage.get(m) ?? 0) < cap(m))
      .sort((a, b) => a.c - b.c || a.i - b.i)[0];
    if (!next) {
      if (minutes < budget - 6 && extra < 2) {
        extra++;
        continue;
      }
      break;
    }
    const preferCompound = chosen.length < 2 || ((coverage.get(next.m) ?? 0) === 0 && MUSCLE_INFO[next.m].size === "large");
    const candidates = pool
      .filter((e) => !chosen.some((c) => c.ex.id === e.id))
      .filter((e) => musclesFor(e).primary.includes(next.m));
    if (!candidates.length) {
      coverage.set(next.m, 99);
      continue;
    }
    const ctx = { profile, recovery, usedRecently, done, rand, preferCompound };
    const best = candidates.map((e) => ({ e, s: exerciseScore(e, next.m, ctx) })).sort((a, b) => b.s - a.s)[0].e;
    const tg = musclesFor(best);
    const p = prescription(profile.fitnessGoal, tg.compound, best.muscleGroup);
    const cost = minutesFor(p.sets, p.rest);
    if (minutes + cost > budget + 4 && chosen.length >= 3) break;
    chosen.push({ ex: best, muscle: next.m, compound: tg.compound });
    minutes += cost;
    // Count coverage for every primary muscle the lift hits
    for (const m of tg.primary) coverage.set(m, (coverage.get(m) ?? 0) + 1);
    if (chosen.length >= 9) break;
  }

  // Compounds first, keep picking order otherwise
  const ordered = [...chosen].sort((a, b) => Number(b.compound) - Number(a.compound));
  let warmupDone = false;
  const exercises: WorkoutExercise[] = ordered.map(({ ex, compound }) => {
    const p = prescription(profile.fitnessGoal, compound, ex.muscleGroup);
    const withWarmup = profile.smart.warmups && compound && !warmupDone;
    const sg = suggestSets({ exercise: ex, workouts, sets: p.sets, reps: p.reps, units: profile.units, warmups: withWarmup });
    if (withWarmup && sg.sets.some((s) => s.type === "warmup")) warmupDone = true;
    return { id: uuid(), exerciseId: ex.id, restSeconds: p.rest, targetReps: p.reps, tip: sg.tip, trend: sg.trend, sets: sg.sets };
  });

  const muscles = [...new Set(ordered.flatMap((c) => musclesFor(c.ex).primary))].filter((m) => SPLIT_MUSCLES[split].includes(m));
  const focus = muscles
    .filter((m) => MUSCLE_INFO[m].size === "large")
    .slice(0, 2)
    .map((m) => MUSCLE_INFO[m].label);

  return {
    id: uuid(),
    createdAt: new Date().toISOString(),
    split,
    name: `${SPLIT_LABEL[split]}${focus.length ? ` · ${focus.join(" & ")}` : ""}`,
    muscles,
    exercises,
    estMinutes: Math.round(exercises.reduce((a, e) => a + minutesFor(e.sets.length, e.restSeconds), 0)),
    reason: picked.reason,
    seed,
  };
}

/** Best replacements for an exercise: same primary muscle, available equipment. */
export function alternativesFor(exerciseId: string, all: Exercise[], profile: Profile, recovery: RecoveryMap, workouts: Workout[], exclude: string[] = []) {
  const src = all.find((e) => e.id === exerciseId);
  if (!src) return [];
  const tg = musclesFor(src);
  const muscle = tg.primary[0];
  const done = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  const rand = rng(exerciseId.length * 7919);
  const ctx = { profile, recovery, usedRecently: new Set<string>(), done, rand, preferCompound: tg.compound };
  return availableExercises(all, profile)
    .filter((e) => e.id !== exerciseId && !exclude.includes(e.id))
    .filter((e) => musclesFor(e).primary.some((m) => tg.primary.includes(m)))
    .map((e) => ({ e, s: exerciseScore(e, muscle, ctx) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.e);
}

export const EQUIPMENT_PRESETS: { id: string; label: string; description: string; equipment: Exercise["equipment"][] }[] = [
  { id: "gym", label: "Full gym", description: "Barbells, dumbbells, machines & cables", equipment: ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell", "Band", "Other"] },
  { id: "home", label: "Home gym", description: "Dumbbells, kettlebell, bands & bodyweight", equipment: ["Dumbbell", "Kettlebell", "Band", "Bodyweight", "Other"] },
  { id: "bodyweight", label: "Bodyweight", description: "No equipment needed", equipment: ["Bodyweight"] },
];
