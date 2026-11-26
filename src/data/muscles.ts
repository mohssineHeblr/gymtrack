import type { Exercise, MuscleGroup } from "@/lib/types";

/** Fine-grained muscles used for recovery tracking and the body map. */
export type Muscle =
  | "chest"
  | "frontDelts"
  | "sideDelts"
  | "rearDelts"
  | "traps"
  | "lats"
  | "upperBack"
  | "lowerBack"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "adductors"
  | "calves";

export const MUSCLES: Muscle[] = [
  "chest",
  "frontDelts",
  "sideDelts",
  "rearDelts",
  "traps",
  "lats",
  "upperBack",
  "lowerBack",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "quads",
  "hamstrings",
  "glutes",
  "adductors",
  "calves",
];

export const MUSCLE_INFO: Record<Muscle, { label: string; group: MuscleGroup; recoveryHours: number; size: "large" | "small" }> = {
  chest: { label: "Chest", group: "Chest", recoveryHours: 72, size: "large" },
  frontDelts: { label: "Front Delts", group: "Shoulders", recoveryHours: 48, size: "small" },
  sideDelts: { label: "Side Delts", group: "Shoulders", recoveryHours: 48, size: "small" },
  rearDelts: { label: "Rear Delts", group: "Shoulders", recoveryHours: 48, size: "small" },
  traps: { label: "Traps", group: "Back", recoveryHours: 48, size: "small" },
  lats: { label: "Lats", group: "Back", recoveryHours: 72, size: "large" },
  upperBack: { label: "Upper Back", group: "Back", recoveryHours: 72, size: "large" },
  lowerBack: { label: "Lower Back", group: "Back", recoveryHours: 72, size: "large" },
  biceps: { label: "Biceps", group: "Biceps", recoveryHours: 48, size: "small" },
  triceps: { label: "Triceps", group: "Triceps", recoveryHours: 48, size: "small" },
  forearms: { label: "Forearms", group: "Forearms", recoveryHours: 36, size: "small" },
  abs: { label: "Abs", group: "Abs", recoveryHours: 36, size: "small" },
  obliques: { label: "Obliques", group: "Abs", recoveryHours: 36, size: "small" },
  quads: { label: "Quads", group: "Quadriceps", recoveryHours: 72, size: "large" },
  hamstrings: { label: "Hamstrings", group: "Hamstrings", recoveryHours: 72, size: "large" },
  glutes: { label: "Glutes", group: "Glutes", recoveryHours: 72, size: "large" },
  adductors: { label: "Adductors", group: "Quadriceps", recoveryHours: 48, size: "small" },
  calves: { label: "Calves", group: "Calves", recoveryHours: 36, size: "small" },
};

export interface MuscleTargets {
  primary: Muscle[];
  secondary: Muscle[];
  /** Multi-joint lift (programmed first, heavier, longer rest) */
  compound: boolean;
}

const t = (primary: Muscle[], secondary: Muscle[] = [], compound = false): MuscleTargets => ({ primary, secondary, compound });

