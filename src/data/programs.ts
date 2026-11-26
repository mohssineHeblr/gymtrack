import type { ProgramDay, WorkoutProgram } from "@/lib/types";

type DaySpec = [name: string, weekdays: number[], exercises: [exerciseId: string, sets: number, reps: string, rest?: number][]];

function program(id: string, name: string, description: string, days: DaySpec[]): WorkoutProgram {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id,
    name,
    description,
    isPreset: true,
    createdAt: now,
    updatedAt: now,
    days: days.map(([dayName, weekdays, exercises], di): ProgramDay => ({
      id: `${id}-d${di + 1}`,
      name: dayName,
      weekdays,
      exercises: exercises.map(([exerciseId, sets, reps, rest], ei) => ({
        id: `${id}-d${di + 1}-e${ei + 1}`,
        exerciseId,
        sets,
        reps,
        restSeconds: rest ?? 90,
      })),
    })),
  };
}

// weekdays: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
export const PRESET_PROGRAMS: WorkoutProgram[] = [
  program("preset-ppl", "Push / Pull / Legs", "Classic 6-day hypertrophy split. Each muscle trained twice per week.", [
    ["Push", [1, 4], [
      ["bench-press", 4, "5-8", 150], ["overhead-press", 3, "6-10", 120], ["incline-dumbbell-press", 3, "8-12"],
      ["lateral-raise", 4, "12-15", 60], ["tricep-pushdown", 3, "10-15", 60], ["overhead-tricep-extension", 3, "10-12", 60],
    ]],
    ["Pull", [2, 5], [
      ["deadlift", 3, "3-5", 180], ["pull-up", 4, "6-10", 120], ["barbell-row", 3, "6-10", 120],
      ["face-pull", 3, "12-15", 60], ["barbell-curl", 3, "8-12", 60], ["hammer-curl", 3, "10-12", 60],
    ]],
    ["Legs", [3, 6], [
      ["back-squat", 4, "5-8", 180], ["romanian-deadlift", 3, "8-10", 120], ["leg-press", 3, "10-12", 120],
      ["leg-curl", 3, "10-15", 60], ["calf-raise", 4, "12-15", 60], ["hanging-leg-raise", 3, "10-15", 60],
    ]],
  ]),
  program("preset-upper-lower", "Upper / Lower", "4-day split balancing strength and size. Great for intermediates.", [
    ["Upper A", [1], [
      ["bench-press", 4, "5-8", 150], ["barbell-row", 4, "6-10", 120], ["overhead-press", 3, "6-10", 120],
      ["lat-pulldown", 3, "8-12", 90], ["barbell-curl", 2, "10-12", 60], ["tricep-pushdown", 2, "10-15", 60],
    ]],
    ["Lower A", [2], [
      ["back-squat", 4, "5-8", 180], ["romanian-deadlift", 3, "8-10", 120], ["leg-press", 3, "10-12", 90],
      ["leg-curl", 3, "10-15", 60], ["calf-raise", 4, "12-15", 60],
    ]],
    ["Upper B", [4], [
      ["incline-dumbbell-press", 4, "8-12", 120], ["pull-up", 4, "6-10", 120], ["dumbbell-shoulder-press", 3, "8-12", 90],
      ["seated-cable-row", 3, "10-12", 90], ["lateral-raise", 3, "12-15", 60], ["hammer-curl", 2, "10-12", 60],
    ]],
    ["Lower B", [5], [
      ["deadlift", 3, "3-5", 180], ["front-squat", 3, "6-8", 150], ["bulgarian-split-squat", 3, "8-12", 90],
      ["hip-thrust", 3, "8-12", 90], ["cable-crunch", 3, "12-15", 60],
    ]],
  ]),
  program("preset-full-body", "Full Body", "3 days per week hitting every muscle group. Ideal for beginners and busy schedules.", [
    ["Full Body A", [1], [
      ["back-squat", 3, "5-8", 150], ["bench-press", 3, "5-8", 150], ["barbell-row", 3, "6-10", 120],
      ["lateral-raise", 3, "12-15", 60], ["plank", 3, "30-60s", 60],
    ]],
    ["Full Body B", [3], [
      ["deadlift", 3, "3-5", 180], ["overhead-press", 3, "6-10", 120], ["pull-up", 3, "6-10", 120],
      ["walking-lunge", 3, "10-12", 90], ["dumbbell-curl", 2, "10-12", 60],
    ]],
    ["Full Body C", [5], [
      ["front-squat", 3, "6-8", 150], ["incline-dumbbell-press", 3, "8-12", 90], ["seated-cable-row", 3, "10-12", 90],
      ["hip-thrust", 3, "8-12", 90], ["tricep-pushdown", 2, "10-15", 60],
    ]],
  ]),
  program("preset-arnold", "Arnold Split", "Golden-era 6-day split: Chest & Back, Shoulders & Arms, Legs.", [
    ["Chest & Back", [1, 4], [
      ["bench-press", 4, "6-10", 120], ["pull-up", 4, "6-10", 120], ["incline-bench-press", 3, "8-12", 90],
      ["barbell-row", 3, "8-12", 90], ["dumbbell-fly", 3, "10-15", 60], ["straight-arm-pulldown", 3, "12-15", 60],
    ]],
    ["Shoulders & Arms", [2, 5], [
      ["arnold-press", 4, "8-12", 90], ["lateral-raise", 4, "12-15", 60], ["rear-delt-fly", 3, "12-15", 60],
      ["barbell-curl", 3, "8-12", 60], ["skull-crusher", 3, "8-12", 60], ["incline-dumbbell-curl", 3, "10-12", 60],
      ["tricep-pushdown", 3, "10-15", 60],
    ]],
    ["Legs", [3, 6], [
      ["back-squat", 4, "6-10", 180], ["leg-press", 3, "10-12", 120], ["romanian-deadlift", 3, "8-10", 120],
      ["leg-extension", 3, "12-15", 60], ["leg-curl", 3, "10-15", 60], ["calf-raise", 4, "12-15", 60],
      ["crunch", 3, "15-20", 45],
    ]],
  ]),
];
