"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useMemo } from "react";
import { DEFAULT_EXERCISES } from "@/data/exercises";
import { PRESET_PROGRAMS } from "@/data/programs";
import type {
  BodyMeasurement,
  Exercise,
  NutritionLog,
  PendingDeletion,
  Profile,
  RestTimerState,
  SyncState,
  SyncTable,
  Workout,
  WorkoutExercise,
  WorkoutProgram,
  WorkoutSet,
} from "./types";
import { nowIso, uuid } from "./utils";
import { EQUIPMENT, type SplitFocus } from "./types";
import { musclesFor } from "@/data/muscles";
import { computeRecovery } from "./recovery";
import { generateSmartPlan, type SmartPlan } from "./generator";
import { prescription, suggestSets } from "./progression";

export const DEFAULT_PROFILE: Profile = {
  name: "",
  fitnessGoal: "build_muscle",
  goalDescription: "",
  targetWeight: null,
  weeklyGoal: 4,
  units: "kg",
  theme: "dark",
  nutritionGoals: { calories: 2600, protein: 170, carbs: 300, fat: 80 },
  activeProgramId: "preset-ppl",
  equipment: [...EQUIPMENT],
  favoriteExercises: [],
  excludedExercises: [],
  smart: { duration: 60, split: "auto", warmups: true },
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export interface GymState {
  hydrated: boolean;
  onboarded: boolean;
  profile: Profile;
  customExercises: Exercise[];
  programs: WorkoutProgram[];
  workouts: Workout[];
  activeWorkout: Workout | null;
  body: BodyMeasurement[];
  nutrition: NutritionLog[];
  restTimer: RestTimerState;
  sync: SyncState;
  smartPlan: SmartPlan | null;
}

interface StartOptions {
  name: string;
  programId?: string | null;
  programDayId?: string | null;
  exercises?: WorkoutExercise[];
}

export interface GymActions {
  setHydrated: () => void;
  completeOnboarding: (name: string, units: Profile["units"]) => void;
  updateProfile: (patch: Partial<Profile>) => void;

  addCustomExercise: (e: Omit<Exercise, "id" | "isCustom" | "updatedAt">) => string;
  updateCustomExercise: (id: string, patch: Partial<Exercise>) => void;
  deleteCustomExercise: (id: string) => void;

  saveProgram: (p: WorkoutProgram) => void;
  createProgram: () => string;
  duplicateProgram: (id: string) => string | null;
  deleteProgram: (id: string) => void;
  setActiveProgram: (id: string | null) => void;

  startWorkout: (opts: StartOptions) => void;
  startFromProgramDay: (programId: string, dayId: string) => void;
  repeatWorkout: (workoutId: string) => void;
  updateActive: (patch: Partial<Pick<Workout, "name" | "notes">>) => void;
  addExerciseToActive: (exerciseId: string) => void;
  removeExerciseFromActive: (weId: string) => void;
  moveExerciseInActive: (weId: string, dir: -1 | 1) => void;
  setExerciseRest: (weId: string, seconds: number) => void;
  addSet: (weId: string) => void;
  updateSet: (weId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  deleteSet: (weId: string, setId: string) => void;
  toggleSetComplete: (weId: string, setId: string) => void;
  finishWorkout: () => string | null;
  discardWorkout: () => void;
  replaceExerciseInActive: (weId: string, exerciseId: string) => void;

  regenerateSmartPlan: (opts?: { split?: SplitFocus; keepSeed?: boolean }) => void;
  swapPlanExercise: (weId: string, exerciseId: string) => void;
  removePlanExercise: (weId: string) => void;
  startSmartPlan: () => void;

  toggleFavorite: (exerciseId: string) => void;
  toggleExcluded: (exerciseId: string) => void;

  updateWorkout: (id: string, patch: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;

  addMeasurement: (m: Omit<BodyMeasurement, "id" | "updatedAt">) => void;
  updateMeasurement: (id: string, patch: Partial<BodyMeasurement>) => void;
  deleteMeasurement: (id: string) => void;

  addFood: (f: Omit<NutritionLog, "id" | "updatedAt">) => void;
  deleteFood: (id: string) => void;

  startRest: (seconds: number) => void;
  adjustRest: (delta: number) => void;
  stopRest: () => void;

  setSync: (patch: Partial<SyncState>) => void;
  replaceData: (data: Partial<GymState>) => void;
  resetAll: () => void;
}

export type GymStore = GymState & GymActions;

const initialState: GymState = {
  hydrated: false,
  onboarded: false,
  profile: DEFAULT_PROFILE,
  customExercises: [],
  programs: PRESET_PROGRAMS,
  workouts: [],
  activeWorkout: null,
  body: [],
  nutrition: [],
  restTimer: { endsAt: null, duration: 0, pausedRemaining: null },
  sync: { lastSyncedAt: null, pendingDeletions: [], status: "idle", error: null },
  smartPlan: null,
};

function allExercises(s: GymState): Exercise[] {
  return [...DEFAULT_EXERCISES, ...s.customExercises];
}

function lookup(s: GymState) {
  const map = new Map(allExercises(s).map((e) => [e.id, e]));
  return (id: string) => map.get(id);
}

/** Build a WorkoutExercise with progression-aware targets. */
function buildExercise(
  s: GymState,
  exerciseId: string,
  opts?: { sets?: number; reps?: string; rest?: number; warmups?: boolean },
): WorkoutExercise {
  const ex = lookup(s)(exerciseId);
  const compound = ex ? musclesFor(ex).compound : false;
  const p = prescription(s.profile.fitnessGoal, compound, ex?.muscleGroup);
  const reps = opts?.reps ?? p.reps;
  const sets = opts?.sets ?? p.sets;
  if (!ex) {
    return { id: uuid(), exerciseId, restSeconds: opts?.rest ?? 90, targetReps: reps, sets: Array.from({ length: sets }, () => newSet()) };
  }
  const sg = suggestSets({ exercise: ex, workouts: s.workouts, sets, reps, units: s.profile.units, warmups: opts?.warmups });
  return { id: uuid(), exerciseId, restSeconds: opts?.rest ?? p.rest, targetReps: reps, tip: sg.tip, trend: sg.trend, sets: sg.sets };
}

function queueDeletion(sync: SyncState, table: SyncTable, id: string): SyncState {
  const pending: PendingDeletion[] = [...sync.pendingDeletions, { table, id }].slice(-500);
  return { ...sync, pendingDeletions: pending };
}

function mapActiveExercise(
  w: Workout | null,
  weId: string,
  fn: (we: WorkoutExercise) => WorkoutExercise,
): Workout | null {
  if (!w) return w;
  return {
    ...w,
    updatedAt: nowIso(),
    exercises: w.exercises.map((we) => (we.id === weId ? fn(we) : we)),
  };
}

function newSet(prev?: WorkoutSet | null): WorkoutSet {
  return {
    id: uuid(),
    weight: prev?.weight ?? null,
    reps: prev?.reps ?? null,
    completed: false,
    type: "normal",
  };
}

function sortWorkouts(ws: Workout[]) {
  return [...ws].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export const useGym = create<GymStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setHydrated: () => set({ hydrated: true }),

      completeOnboarding: (name, units) =>
        set((s) => ({ onboarded: true, profile: { ...s.profile, name, units, updatedAt: nowIso() } })),

      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch, updatedAt: nowIso() } })),

      // ---------- Exercises ----------
      addCustomExercise: (e) => {
        const id = uuid();
        set((s) => ({ customExercises: [...s.customExercises, { ...e, id, isCustom: true, updatedAt: nowIso() }] }));
        return id;
      },
      updateCustomExercise: (id, patch) =>
        set((s) => ({
          customExercises: s.customExercises.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: nowIso() } : e)),
        })),
      deleteCustomExercise: (id) =>
        set((s) => ({
          customExercises: s.customExercises.filter((e) => e.id !== id),
          sync: queueDeletion(s.sync, "exercises", id),
        })),

      // ---------- Programs ----------
      saveProgram: (p) =>
        set((s) => {
          const updated = { ...p, updatedAt: nowIso() };
          const exists = s.programs.some((x) => x.id === p.id);
          return { programs: exists ? s.programs.map((x) => (x.id === p.id ? updated : x)) : [...s.programs, updated] };
        }),
      createProgram: () => {
        const id = uuid();
        const now = nowIso();
        set((s) => ({
          programs: [
            ...s.programs,
            {
              id,
              name: "My Program",
              description: "",
              isPreset: false,
              createdAt: now,
              updatedAt: now,
              days: [{ id: uuid(), name: "Day 1", weekdays: [], exercises: [] }],
            },
          ],
        }));
        return id;
      },
      duplicateProgram: (id) => {
        const src = get().programs.find((p) => p.id === id);
        if (!src) return null;
        const newId = uuid();
        const now = nowIso();
        const copy: WorkoutProgram = {
          ...src,
          id: newId,
          name: `${src.name} (Copy)`,
          isPreset: false,
          createdAt: now,
          updatedAt: now,
          days: src.days.map((d) => ({
            ...d,
            id: uuid(),
            exercises: d.exercises.map((e) => ({ ...e, id: uuid() })),
          })),
        };
        set((s) => ({ programs: [...s.programs, copy] }));
        return newId;
      },
      deleteProgram: (id) =>
        set((s) => ({
          programs: s.programs.filter((p) => p.id !== id),
          profile:
            s.profile.activeProgramId === id
              ? { ...s.profile, activeProgramId: null, updatedAt: nowIso() }
              : s.profile,
          sync: queueDeletion(s.sync, "workout_programs", id),
        })),
      setActiveProgram: (id) => set((s) => ({ profile: { ...s.profile, activeProgramId: id, updatedAt: nowIso() } })),

      // ---------- Active workout ----------
      startWorkout: ({ name, programId = null, programDayId = null, exercises = [] }) => {
        const now = nowIso();
        set({
          activeWorkout: { id: uuid(), name, programId, programDayId, startedAt: now, finishedAt: null, notes: "", exercises, updatedAt: now },
          restTimer: { endsAt: null, duration: 0, pausedRemaining: null },
        });
      },
      startFromProgramDay: (programId, dayId) => {
        const s = get();
        const program = s.programs.find((p) => p.id === programId);
        const day = program?.days.find((d) => d.id === dayId);
        if (!program || !day) return;
        const exercises: WorkoutExercise[] = day.exercises.map((pe) =>
          buildExercise(s, pe.exerciseId, { sets: pe.sets, reps: pe.reps, rest: pe.restSeconds }),
        );
        get().startWorkout({ name: day.name, programId, programDayId: dayId, exercises });
      },
      repeatWorkout: (workoutId) => {
        const w = get().workouts.find((x) => x.id === workoutId);
        if (!w) return;
        get().startWorkout({
          name: w.name,
          programId: w.programId,
          programDayId: w.programDayId,
          exercises: w.exercises.map((we) => ({
            ...we,
            id: uuid(),
            sets: we.sets.map((st) => ({ ...st, id: uuid(), completed: false })),
          })),
        });
      },
      updateActive: (patch) =>
        set((s) => (s.activeWorkout ? { activeWorkout: { ...s.activeWorkout, ...patch, updatedAt: nowIso() } } : {})),
      addExerciseToActive: (exerciseId) =>
        set((s) => {
          if (!s.activeWorkout) return {};
          const we = buildExercise(s, exerciseId);
          return { activeWorkout: { ...s.activeWorkout, exercises: [...s.activeWorkout.exercises, we], updatedAt: nowIso() } };
        }),
      replaceExerciseInActive: (weId, exerciseId) =>
        set((s) => {
          if (!s.activeWorkout) return {};
          return {
            activeWorkout: {
              ...s.activeWorkout,
              updatedAt: nowIso(),
              exercises: s.activeWorkout.exercises.map((we) => {
                if (we.id !== weId) return we;
                const work = we.sets.filter((x) => x.type !== "warmup").length || 3;
                return { ...buildExercise(s, exerciseId, { sets: work, reps: we.targetReps, rest: we.restSeconds }), id: we.id };
              }),
            },
          };
        }),
      removeExerciseFromActive: (weId) =>
        set((s) =>
          s.activeWorkout
            ? {
                activeWorkout: {
                  ...s.activeWorkout,
                  exercises: s.activeWorkout.exercises.filter((e) => e.id !== weId),
                  updatedAt: nowIso(),
                },
              }
            : {},
        ),
      moveExerciseInActive: (weId, dir) =>
        set((s) => {
          if (!s.activeWorkout) return {};
          const list = [...s.activeWorkout.exercises];
          const i = list.findIndex((e) => e.id === weId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return {};
          [list[i], list[j]] = [list[j], list[i]];
          return { activeWorkout: { ...s.activeWorkout, exercises: list, updatedAt: nowIso() } };
        }),
      setExerciseRest: (weId, seconds) =>
        set((s) => ({ activeWorkout: mapActiveExercise(s.activeWorkout, weId, (we) => ({ ...we, restSeconds: seconds })) })),
      addSet: (weId) =>
        set((s) => ({
          activeWorkout: mapActiveExercise(s.activeWorkout, weId, (we) => ({
            ...we,
            sets: [...we.sets, newSet(we.sets[we.sets.length - 1])],
          })),
        })),
      updateSet: (weId, setId, patch) =>
        set((s) => ({
          activeWorkout: mapActiveExercise(s.activeWorkout, weId, (we) => ({
            ...we,
            sets: we.sets.map((st) => (st.id === setId ? { ...st, ...patch } : st)),
          })),
        })),
      deleteSet: (weId, setId) =>
        set((s) => ({
          activeWorkout: mapActiveExercise(s.activeWorkout, weId, (we) => ({
            ...we,
            sets: we.sets.filter((st) => st.id !== setId),
          })),
        })),
      toggleSetComplete: (weId, setId) => {
        const s = get();
        const we = s.activeWorkout?.exercises.find((e) => e.id === weId);
        const st = we?.sets.find((x) => x.id === setId);
        if (!we || !st) return;
        const completing = !st.completed;
        set({
          activeWorkout: mapActiveExercise(s.activeWorkout, weId, (e) => ({
            ...e,
            sets: e.sets.map((x) => (x.id === setId ? { ...x, completed: completing } : x)),
          })),
        });
        if (completing && we.restSeconds > 0) get().startRest(we.restSeconds);
      },
      finishWorkout: () => {
        const s = get();
        const w = s.activeWorkout;
        if (!w) return null;
        const now = nowIso();
        // Keep only exercises that have at least one completed set; drop uncompleted sets.
        const exercises = w.exercises
          .map((we) => ({ ...we, sets: we.sets.filter((st) => st.completed) }))
          .filter((we) => we.sets.length > 0);
        const finished: Workout = { ...w, exercises, finishedAt: now, updatedAt: now };
        set({
          workouts: sortWorkouts([finished, ...s.workouts]),
          activeWorkout: null,
          smartPlan: null,
          restTimer: { endsAt: null, duration: 0, pausedRemaining: null },
        });
        return finished.id;
      },
      discardWorkout: () => set({ activeWorkout: null, restTimer: { endsAt: null, duration: 0, pausedRemaining: null } }),

      // ---------- Smart workout ----------
      regenerateSmartPlan: (opts) =>
        set((s) => {
          const recovery = computeRecovery(s.workouts, lookup(s));
          const plan = generateSmartPlan({
            exercises: allExercises(s),
            workouts: s.workouts,
            recovery,
            profile: s.profile,
            split: opts?.split,
            seed: opts?.keepSeed ? s.smartPlan?.seed : undefined,
          });
          return { smartPlan: plan };
        }),
      swapPlanExercise: (weId, exerciseId) =>
        set((s) => {
          if (!s.smartPlan) return {};
          return {
            smartPlan: {
              ...s.smartPlan,
              exercises: s.smartPlan.exercises.map((we) => {
                if (we.id !== weId) return we;
                const work = we.sets.filter((x) => x.type !== "warmup").length || 3;
                const warmups = we.sets.some((x) => x.type === "warmup");
                return { ...buildExercise(s, exerciseId, { sets: work, reps: we.targetReps, rest: we.restSeconds, warmups }), id: we.id };
              }),
            },
          };
        }),
      removePlanExercise: (weId) =>
        set((s) => (s.smartPlan ? { smartPlan: { ...s.smartPlan, exercises: s.smartPlan.exercises.filter((e) => e.id !== weId) } } : {})),
      startSmartPlan: () => {
        const plan = get().smartPlan;
        if (!plan) return;
        get().startWorkout({
          name: plan.name,
          exercises: plan.exercises.map((we) => ({ ...we, sets: we.sets.map((x) => ({ ...x, id: uuid(), completed: false })) })),
        });
        set({ smartPlan: null });
      },

      toggleFavorite: (exerciseId) =>
        set((s) => {
          const fav = s.profile.favoriteExercises.includes(exerciseId);
          return {
            profile: {
              ...s.profile,
              favoriteExercises: fav ? s.profile.favoriteExercises.filter((x) => x !== exerciseId) : [...s.profile.favoriteExercises, exerciseId],
              excludedExercises: s.profile.excludedExercises.filter((x) => x !== exerciseId),
              updatedAt: nowIso(),
            },
          };
        }),
      toggleExcluded: (exerciseId) =>
        set((s) => {
          const ex = s.profile.excludedExercises.includes(exerciseId);
          return {
            profile: {
              ...s.profile,
              excludedExercises: ex ? s.profile.excludedExercises.filter((x) => x !== exerciseId) : [...s.profile.excludedExercises, exerciseId],
              favoriteExercises: s.profile.favoriteExercises.filter((x) => x !== exerciseId),
              updatedAt: nowIso(),
            },
          };
        }),

      // ---------- History ----------
      updateWorkout: (id, patch) =>
        set((s) => ({
          workouts: sortWorkouts(s.workouts.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: nowIso() } : w))),
        })),
      deleteWorkout: (id) =>
        set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id), sync: queueDeletion(s.sync, "workouts", id) })),

      // ---------- Body ----------
      addMeasurement: (m) =>
        set((s) => ({
          body: [...s.body, { ...m, id: uuid(), updatedAt: nowIso() }].sort((a, b) => a.date.localeCompare(b.date)),
        })),
      updateMeasurement: (id, patch) =>
        set((s) => ({
          body: s.body
            .map((m) => (m.id === id ? { ...m, ...patch, updatedAt: nowIso() } : m))
            .sort((a, b) => a.date.localeCompare(b.date)),
        })),
      deleteMeasurement: (id) =>
        set((s) => ({ body: s.body.filter((m) => m.id !== id), sync: queueDeletion(s.sync, "body_measurements", id) })),

      // ---------- Nutrition ----------
      addFood: (f) => set((s) => ({ nutrition: [...s.nutrition, { ...f, id: uuid(), updatedAt: nowIso() }] })),
      deleteFood: (id) =>
        set((s) => ({ nutrition: s.nutrition.filter((n) => n.id !== id), sync: queueDeletion(s.sync, "nutrition_logs", id) })),

      // ---------- Rest timer ----------
      startRest: (seconds) => set({ restTimer: { endsAt: Date.now() + seconds * 1000, duration: seconds, pausedRemaining: null } }),
      adjustRest: (delta) =>
        set((s) => {
          if (!s.restTimer.endsAt) return {};
          const endsAt = Math.max(Date.now() + 1000, s.restTimer.endsAt + delta * 1000);
          return { restTimer: { ...s.restTimer, endsAt, duration: Math.max(1, s.restTimer.duration + delta) } };
        }),
      stopRest: () => set({ restTimer: { endsAt: null, duration: 0, pausedRemaining: null } }),

      // ---------- Data ----------
      setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),
      replaceData: (data) => set((s) => ({ ...s, ...data, hydrated: true })),
      resetAll: () => set({ ...initialState, hydrated: true, onboarded: true }),
    }),
    {
      name: "gymtrack-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        onboarded: s.onboarded,
        profile: s.profile,
        customExercises: s.customExercises,
        programs: s.programs,
        workouts: s.workouts,
        activeWorkout: s.activeWorkout,
        body: s.body,
        nutrition: s.nutrition,
        restTimer: s.restTimer,
        smartPlan: s.smartPlan,
        sync: { ...s.sync, status: "idle" as const, error: null },
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GymState>;
        return {
          ...current,
          ...p,
          profile: { ...DEFAULT_PROFILE, ...(p.profile ?? {}), nutritionGoals: { ...DEFAULT_PROFILE.nutritionGoals, ...(p.profile?.nutritionGoals ?? {}) }, smart: { ...DEFAULT_PROFILE.smart, ...(p.profile?.smart ?? {}) } },
          sync: { ...initialState.sync, ...(p.sync ?? {}) },
        };
      },
    },
  ),
);

// ---------- Selectors / helper hooks ----------

export function useExercises(): Exercise[] {
  const custom = useGym((s) => s.customExercises);
  return useMemo(() => [...DEFAULT_EXERCISES, ...custom].sort((a, b) => a.name.localeCompare(b.name)), [custom]);
}

export function useExerciseMap(): Map<string, Exercise> {
  const all = useExercises();
  return useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
}

export function getExerciseById(id: string): Exercise | undefined {
  return DEFAULT_EXERCISES.find((e) => e.id === id) ?? useGym.getState().customExercises.find((e) => e.id === id);
}