/** Muscle targets for every built-in exercise. */
export const EXERCISE_MUSCLES: Record<string, MuscleTargets> = {
  // Chest
  "bench-press": t(["chest"], ["frontDelts", "triceps"], true),
  "incline-bench-press": t(["chest", "frontDelts"], ["triceps"], true),
  "dumbbell-bench-press": t(["chest"], ["frontDelts", "triceps"], true),
  "incline-dumbbell-press": t(["chest", "frontDelts"], ["triceps"], true),
  "dumbbell-fly": t(["chest"], ["frontDelts"]),
  "cable-crossover": t(["chest"], ["frontDelts"]),
  "chest-press-machine": t(["chest"], ["frontDelts", "triceps"], true),
  "push-up": t(["chest"], ["frontDelts", "triceps", "abs"], true),
  "chest-dip": t(["chest", "triceps"], ["frontDelts"], true),
  // Back
  deadlift: t(["lowerBack", "hamstrings", "glutes"], ["upperBack", "traps", "forearms", "quads"], true),
  "barbell-row": t(["upperBack", "lats"], ["rearDelts", "biceps", "lowerBack"], true),
  "pull-up": t(["lats"], ["biceps", "upperBack", "forearms"], true),
  "chin-up": t(["lats", "biceps"], ["upperBack", "forearms"], true),
  "lat-pulldown": t(["lats"], ["biceps", "upperBack"], true),
  "seated-cable-row": t(["upperBack", "lats"], ["rearDelts", "biceps"], true),
  "dumbbell-row": t(["lats", "upperBack"], ["rearDelts", "biceps"], true),
  "t-bar-row": t(["upperBack", "lats"], ["rearDelts", "biceps", "lowerBack"], true),
  "face-pull": t(["rearDelts"], ["upperBack", "traps"]),
  "straight-arm-pulldown": t(["lats"], ["triceps"]),
  // Shoulders
  "overhead-press": t(["frontDelts"], ["sideDelts", "triceps", "traps"], true),
  "dumbbell-shoulder-press": t(["frontDelts"], ["sideDelts", "triceps"], true),
  "arnold-press": t(["frontDelts", "sideDelts"], ["triceps"], true),
  "lateral-raise": t(["sideDelts"], ["traps"]),
  "cable-lateral-raise": t(["sideDelts"], ["traps"]),
  "front-raise": t(["frontDelts"]),
  "rear-delt-fly": t(["rearDelts"], ["upperBack"]),
  "upright-row": t(["sideDelts", "traps"], ["biceps"]),
  shrug: t(["traps"], ["forearms"]),
  // Biceps
  "barbell-curl": t(["biceps"], ["forearms"]),
  "dumbbell-curl": t(["biceps"], ["forearms"]),
  "hammer-curl": t(["biceps", "forearms"]),
  "preacher-curl": t(["biceps"]),
  "incline-dumbbell-curl": t(["biceps"]),
  "cable-curl": t(["biceps"], ["forearms"]),
  // Triceps
  "close-grip-bench": t(["triceps"], ["chest", "frontDelts"], true),
  "tricep-pushdown": t(["triceps"]),
  "overhead-tricep-extension": t(["triceps"]),
  "skull-crusher": t(["triceps"]),
  "tricep-dip": t(["triceps"], ["chest", "frontDelts"], true),
  "tricep-kickback": t(["triceps"]),
  // Legs
  "back-squat": t(["quads", "glutes"], ["hamstrings", "adductors", "lowerBack"], true),
  "front-squat": t(["quads"], ["glutes", "abs", "upperBack"], true),
  "leg-press": t(["quads", "glutes"], ["hamstrings", "adductors"], true),
  "romanian-deadlift": t(["hamstrings", "glutes"], ["lowerBack", "forearms"], true),
  "bulgarian-split-squat": t(["quads", "glutes"], ["hamstrings", "adductors"], true),
  "walking-lunge": t(["quads", "glutes"], ["hamstrings", "adductors", "calves"], true),
  "leg-extension": t(["quads"]),
  "leg-curl": t(["hamstrings"], ["calves"]),
  "calf-raise": t(["calves"]),
  "goblet-squat": t(["quads", "glutes"], ["adductors", "abs"], true),
  "hack-squat": t(["quads"], ["glutes", "adductors"], true),
  // Glutes
  "hip-thrust": t(["glutes"], ["hamstrings"], true),
  "glute-bridge": t(["glutes"], ["hamstrings"]),
  "cable-kickback": t(["glutes"]),
  "hip-abduction": t(["glutes"]),
  "sumo-deadlift": t(["glutes", "adductors", "hamstrings"], ["lowerBack", "quads", "traps"], true),
  "step-up": t(["glutes", "quads"], ["hamstrings"], true),
  // Abs
  plank: t(["abs"], ["obliques"]),
  "hanging-leg-raise": t(["abs"], ["obliques", "forearms"]),
  "cable-crunch": t(["abs"]),
  crunch: t(["abs"]),
  "russian-twist": t(["obliques"], ["abs"]),
  "ab-wheel": t(["abs"], ["obliques", "lats"]),
  // Cardio
  "treadmill-run": t(["quads", "calves"], ["hamstrings", "glutes"]),
  "rowing-machine": t(["upperBack", "quads"], ["lats", "hamstrings", "biceps"]),
  "stationary-bike": t(["quads"], ["calves", "glutes"]),
  "jump-rope": t(["calves"], ["quads"]),
  burpee: t(["chest", "quads"], ["frontDelts", "triceps", "abs"]),
  "kettlebell-swing": t(["glutes", "hamstrings"], ["lowerBack", "frontDelts", "forearms"], true),
  "stair-climber": t(["quads", "glutes"], ["calves", "hamstrings"]),
  // Forearms
  "wrist-curl": t(["forearms"]),
  "reverse-wrist-curl": t(["forearms"]),
  "reverse-curl": t(["forearms", "biceps"]),
  "farmers-carry": t(["forearms", "traps"], ["abs", "obliques", "upperBack"], true),
  "dead-hang": t(["forearms"], ["lats"]),
  "plate-pinch": t(["forearms"]),
  // Calves
  "seated-calf-raise": t(["calves"]),
  "single-leg-calf-raise": t(["calves"]),
  "leg-press-calf-raise": t(["calves"]),
  // Hamstrings
  "seated-leg-curl": t(["hamstrings"], ["calves"]),
  "nordic-curl": t(["hamstrings"], ["calves", "glutes"]),
  "good-morning": t(["hamstrings", "lowerBack"], ["glutes", "upperBack"], true),
  "dumbbell-romanian-deadlift": t(["hamstrings", "glutes"], ["lowerBack", "forearms"], true),
  "glute-ham-raise": t(["hamstrings"], ["glutes", "calves", "lowerBack"]),
  // Quadriceps
  "bodyweight-squat": t(["quads", "glutes"], ["adductors"], true),
  "reverse-lunge": t(["quads", "glutes"], ["hamstrings", "adductors"], true),
  "smith-machine-squat": t(["quads", "glutes"], ["adductors", "hamstrings"], true),
  "wall-sit": t(["quads"], ["glutes"]),
  "sissy-squat": t(["quads"], ["abs"]),
  // Chest
  "decline-bench-press": t(["chest"], ["triceps", "frontDelts"], true),
  "pec-deck": t(["chest"], ["frontDelts"]),
  "band-chest-press": t(["chest"], ["frontDelts", "triceps"], true),
  // Back
  "inverted-row": t(["upperBack", "lats"], ["biceps", "rearDelts"], true),
  "chest-supported-row": t(["upperBack", "lats"], ["rearDelts", "biceps"], true),
  "band-pull-apart": t(["rearDelts", "upperBack"], ["traps"]),
  "back-extension": t(["lowerBack"], ["glutes", "hamstrings"]),
  // Shoulders
  "machine-shoulder-press": t(["frontDelts"], ["sideDelts", "triceps"], true),
  "kettlebell-press": t(["frontDelts"], ["sideDelts", "triceps", "obliques"], true),
  "pike-push-up": t(["frontDelts"], ["triceps", "upperBack"], true),
  // Biceps
  "concentration-curl": t(["biceps"]),
  "band-curl": t(["biceps"], ["forearms"]),
  "ez-bar-curl": t(["biceps"], ["forearms"]),
  // Triceps
  "diamond-push-up": t(["triceps"], ["chest", "frontDelts"], true),
  "rope-overhead-extension": t(["triceps"]),
  // Glutes
  "cable-pull-through": t(["glutes", "hamstrings"], ["lowerBack"]),
  "lateral-band-walk": t(["glutes"], ["adductors"]),
  "single-leg-glute-bridge": t(["glutes"], ["hamstrings"]),
  // Abs
  "dead-bug": t(["abs"], ["obliques"]),
  "side-plank": t(["obliques"], ["abs"]),
  "bicycle-crunch": t(["abs", "obliques"]),
  "pallof-press": t(["obliques", "abs"]),
  "mountain-climber": t(["abs"], ["frontDelts", "quads"]),
  // Cardio
  elliptical: t(["quads", "glutes"], ["hamstrings", "calves"]),
  "assault-bike": t(["quads"], ["glutes", "frontDelts", "triceps"]),
  "box-jump": t(["quads", "glutes"], ["calves", "hamstrings"]),
  "jumping-jacks": t(["calves"], ["sideDelts", "quads"]),
  "sprint-intervals": t(["hamstrings", "quads", "glutes"], ["calves"]),
  "battle-ropes": t(["frontDelts", "sideDelts"], ["forearms", "abs"]),
};

