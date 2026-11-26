import { PRESET_PROGRAMS } from "@/data/programs";
import type { BodyMeasurement, NutritionLog, Workout } from "./types";
import { addDays, toDateKey, uuid } from "./utils";

/** Starting working weights (kg) used to generate realistic, progressing history */
const BASE: Record<string, number> = {
  "bench-press": 72.5, "overhead-press": 45, "incline-dumbbell-press": 26, "lateral-raise": 10,
  "tricep-pushdown": 30, "overhead-tricep-extension": 22, "deadlift": 130, "pull-up": 0,
  "barbell-row": 65, "face-pull": 22.5, "barbell-curl": 32.5, "hammer-curl": 14,
  "back-squat": 100, "romanian-deadlift": 85, "leg-press": 180, "leg-curl": 45,
  "calf-raise": 70, "hanging-leg-raise": 0,
};

function round(n: number, step = 2.5) {
  return Math.round(n / step) * step;
}

export function generateSampleData(): { workouts: Workout[]; body: BodyMeasurement[]; nutrition: NutritionLog[] } {
  const ppl = PRESET_PROGRAMS[0];
  const today = new Date();
  const workouts: Workout[] = [];
  const days = 56; // 8 weeks of history
  let rotation = 0;

  for (let i = days; i >= 1; i--) {
    const date = addDays(today, -i);
    const dow = date.getDay();
    if (dow === 0) continue; // rest on Sundays
    if ((i * 7) % 11 === 0) continue; // occasional missed day
    const day = ppl.days[rotation % 3];
    rotation++;
    const progress = (days - i) / days; // 0 → 1
    const start = new Date(date);
    start.setHours(18, 5 + (i % 20), 0, 0);
    let cursor = start.getTime();

    const exercises = day.exercises.map((pe) => {
      const base = BASE[pe.exerciseId] ?? 20;
      const weight = base === 0 ? 0 : round(base * (1 + progress * 0.12), base < 20 ? 1 : 2.5);
      const topReps = parseInt(pe.reps.split("-")[1] ?? pe.reps, 10) || 10;
      const lowReps = parseInt(pe.reps, 10) || 8;
      const sets = Array.from({ length: pe.sets }, (_, si) => {
        cursor += (pe.restSeconds + 45) * 1000;
        const reps = Math.max(lowReps, topReps - si - ((i + si) % 2));
        return { id: uuid(), weight: base === 0 ? 0 : weight, reps, completed: true, type: "normal" as const };
      });
      return { id: uuid(), exerciseId: pe.exerciseId, restSeconds: pe.restSeconds, sets };
    });

    const finished = new Date(cursor + 5 * 60 * 1000);
    workouts.push({
      id: uuid(),
      name: day.name,
      programId: ppl.id,
      programDayId: day.id,
      startedAt: start.toISOString(),
      finishedAt: finished.toISOString(),
      notes: "",
      exercises,
      updatedAt: new Date().toISOString(),
    });
  }

  const body: BodyMeasurement[] = [];
  for (let w = 8; w >= 0; w--) {
    const date = addDays(today, -w * 7);
    const t = (8 - w) / 8;
    body.push({
      id: uuid(),
      date: toDateKey(date),
      weight: Math.round((84.6 - t * 2.8 + (w % 2 ? 0.3 : -0.1)) * 10) / 10,
      bodyFat: Math.round((18.5 - t * 2.1) * 10) / 10,
      chest: Math.round((104 + t * 1.2) * 10) / 10,
      waist: Math.round((86 - t * 2.4) * 10) / 10,
      arm: Math.round((37.5 + t * 0.8) * 10) / 10,
      thigh: Math.round((59 + t * 0.6) * 10) / 10,
      updatedAt: new Date().toISOString(),
    });
  }

  const foods: [string, number, number, number, number][] = [
    ["Oats with whey & banana", 520, 38, 78, 9],
    ["Chicken, rice & broccoli", 680, 55, 85, 12],
    ["Greek yogurt & berries", 220, 20, 25, 4],
    ["Salmon with sweet potato", 640, 42, 55, 26],
    ["Protein shake", 160, 30, 4, 2],
    ["Mixed nuts", 180, 6, 6, 16],
  ];
  const nutrition: NutritionLog[] = [];
  for (let d = 6; d >= 0; d--) {
    const date = toDateKey(addDays(today, -d));
    const items = d === 0 ? foods.slice(0, 3) : foods.filter((_, idx) => (idx + d) % 5 !== 0);
    for (const [name, calories, protein, carbs, fat] of items) {
      nutrition.push({ id: uuid(), date, name, calories, protein, carbs, fat, updatedAt: new Date().toISOString() });
    }
  }

  return { workouts: workouts.reverse(), body, nutrition };
}
