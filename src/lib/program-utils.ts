import type { ProgramDay, Workout, WorkoutProgram } from "./types";
import { WEEKDAYS_SHORT } from "./utils";

export function todaysDay(program: WorkoutProgram | undefined | null, date = new Date()): ProgramDay | null {
  if (!program) return null;
  return program.days.find((d) => d.weekdays.includes(date.getDay())) ?? null;
}

/** Next scheduled day after today (within a week) */
export function nextScheduled(program: WorkoutProgram | undefined | null, date = new Date()) {
  if (!program) return null;
  for (let i = 1; i <= 7; i++) {
    const wd = (date.getDay() + i) % 7;
    const day = program.days.find((d) => d.weekdays.includes(wd));
    if (day) return { day, inDays: i, weekday: WEEKDAYS_SHORT[wd] };
  }
  return null;
}

/** Suggest the next day in rotation based on the last completed session of this program */
export function nextInRotation(program: WorkoutProgram, workouts: Workout[]): ProgramDay | null {
  if (!program.days.length) return null;
  const last = workouts.find((w) => w.programId === program.id);
  if (!last) return program.days[0];
  const idx = program.days.findIndex((d) => d.id === last.programDayId);
  return program.days[(idx + 1) % program.days.length];
}

export function programStats(program: WorkoutProgram, workouts: Workout[]) {
  const sessions = workouts.filter((w) => w.programId === program.id);
  const perDay = new Map<string, { count: number; last: string | null }>();
  for (const d of program.days) perDay.set(d.id, { count: 0, last: null });
  for (const w of sessions) {
    const entry = w.programDayId ? perDay.get(w.programDayId) : undefined;
    if (entry) {
      entry.count++;
      if (!entry.last || w.startedAt > entry.last) entry.last = w.startedAt;
    }
  }
  return { total: sessions.length, perDay, last: sessions[0]?.startedAt ?? null };
}

export function scheduleLabel(weekdays: number[]) {
  if (!weekdays.length) return "Unscheduled";
  return [...weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS_SHORT[d]).join(" · ");
}