const GROUP_DEFAULT: Record<MuscleGroup, MuscleTargets> = {
  Chest: t(["chest"], ["frontDelts", "triceps"]),
  Back: t(["lats", "upperBack"], ["biceps"]),
  Shoulders: t(["frontDelts", "sideDelts"], ["triceps"]),
  Biceps: t(["biceps"], ["forearms"]),
  Triceps: t(["triceps"]),
  Forearms: t(["forearms"]),
  Quadriceps: t(["quads"], ["glutes"]),
  Hamstrings: t(["hamstrings"], ["glutes"]),
  Calves: t(["calves"]),
  Glutes: t(["glutes"], ["hamstrings"]),
  Abs: t(["abs"], ["obliques"]),
  Cardio: t(["quads"], ["calves"]),
};

export function musclesFor(ex: Pick<Exercise, "id" | "muscleGroup" | "primaryMuscles" | "secondaryMuscles" | "type">): MuscleTargets {
  const builtIn = EXERCISE_MUSCLES[ex.id];
  if (builtIn) return builtIn;
  const base = GROUP_DEFAULT[ex.muscleGroup] ?? t([]);
  if (ex.primaryMuscles?.length) {
    return { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles ?? [], compound: ex.type === "compound" };
  }
  return ex.type ? { ...base, compound: ex.type === "compound" } : base;
}
