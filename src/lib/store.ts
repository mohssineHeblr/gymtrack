"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useMemo } from "react";
import { DEFAULT_EXERCISES } from "@/data/exercises";
import { FOOD_DATABASE } from "@/data/foods";
import { PRESET_PROGRAMS } from "@/data/programs";
import type {
  BodyMeasurement,
  Exercise,
  Food,
  MealItem,
  MealRecord,
  MealType,
  NutritionLog,
  PendingDeletion,
  Profile,
  RestTimerState,
  SavedMeal,
  SetStage,
  SyncState,
  SyncTable,
  Technique,
  Workout,
  WorkoutExercise,
  WorkoutProgram,
  WorkoutSet,
} from "./types";
import { nowIso, uuid } from "./utils";
import { EQUIPMENT, normalizeGroup, type SplitFocus } from "./types";
import { musclesFor } from "@/data/muscles";
import { computeRecovery } from "./recovery";
import { generateSmartPlan, type SmartPlan } from "./generator";
import { prescription, roundLoad, suggestSets } from "./progression";
import { legacyNutritionToMeals, withGrams } from "./nutrition";
import { groupKind, groupLetters, moveInList, nextInRound, normalizeGroups, restForSet } from "./techniques";

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
  timer: {
    sound: true,
    alarm: "chime",
    volume: 0.8,
    vibration: true,
    notifications: false,
    push: false,
    autoStart: true,
    defaultRest: 90,
  },
  favoriteFoods: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const IDLE_TIMER: RestTimerState = { endsAt: null, duration: 0, pausedRemaining: null, alertedFor: null, label: null };

