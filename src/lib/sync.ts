"use client";

/**
 * Local-first sync engine.
 *
 * All data lives in localStorage (via the zustand store) so the app works fully offline.
 * When the user is signed in and online, local changes (updatedAt > lastSyncedAt) are pushed
 * to Supabase and remote changes are pulled and merged (last-write-wins by updated_at).
 * Deletions are queued locally and applied on the server as soft deletes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "./auth";
import { computePRs, workoutDurationSec, workoutVolume } from "./stats";
import { useGym } from "./store";
import { getSupabase } from "./supabase";
import type {
  BodyMeasurement,
  Exercise,
  NutritionLog,
  Profile,
  Workout,
  WorkoutProgram,
} from "./types";
import { nowIso } from "./utils";

const CHUNK = 400;

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function run<T>(p: PromiseLike<{ error: { message: string } | null; data?: T | null }>) {
  const res = await p;
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const newer = (a: string | undefined, since: string | null) => !since || (a ?? "") > since;

let syncing: Promise<void> | null = null;

export function hasLocalChanges(): boolean {
  const s = useGym.getState();
  const since = s.sync.lastSyncedAt;
  if (!since) return true;
  if (s.sync.pendingDeletions.length) return true;
  return (
    s.profile.updatedAt > since ||
    s.customExercises.some((e) => (e.updatedAt ?? "") > since) ||
    s.programs.some((p) => p.updatedAt > since) ||
    s.workouts.some((w) => w.updatedAt > since) ||
    s.body.some((b) => b.updatedAt > since) ||
    s.nutrition.some((n) => n.updatedAt > since)
  );
}

export function syncNow(): Promise<void> {
  if (syncing) return syncing;
  syncing = doSync().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function doSync() {
  const sb = getSupabase();
  const user = useAuth.getState().user;
  const store = useGym.getState();
  if (!sb || !user) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    store.setSync({ status: "offline" });
    return;
  }
  store.setSync({ status: "syncing", error: null });
  const startedAt = nowIso();
  try {
    await push(sb, user.id);
    await pull(sb);
    useGym.getState().setSync({ status: "idle", lastSyncedAt: startedAt, error: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[sync] failed:", message);
    useGym.getState().setSync({ status: "error", error: message });
  }
}

// ---------------------------------------------------------------------------
// PUSH
// ---------------------------------------------------------------------------

async function push(sb: SupabaseClient, userId: string) {
  const s = useGym.getState();
  const since = s.sync.lastSyncedAt;

  // Profile
  if (newer(s.profile.updatedAt, since)) {
    await run(sb.from("profiles").upsert(profileToRow(s.profile, userId)));
  }

  // Custom exercises (must exist before workouts reference them)
  const exRows = s.customExercises.filter((e) => newer(e.updatedAt, since)).map((e) => exerciseToRow(e, userId));
  for (const c of chunks(exRows)) await run(sb.from("exercises").upsert(c));

  // Programs
  const progRows = s.programs.filter((p) => newer(p.updatedAt, since)).map((p) => programToRow(p, userId));
  for (const c of chunks(progRows)) await run(sb.from("workout_programs").upsert(c, { onConflict: "user_id,id" }));

  // Workouts (+ children, replaced wholesale)
  const dirtyWorkouts = s.workouts.filter((w) => newer(w.updatedAt, since));
  for (const batch of chunks(dirtyWorkouts, 50)) {
    await run(sb.from("workouts").upsert(batch.map((w) => workoutToRow(w, userId))));
    await run(sb.from("workout_exercises").delete().in("workout_id", batch.map((w) => w.id)));
    const weRows = batch.flatMap((w) =>
      w.exercises.map((we, position) => ({
        id: we.id,
        workout_id: w.id,
        user_id: userId,
        exercise_id: we.exerciseId,
        position,
        rest_seconds: we.restSeconds,
        notes: we.notes ?? null,
      })),
    );
    for (const c of chunks(weRows)) await run(sb.from("workout_exercises").insert(c));
    const setRows = batch.flatMap((w) =>
      w.exercises.flatMap((we) =>
        we.sets.map((st, position) => ({
          id: st.id,
          workout_exercise_id: we.id,
          user_id: userId,
          position,
          weight: st.weight,
          reps: st.reps,
          completed: st.completed,
          set_type: st.type,
        })),
      ),
    );
    for (const c of chunks(setRows)) await run(sb.from("workout_sets").insert(c));
  }

  // Body measurements
  const bodyRows = s.body.filter((b) => newer(b.updatedAt, since)).map((b) => bodyToRow(b, userId));
  for (const c of chunks(bodyRows)) await run(sb.from("body_measurements").upsert(c));

  // Nutrition
  const nutRows = s.nutrition.filter((n) => newer(n.updatedAt, since)).map((n) => nutritionToRow(n, userId));
  for (const c of chunks(nutRows)) await run(sb.from("nutrition_logs").upsert(c));

  // Deletions (soft delete)
  const pending = [...s.sync.pendingDeletions];
  for (const d of pending) {
    let q = sb.from(d.table).update({ deleted: true, updated_at: nowIso() }).eq("id", d.id);
    if (d.table === "workout_programs") q = q.eq("user_id", userId);
    await run(q);
  }
  if (pending.length) {
    const remaining = useGym
      .getState()
      .sync.pendingDeletions.filter((p) => !pending.some((x) => x.id === p.id && x.table === p.table));
    useGym.getState().setSync({ pendingDeletions: remaining });
  }

  // Personal records (derived) — only when workouts changed
  if (dirtyWorkouts.length || pending.some((p) => p.table === "workouts")) {
    const prs = [...computePRs(useGym.getState().workouts).values()].map((p) => ({
      user_id: userId,
      exercise_id: p.exerciseId,
      best_weight: p.bestWeight,
      best_weight_reps: p.bestWeightReps,
      best_e1rm: Math.round(p.bestE1rm * 100) / 100,
      best_volume_set: p.bestVolumeSet,
      max_reps: p.maxReps,
      achieved_at: p.achievedAt,
      workout_id: p.workoutId,
      updated_at: nowIso(),
    }));
    for (const c of chunks(prs)) await run(sb.from("personal_records").upsert(c, { onConflict: "user_id,exercise_id" }));
  }
}

// ---------------------------------------------------------------------------
// PULL
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function mergeById<T extends { id: string; updatedAt?: string }>(local: T[], remote: Row[], map: (r: Row) => T): T[] {
  const byId = new Map(local.map((x) => [x.id, x]));
  for (const r of remote) {
    const id = String(r.id);
    if (r.deleted) {
      byId.delete(id);
      continue;
    }
    const cur = byId.get(id);
    const remoteUpdated = iso(r.updated_at);
    if (!cur || remoteUpdated > (cur.updatedAt ?? "")) byId.set(id, map(r));
  }
  return [...byId.values()];
}

async function pull(sb: SupabaseClient) {
  const since = useGym.getState().sync.lastSyncedAt;
  // small margin for clock skew between devices
  const sinceMargin = since ? new Date(new Date(since).getTime() - 10 * 60 * 1000).toISOString() : null;
  const filtered = <Q extends { gte: (c: string, v: string) => Q }>(q: Q) => (sinceMargin ? q.gte("updated_at", sinceMargin) : q);

  const [profiles, exercises, programs, workouts, body, nutrition] = await Promise.all([
    run<Row[]>(sb.from("profiles").select("*").limit(1)),
    run<Row[]>(filtered(sb.from("exercises").select("*").eq("is_custom", true))),
    run<Row[]>(filtered(sb.from("workout_programs").select("*"))),
    run<Row[]>(filtered(sb.from("workouts").select("*, workout_exercises(*, workout_sets(*))"))),
    run<Row[]>(filtered(sb.from("body_measurements").select("*"))),
    run<Row[]>(filtered(sb.from("nutrition_logs").select("*"))),
  ]);

  const s = useGym.getState();
  const patch: Partial<typeof s> = {};

  const p = profiles?.[0];
  if (p && iso(p.updated_at) > s.profile.updatedAt) patch.profile = rowToProfile(p, s.profile);

  if (exercises?.length) patch.customExercises = mergeById(s.customExercises, exercises, rowToExercise);
  if (programs?.length) patch.programs = mergeById(s.programs, programs, rowToProgram);
  if (workouts?.length)
    patch.workouts = mergeById(s.workouts, workouts, rowToWorkout).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (body?.length) patch.body = mergeById(s.body, body, rowToBody).sort((a, b) => a.date.localeCompare(b.date));
  if (nutrition?.length) patch.nutrition = mergeById(s.nutrition, nutrition, rowToNutrition);

  if (Object.keys(patch).length) useGym.setState(patch);
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : "");
const num = (v: unknown) => (v == null ? null : Number(v));

function profileToRow(p: Profile, userId: string) {
  return {
    id: userId,
    display_name: p.name,
    fitness_goal: p.fitnessGoal,
    goal_description: p.goalDescription,
    target_weight: p.targetWeight,
    weekly_goal: p.weeklyGoal,
    units: p.units,
    theme: p.theme,
    nutrition_goals: p.nutritionGoals,
    active_program_id: p.activeProgramId,
    updated_at: p.updatedAt,
  };
}

function rowToProfile(r: Row, cur: Profile): Profile {
  return {
    ...cur,
    name: (r.display_name as string) ?? cur.name,
    fitnessGoal: (r.fitness_goal as Profile["fitnessGoal"]) ?? cur.fitnessGoal,
    goalDescription: (r.goal_description as string) ?? "",
    targetWeight: num(r.target_weight),
    weeklyGoal: Number(r.weekly_goal ?? cur.weeklyGoal),
    units: (r.units as Profile["units"]) ?? cur.units,
    theme: (r.theme as Profile["theme"]) ?? cur.theme,
    nutritionGoals: { ...cur.nutritionGoals, ...((r.nutrition_goals as object) ?? {}) },
    activeProgramId: (r.active_program_id as string) ?? null,
    updatedAt: iso(r.updated_at),
  };
}

function exerciseToRow(e: Exercise, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    name: e.name,
    muscle_group: e.muscleGroup,
    equipment: e.equipment,
    description: e.description,
    instructions: e.instructions,
    recommended_sets: e.recommendedSets,
    recommended_reps: e.recommendedReps,
    is_custom: true,
    deleted: false,
    updated_at: e.updatedAt ?? nowIso(),
  };
}

function rowToExercise(r: Row): Exercise {
  return {
    id: String(r.id),
    name: String(r.name),
    muscleGroup: r.muscle_group as Exercise["muscleGroup"],
    equipment: r.equipment as Exercise["equipment"],
    description: String(r.description ?? ""),
    instructions: (r.instructions as string[]) ?? [],
    recommendedSets: Number(r.recommended_sets ?? 3),
    recommendedReps: String(r.recommended_reps ?? "8-12"),
    isCustom: true,
    updatedAt: iso(r.updated_at),
  };
}

function programToRow(p: WorkoutProgram, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    description: p.description,
    is_preset: p.isPreset,
    days: p.days,
    deleted: false,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function rowToProgram(r: Row): WorkoutProgram {
  return {
    id: String(r.id),
    name: String(r.name),
    description: String(r.description ?? ""),
    isPreset: Boolean(r.is_preset),
    days: (r.days as WorkoutProgram["days"]) ?? [],
    createdAt: String(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function workoutToRow(w: Workout, userId: string) {
  return {
    id: w.id,
    user_id: userId,
    name: w.name,
    program_id: w.programId ?? null,
    program_day_id: w.programDayId ?? null,
    started_at: w.startedAt,
    finished_at: w.finishedAt ?? null,
    duration_seconds: Math.round(workoutDurationSec(w)),
    total_volume: Math.round(workoutVolume(w) * 100) / 100,
    notes: w.notes ?? "",
    deleted: false,
    updated_at: w.updatedAt,
  };
}

function rowToWorkout(r: Row): Workout {
  const wes = ((r.workout_exercises as Row[]) ?? []).sort((a, b) => Number(a.position) - Number(b.position));
  return {
    id: String(r.id),
    name: String(r.name),
    programId: (r.program_id as string) ?? null,
    programDayId: (r.program_day_id as string) ?? null,
    startedAt: new Date(String(r.started_at)).toISOString(),
    finishedAt: r.finished_at ? new Date(String(r.finished_at)).toISOString() : null,
    notes: String(r.notes ?? ""),
    updatedAt: iso(r.updated_at),
    exercises: wes.map((we) => ({
      id: String(we.id),
      exerciseId: String(we.exercise_id),
      restSeconds: Number(we.rest_seconds ?? 90),
      notes: (we.notes as string) ?? undefined,
      sets: ((we.workout_sets as Row[]) ?? [])
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((st) => ({
          id: String(st.id),
          weight: num(st.weight),
          reps: num(st.reps),
          completed: Boolean(st.completed),
          type: (st.set_type as Workout["exercises"][number]["sets"][number]["type"]) ?? "normal",
        })),
    })),
  };
}

function bodyToRow(b: BodyMeasurement, userId: string) {
  return {
    id: b.id,
    user_id: userId,
    measured_at: b.date,
    weight: b.weight ?? null,
    body_fat: b.bodyFat ?? null,
    chest: b.chest ?? null,
    waist: b.waist ?? null,
    arm: b.arm ?? null,
    thigh: b.thigh ?? null,
    notes: b.notes ?? "",
    deleted: false,
    updated_at: b.updatedAt,
  };
}

function rowToBody(r: Row): BodyMeasurement {
  return {
    id: String(r.id),
    date: String(r.measured_at),
    weight: num(r.weight),
    bodyFat: num(r.body_fat),
    chest: num(r.chest),
    waist: num(r.waist),
    arm: num(r.arm),
    thigh: num(r.thigh),
    notes: String(r.notes ?? ""),
    updatedAt: iso(r.updated_at),
  };
}

function nutritionToRow(n: NutritionLog, userId: string) {
  return {
    id: n.id,
    user_id: userId,
    log_date: n.date,
    name: n.name,
    calories: n.calories,
    protein: n.protein,
    carbs: n.carbs,
    fat: n.fat,
    deleted: false,
    updated_at: n.updatedAt,
  };
}

function rowToNutrition(r: Row): NutritionLog {
  return {
    id: String(r.id),
    date: String(r.log_date),
    name: String(r.name),
    calories: Number(r.calories ?? 0),
    protein: Number(r.protein ?? 0),
    carbs: Number(r.carbs ?? 0),
    fat: Number(r.fat ?? 0),
    updatedAt: iso(r.updated_at),
  };
}