export interface GymState {
  hydrated: boolean;
  onboarded: boolean;
  profile: Profile;
  customExercises: Exercise[];
  programs: WorkoutProgram[];
  workouts: Workout[];
  activeWorkout: Workout | null;
  body: BodyMeasurement[];
  meals: MealRecord[];
  /** User foods: custom entries and Open Food Facts items that were used or favourited */
  foods: Food[];
  savedMeals: SavedMeal[];
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
  addExerciseToActive: (exerciseId: string, groupId?: string | null) => void;
  removeExerciseFromActive: (weId: string) => void;
  moveExerciseInActive: (weId: string, dir: -1 | 1) => void;
  setExerciseRest: (weId: string, seconds: number) => void;
  setExerciseTechnique: (weId: string, technique: Technique, tempo?: string) => void;
  groupExercises: (weIds: string[]) => void;
  ungroupExercise: (weId: string) => void;
  addSet: (weId: string) => void;
  updateSet: (weId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  deleteSet: (weId: string, setId: string) => void;
  addStage: (weId: string, setId: string) => void;
  updateStage: (weId: string, setId: string, stageId: string, patch: Partial<SetStage>) => void;
  deleteStage: (weId: string, setId: string, stageId: string) => void;
  /** Returns the id of the next exercise to perform when inside a superset round */
  toggleSetComplete: (weId: string, setId: string) => string | null;
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

  // Nutrition
  addMealItems: (date: string, type: MealType, items: Omit<MealItem, "id">[]) => void;
  updateMealItemGrams: (mealId: string, itemId: string, grams: number) => void;
  removeMealItem: (mealId: string, itemId: string) => void;
  copyMeal: (fromMealId: string, toDate: string, toType: MealType) => void;
  clearMeal: (mealId: string) => void;
  saveMealTemplate: (name: string, items: Omit<MealItem, "id">[]) => string;
  deleteSavedMeal: (id: string) => void;
  upsertFood: (food: Food) => void;
  addCustomFood: (food: Omit<Food, "id" | "source" | "updatedAt">) => string;
  deleteCustomFood: (id: string) => void;
  toggleFavoriteFood: (food: Food) => void;

  // Rest timer
  startRest: (seconds: number, label?: string | null) => void;
  adjustRest: (delta: number) => void;
  pauseRest: () => void;
  resumeRest: () => void;
  resetRest: () => void;
  stopRest: () => void;
  markRestAlerted: (endsAt: number) => void;

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
  meals: [],
  foods: [],
  savedMeals: [],
  restTimer: IDLE_TIMER,
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

function mapSet(w: Workout | null, weId: string, setId: string, fn: (st: WorkoutSet) => WorkoutSet) {
  return mapActiveExercise(w, weId, (we) => ({ ...we, sets: we.sets.map((st) => (st.id === setId ? fn(st) : st)) }));
}

function withExercises(w: Workout | null, fn: (list: WorkoutExercise[]) => WorkoutExercise[]): Workout | null {
  if (!w) return w;
  return { ...w, exercises: normalizeGroups(fn(w.exercises)), updatedAt: nowIso() };
}

function newSet(prev?: WorkoutSet | null): WorkoutSet {
  return {
    id: uuid(),
    weight: prev?.weight ?? null,
    reps: prev?.reps ?? null,
    completed: false,
    type: prev?.type === "warmup" ? "normal" : (prev?.type ?? "normal"),
    restSeconds: prev?.restSeconds ?? null,
    stages: prev?.stages?.length ? prev.stages.map((x) => ({ ...x, id: uuid() })) : undefined,
  };
}

function sortWorkouts(ws: Workout[]) {
  return [...ws].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function touchMeal(meals: MealRecord[], mealId: string, fn: (m: MealRecord) => MealRecord): MealRecord[] {
  return meals.map((m) => (m.id === mealId ? { ...fn(m), updatedAt: nowIso() } : m));
}

/** Copy exercises from a source (program / history) giving every row fresh ids but keeping groups intact. */
function cloneExercises(list: WorkoutExercise[]): WorkoutExercise[] {
  const groupMap = new Map<string, string>();
  return list.map((we) => ({
    ...we,
    id: uuid(),
    groupId: we.groupId ? (groupMap.get(we.groupId) ?? (groupMap.set(we.groupId, uuid()), groupMap.get(we.groupId)!)) : null,
    sets: we.sets.map((st) => ({ ...st, id: uuid(), completed: false, stages: st.stages?.map((x) => ({ ...x, id: uuid() })) })),
  }));
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
        // Never create a duplicate: reuse an existing exercise with the same name
        const existing = allExercises(get()).find((x) => nameKey(x.name) === nameKey(e.name));
        if (existing) return existing.id;
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
          activeWorkout: {
            id: uuid(),
            name,
            programId,
            programDayId,
            startedAt: now,
            finishedAt: null,
            notes: "",
            exercises: normalizeGroups(exercises),
            updatedAt: now,
          },
          restTimer: IDLE_TIMER,
        });
      },
      startFromProgramDay: (programId, dayId) => {
        const s = get();
        const program = s.programs.find((p) => p.id === programId);
        const day = program?.days.find((d) => d.id === dayId);
        if (!program || !day) return;
        const exercises: WorkoutExercise[] = day.exercises.map((pe) => ({
          ...buildExercise(s, pe.exerciseId, { sets: pe.sets, reps: pe.reps, rest: pe.restSeconds }),
          technique: pe.technique,
          tempo: pe.tempo,
          groupId: pe.groupId ?? null,
        }));
        get().startWorkout({ name: day.name, programId, programDayId: dayId, exercises: cloneExercises(exercises) });
      },
      repeatWorkout: (workoutId) => {
        const w = get().workouts.find((x) => x.id === workoutId);
        if (!w) return;
        get().startWorkout({
          name: w.name,
          programId: w.programId,
          programDayId: w.programDayId,
          exercises: cloneExercises(w.exercises),
        });
      },
      updateActive: (patch) =>
        set((s) => (s.activeWorkout ? { activeWorkout: { ...s.activeWorkout, ...patch, updatedAt: nowIso() } } : {})),
      addExerciseToActive: (exerciseId, groupId = null) =>
        set((s) => {
          if (!s.activeWorkout) return {};
          const we = { ...buildExercise(s, exerciseId), groupId };
          return { activeWorkout: withExercises(s.activeWorkout, (list) => [...list, we]) };
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
                return {
                  ...buildExercise(s, exerciseId, { sets: work, reps: we.targetReps, rest: we.restSeconds }),
                  id: we.id,
                  groupId: we.groupId,
                  technique: we.technique,
                  tempo: we.tempo,
                };
              }),
            },
          };
        }),
      removeExerciseFromActive: (weId) =>
        set((s) => ({ activeWorkout: withExercises(s.activeWorkout, (list) => list.filter((e) => e.id !== weId)) })),
      moveExerciseInActive: (weId, dir) =>
        set((s) => ({ activeWorkout: withExercises(s.activeWorkout, (list) => moveInList(list, weId, dir)) })),
      setExerciseRest: (weId, seconds) =>
        set((s) => ({ activeWorkout: mapActiveExercise(s.activeWorkout, weId, (we) => ({ ...we, restSeconds: seconds })) })),
      setExerciseTechnique: (weId, technique, tempo) =>
        set((s) => ({
          activeWorkout: mapActiveExercise(s.activeWorkout, weId, (we) => ({
            ...we,
            technique,
            tempo: technique === "tempo" ? (tempo ?? we.tempo ?? "3-1-1-0") : undefined,
            // Stages only make sense for drop / mini-set techniques
            sets:
              technique === "dropset" || technique === "rest_pause" || technique === "myo_reps"
                ? we.sets
                : we.sets.map((st) => (st.stages?.length && !st.completed ? { ...st, stages: undefined } : st)),
          })),
        })),
      groupExercises: (weIds) =>
        set((s) => {
          if (!s.activeWorkout || weIds.length < 2) return {};
          const list = s.activeWorkout.exercises;
          // merge any existing groups the selected exercises belong to
          const existing = new Set(list.filter((e) => weIds.includes(e.id) && e.groupId).map((e) => e.groupId!));
          const members = list.filter((e) => weIds.includes(e.id) || (e.groupId && existing.has(e.groupId)));
          const groupId = uuid();
          const memberIds = new Set(members.map((m) => m.id));
          const first = list.findIndex((e) => memberIds.has(e.id));
          const rest = list.filter((e) => !memberIds.has(e.id));
          const ordered = [...rest.slice(0, first), ...members.map((m) => ({ ...m, groupId })), ...rest.slice(first)];
          return { activeWorkout: { ...s.activeWorkout, exercises: normalizeGroups(ordered), updatedAt: nowIso() } };
        }),
      ungroupExercise: (weId) =>
        set((s) => ({
          activeWorkout: withExercises(s.activeWorkout, (list) => {
            const we = list.find((e) => e.id === weId);
            if (!we?.groupId) return list;
            const others = list.filter((e) => e.id !== weId);
            const lastIdx = others.reduce((a, e, i) => (e.groupId === we.groupId ? i : a), -1);
            const out = [...others];
            out.splice(lastIdx + 1, 0, { ...we, groupId: null });
            return out;
          }),
        })),
      addSet: (weId) =>
        set((s) => ({
          activeWorkout: mapActiveExercise(s.activeWorkout, weId, (we) => ({
            ...we,
            sets: [...we.sets, newSet(we.sets[we.sets.length - 1])],
          })),
        })),
      updateSet: (weId, setId, patch) =>
        set((s) => ({ activeWorkout: mapSet(s.activeWorkout, weId, setId, (st) => ({ ...st, ...patch })) })),
      deleteSet: (weId, setId) =>
        set((s) => ({
          activeWorkout: mapActiveExercise(s.activeWorkout, weId, (we) => ({
            ...we,
            sets: we.sets.filter((st) => st.id !== setId),
          })),
        })),
      addStage: (weId, setId) =>
        set((s) => {
          const we = s.activeWorkout?.exercises.find((e) => e.id === weId);
          const units = s.profile.units;
          return {
            activeWorkout: mapSet(s.activeWorkout, weId, setId, (st) => {
              const prev = st.stages?.length ? st.stages[st.stages.length - 1] : st;
              const base = prev.weight ?? st.weight ?? null;
              const ex = we ? lookup(s)(we.exerciseId) : undefined;
              // Dropsets drop ~20%; rest-pause and myo-reps keep the same load
              const weight =
                we?.technique === "dropset" && base ? Math.max(0, roundLoad(base * 0.8, { equipment: ex?.equipment ?? "Barbell" }, units)) : base;
              return { ...st, stages: [...(st.stages ?? []), { id: uuid(), weight, reps: null }] };
            }),
          };
        }),
      updateStage: (weId, setId, stageId, patch) =>
        set((s) => ({
          activeWorkout: mapSet(s.activeWorkout, weId, setId, (st) => ({
            ...st,
            stages: st.stages?.map((x) => (x.id === stageId ? { ...x, ...patch } : x)),
          })),
        })),
      deleteStage: (weId, setId, stageId) =>
        set((s) => ({
          activeWorkout: mapSet(s.activeWorkout, weId, setId, (st) => {
            const stages = st.stages?.filter((x) => x.id !== stageId);
            return { ...st, stages: stages?.length ? stages : undefined };
          }),
        })),
      toggleSetComplete: (weId, setId) => {
        const s = get();
        const w = s.activeWorkout;
        const we = w?.exercises.find((e) => e.id === weId);
        const st = we?.sets.find((x) => x.id === setId);
        if (!w || !we || !st) return null;
        const completing = !st.completed;
        const updated = mapSet(w, weId, setId, (x) => ({ ...x, completed: completing }));
        set({ activeWorkout: updated });
        if (!completing || !updated) return null;

        const timer = s.profile.timer;
        const list = updated.exercises;
        const members = we.groupId ? list.filter((e) => e.groupId === we.groupId) : [];
        if (members.length > 1 && st.type !== "warmup") {
          // Superset / giant set: rest only after the whole round is finished
          const workIndex = we.sets.filter((x) => x.type !== "warmup").findIndex((x) => x.id === setId);
          const next = nextInRound(members, weId, workIndex);
          if (next) {
            if (s.restTimer.endsAt) get().stopRest();
            return next;
          }
          const rest = Math.max(
            ...members.map((m) => {
              const ms = m.sets.filter((x) => x.type !== "warmup")[workIndex];
              return restForSet(m, ms);
            }),
          );
          const letter = groupLetters(list).get(we.groupId!) ?? "";
          if (timer.autoStart && rest > 0) get().startRest(rest, `${groupKind(members.length)} ${letter} · round ${workIndex + 1} done`);
          return null;
        }
        const rest = restForSet(we, st);
        if (timer.autoStart && rest > 0) get().startRest(rest);
        return null;
      },
      finishWorkout: () => {
        const s = get();
        const w = s.activeWorkout;
        if (!w) return null;
        const now = nowIso();
        // Keep only exercises that have at least one completed set; drop uncompleted sets and empty stages.
        const exercises = normalizeGroups(
          w.exercises
            .map((we) => ({
              ...we,
              tip: undefined,
              trend: undefined,
              sets: we.sets
                .filter((st) => st.completed)
                .map((st) => {
                  const stages = st.stages?.filter((x) => (x.reps ?? 0) > 0);
                  return { ...st, stages: stages?.length ? stages : undefined };
                }),
            }))
            .filter((we) => we.sets.length > 0),
        );
        const finished: Workout = { ...w, exercises, finishedAt: now, updatedAt: now };
        set({
          workouts: sortWorkouts([finished, ...s.workouts]),
          activeWorkout: null,
          smartPlan: null,
          restTimer: IDLE_TIMER,
        });
        return finished.id;
      },
      discardWorkout: () => set({ activeWorkout: null, restTimer: IDLE_TIMER }),

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
      addMealItems: (date, type, items) =>
        set((s) => {
          if (!items.length) return {};
          const withIds = items.map((i) => ({ ...i, id: uuid() }));
          const existing = s.meals.find((m) => m.date === date && m.type === type);
          if (existing) return { meals: touchMeal(s.meals, existing.id, (m) => ({ ...m, items: [...m.items, ...withIds] })) };
          return { meals: [...s.meals, { id: uuid(), date, type, items: withIds, updatedAt: nowIso() }] };
        }),
      updateMealItemGrams: (mealId, itemId, grams) =>
        set((s) => ({
          meals: touchMeal(s.meals, mealId, (m) => ({ ...m, items: m.items.map((i) => (i.id === itemId ? withGrams(i, grams) : i)) })),
        })),
      removeMealItem: (mealId, itemId) =>
        set((s) => {
          const meal = s.meals.find((m) => m.id === mealId);
          if (!meal) return {};
          const items = meal.items.filter((i) => i.id !== itemId);
          if (!items.length) return { meals: s.meals.filter((m) => m.id !== mealId), sync: queueDeletion(s.sync, "meals", mealId) };
          return { meals: touchMeal(s.meals, mealId, (m) => ({ ...m, items })) };
        }),
      clearMeal: (mealId) =>
        set((s) => ({ meals: s.meals.filter((m) => m.id !== mealId), sync: queueDeletion(s.sync, "meals", mealId) })),
      copyMeal: (fromMealId, toDate, toType) => {
        const src = get().meals.find((m) => m.id === fromMealId);
        if (!src) return;
        get().addMealItems(
          toDate,
          toType,
          src.items.map(({ id: _id, ...rest }) => rest),
        );
      },
      saveMealTemplate: (name, items) => {
        const id = uuid();
        set((s) => ({ savedMeals: [...s.savedMeals, { id, name: name.trim() || "My meal", items, updatedAt: nowIso() }] }));
        return id;
      },
      deleteSavedMeal: (id) =>
        set((s) => ({ savedMeals: s.savedMeals.filter((m) => m.id !== id), sync: queueDeletion(s.sync, "saved_meals", id) })),
      upsertFood: (food) =>
        set((s) => {
          if (food.source === "builtin") return {};
          const exists = s.foods.some((f) => f.id === food.id);
          const next = { ...food, updatedAt: nowIso() };
          return { foods: exists ? s.foods.map((f) => (f.id === food.id ? { ...f, ...next } : f)) : [...s.foods, next] };
        }),
      addCustomFood: (food) => {
        const id = `custom-${uuid()}`;
        set((s) => ({ foods: [...s.foods, { ...food, id, source: "custom", updatedAt: nowIso() }] }));
        return id;
      },
      deleteCustomFood: (id) =>
        set((s) => ({
          foods: s.foods.filter((f) => f.id !== id),
          profile: { ...s.profile, favoriteFoods: s.profile.favoriteFoods.filter((x) => x !== id), updatedAt: nowIso() },
          sync: queueDeletion(s.sync, "foods", id),
        })),
      toggleFavoriteFood: (food) => {
        const s = get();
        const fav = s.profile.favoriteFoods.includes(food.id);
        if (!fav && food.source !== "builtin") get().upsertFood(food);
        set((st) => ({
          profile: {
            ...st.profile,
            favoriteFoods: fav ? st.profile.favoriteFoods.filter((x) => x !== food.id) : [...st.profile.favoriteFoods, food.id],
            updatedAt: nowIso(),
          },
        }));
      },

      // ---------- Rest timer ----------
      startRest: (seconds, label = null) =>
        set({
          restTimer: { endsAt: Date.now() + Math.max(1, seconds) * 1000, duration: Math.max(1, seconds), pausedRemaining: null, alertedFor: null, label },
        }),
      adjustRest: (delta) =>
        set((s) => {
          const t = s.restTimer;
          if (t.pausedRemaining != null) {
            const pr = Math.max(1, t.pausedRemaining + delta);
            return { restTimer: { ...t, pausedRemaining: pr, duration: Math.max(pr, t.duration + delta) } };
          }
          if (!t.endsAt) return {};
          const endsAt = Math.max(Date.now() + 1000, t.endsAt + delta * 1000);
          const remaining = (endsAt - Date.now()) / 1000;
          return { restTimer: { ...t, endsAt, duration: Math.max(Math.ceil(remaining), t.duration + delta), alertedFor: null } };
        }),
      pauseRest: () =>
        set((s) => {
          const t = s.restTimer;
          if (!t.endsAt) return {};
          const remaining = Math.max(1, Math.ceil((t.endsAt - Date.now()) / 1000));
          return { restTimer: { ...t, endsAt: null, pausedRemaining: remaining } };
        }),
      resumeRest: () =>
        set((s) => {
          const t = s.restTimer;
          if (t.pausedRemaining == null) return {};
          return { restTimer: { ...t, endsAt: Date.now() + t.pausedRemaining * 1000, pausedRemaining: null, alertedFor: null } };
        }),
      resetRest: () =>
        set((s) => {
          const t = s.restTimer;
          if (!t.duration) return {};
          if (t.pausedRemaining != null) return { restTimer: { ...t, pausedRemaining: t.duration } };
          return { restTimer: { ...t, endsAt: Date.now() + t.duration * 1000, alertedFor: null } };
        }),
      stopRest: () => set({ restTimer: IDLE_TIMER }),
      markRestAlerted: (endsAt) => set((s) => ({ restTimer: { ...s.restTimer, alertedFor: endsAt } })),

      // ---------- Data ----------
      setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),
      replaceData: (data) => set((s) => ({ ...s, ...data, hydrated: true })),
      resetAll: () => set({ ...initialState, hydrated: true, onboarded: true }),
    }),
    {
      name: "gymtrack-v1",
      version: 2,
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
        meals: s.meals,
        foods: s.foods,
        savedMeals: s.savedMeals,
        restTimer: s.restTimer,
        smartPlan: s.smartPlan,
        sync: { ...s.sync, status: "idle" as const, error: null },
      }),
      migrate: (persisted, version) => migrateState(persisted as Record<string, unknown>, version),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GymState>;
        return {
          ...current,
          ...p,
          customExercises: (p.customExercises ?? []).map((e) => ({ ...e, muscleGroup: normalizeGroup(e.muscleGroup) })),
          profile: {
            ...DEFAULT_PROFILE,
            ...(p.profile ?? {}),
            nutritionGoals: { ...DEFAULT_PROFILE.nutritionGoals, ...(p.profile?.nutritionGoals ?? {}) },
            smart: { ...DEFAULT_PROFILE.smart, ...(p.profile?.smart ?? {}) },
            timer: { ...DEFAULT_PROFILE.timer, ...(p.profile?.timer ?? {}) },
          },
          restTimer: { ...IDLE_TIMER, ...(p.restTimer ?? {}) },
          sync: { ...initialState.sync, ...(p.sync ?? {}) },
        };
      },
    },
  ),
);

/** v1 → v2: flat nutrition logs become meal records; "Legs" exercises are re-categorised. */
export function migrateState(state: Record<string, unknown>, version: number): Record<string, unknown> {
  const s = { ...state };
  if (version < 2) {
    const legacy = (s.nutrition as NutritionLog[] | undefined) ?? [];
    s.meals = [...((s.meals as MealRecord[] | undefined) ?? []), ...legacyNutritionToMeals(legacy)];
    delete s.nutrition;
    s.foods = s.foods ?? [];
    s.savedMeals = s.savedMeals ?? [];
    if (Array.isArray(s.customExercises)) {
      s.customExercises = (s.customExercises as Exercise[]).map((e) => ({ ...e, muscleGroup: normalizeGroup(e.muscleGroup) }));
    }
  }
  return s;
}

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

/** Built-in food database + the user's own / cached foods. */
export function useFoods(): Food[] {
  const own = useGym((s) => s.foods);
  return useMemo(() => {
    const ids = new Set(own.map((f) => f.id));
    return [...own, ...FOOD_DATABASE.filter((f) => !ids.has(f.id))];
  }, [own]);
}

/** Normalised name for duplicate detection */
export const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
