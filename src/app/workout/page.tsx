"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  Repeat,
  Sparkles,
  Check,
  ChevronRight,
  Info,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { Button, Card, EmptyState, IconButton, NumberCell, SectionTitle, Sheet, TextArea } from "@/components/ui";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { SwapSheet } from "@/components/SwapSheet";
import { SmartWorkoutCard } from "@/components/SmartWorkoutCard";
import { useExerciseMap, useGym } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { workoutVolume } from "@/lib/stats";
import { nextInRotation, scheduleLabel } from "@/lib/program-utils";
import { cn, displayToKg, formatCompact, formatDuration, kgToDisplay, relativeDay } from "@/lib/utils";
import type { SetType, Workout, WorkoutExercise } from "@/lib/types";

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
const SET_TYPES: SetType[] = ["normal", "warmup", "drop", "failure"];
const SET_LABEL: Record<SetType, string> = { normal: "", warmup: "W", drop: "D", failure: "F" };

export default function WorkoutPage() {
  const active = useGym((s) => s.activeWorkout);
  return active ? <ActiveWorkout workout={active} /> : <StartWorkout />;
}

// ---------------------------------------------------------------------------
// Start screen
// ---------------------------------------------------------------------------
function StartWorkout() {
  const programs = useGym((s) => s.programs);
  const workouts = useGym((s) => s.workouts);
  const activeProgramId = useGym((s) => s.profile.activeProgramId);
  const startWorkout = useGym((s) => s.startWorkout);
  const startFromProgramDay = useGym((s) => s.startFromProgramDay);
  const repeatWorkout = useGym((s) => s.repeatWorkout);
  const program = programs.find((p) => p.id === activeProgramId);
  const suggested = program ? nextInRotation(program, workouts) : null;
  const todayWd = new Date().getDay();

  return (
    <div className="pt-safe">
      <div className="pb-2 pt-2">
        <h1 className="text-[32px] font-extrabold tracking-tight">Workout</h1>
        <p className="text-sm text-muted">Pick a routine or start from scratch.</p>
      </div>

      <SmartWorkoutCard className="mt-3" />

      <Button size="lg" variant="secondary" className="mt-3 w-full" icon={<Plus className="h-5 w-5" />} onClick={() => startWorkout({ name: "Quick Workout" })}>
        Start empty workout
      </Button>

      {program ? (
        <>
          <SectionTitle action={<Link href="/programs" className="text-sm font-semibold text-accent">Change</Link>}>
            {program.name}
          </SectionTitle>
          <div className="space-y-2.5">
            {program.days.map((d) => {
              const isToday = d.weekdays.includes(todayWd);
              const isNext = suggested?.id === d.id;
              return (
                <Card key={d.id} onClick={() => startFromProgramDay(program.id, d.id)} className={cn(isToday && "border-accent/40")}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{d.name}</span>
                        {isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">TODAY</span>}
                        {!isToday && isNext && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-muted">UP NEXT</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {d.exercises.length} exercises · {scheduleLabel(d.weekdays)}
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Play className="h-4 w-4" fill="currentColor" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<Play className="h-6 w-6" />}
            title="No active program"
            description="Choose a program to get a guided workout every day."
            action={<Link href="/programs"><Button variant="secondary">Browse programs</Button></Link>}
          />
        </div>
      )}

      {workouts.length > 0 && (
        <>
          <SectionTitle>Repeat a recent workout</SectionTitle>
          <div className="space-y-2.5">
            {workouts.slice(0, 3).map((w) => (
              <Card key={w.id} onClick={() => repeatWorkout(w.id)}>
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{w.name}</div>
                    <div className="text-xs text-muted">
                      {relativeDay(w.startedAt)} · {w.exercises.length} exercises
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-subtle" />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active workout
// ---------------------------------------------------------------------------
function ActiveWorkout({ workout }: { workout: Workout }) {
  const router = useRouter();
  const now = useNow(1000);
  const units = useGym((s) => s.profile.units);
  const updateActive = useGym((s) => s.updateActive);
  const addExerciseToActive = useGym((s) => s.addExerciseToActive);
  const finishWorkout = useGym((s) => s.finishWorkout);
  const discardWorkout = useGym((s) => s.discardWorkout);
  const startRest = useGym((s) => s.startRest);
  const [picker, setPicker] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [editName, setEditName] = useState(false);

  const elapsed = (now - new Date(workout.startedAt).getTime()) / 1000;
  const completedSets = workout.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const totalSets = workout.exercises.reduce((a, e) => a + e.sets.length, 0);
  const volume = workoutVolume(workout);

  const finish = () => {
    const id = finishWorkout();
    setFinishOpen(false);
    if (id) router.push(`/history/view?id=${id}&new=1`);
  };

  const discard = () => {
    if (confirm("Discard this workout? All logged sets will be lost.")) {
      discardWorkout();
    }
  };

  return (
    <div className="pt-safe">
      {/* Sticky header */}
      <div className="glass sticky top-0 z-30 -mx-4 px-4 pb-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {editName ? (
              <input
                autoFocus
                value={workout.name}
                onChange={(e) => updateActive({ name: e.target.value })}
                onBlur={() => setEditName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditName(false)}
                className="w-full bg-transparent text-2xl font-bold outline-none"
              />
            ) : (
              <button onClick={() => setEditName(true)} className="truncate text-left text-2xl font-bold">
                {workout.name}
              </button>
            )}
            <div className="mt-0.5 flex items-center gap-3 text-sm text-muted">
              <span className="font-semibold tabular-nums text-accent">{formatDuration(elapsed)}</span>
              <span>
                {completedSets}/{totalSets} sets
              </span>
              <span>
                {formatCompact(kgToDisplay(volume, units) ?? 0)} {units}
              </span>
            </div>
          </div>
          <IconButton label="Start rest timer" onClick={() => startRest(90)}>
            <Timer className="h-5 w-5" />
          </IconButton>
          <Button size="md" onClick={() => setFinishOpen(true)}>
            Finish
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {workout.exercises.map((we, i) => (
          <ExerciseBlock key={we.id} we={we} index={i} count={workout.exercises.length} />
        ))}
      </div>

      {!workout.exercises.length && (
        <div className="mt-6">
          <EmptyState icon={<Plus className="h-6 w-6" />} title="Add your first exercise" description="Build your workout as you go." />
        </div>
      )}

      <Button variant="secondary" size="lg" className="mt-4 w-full text-accent" icon={<Plus className="h-5 w-5" />} onClick={() => setPicker(true)}>
        Add exercise
      </Button>

      <TextArea
        className="mt-4"
        placeholder="Workout notes (how did it feel?)"
        value={workout.notes ?? ""}
        onChange={(e) => updateActive({ notes: e.target.value })}
      />

      <Button variant="danger" className="mt-4 w-full" icon={<Trash2 className="h-4 w-4" />} onClick={discard}>
        Discard workout
      </Button>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(ids) => ids.forEach(addExerciseToActive)} />

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish workout?"
        footer={
          <div className="grid gap-2">
            <Button size="lg" onClick={finish} disabled={completedSets === 0}>
              Save workout
            </Button>
            <Button variant="ghost" onClick={() => setFinishOpen(false)}>
              Keep training
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Duration", formatDuration(elapsed, true)],
            ["Sets", `${completedSets}`],
            ["Volume", `${formatCompact(kgToDisplay(volume, units) ?? 0)} ${units}`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-surface-2 p-3">
              <div className="text-lg font-bold">{v}</div>
              <div className="text-xs text-muted">{l}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          {completedSets === 0
            ? "Tick off at least one set (✓) before saving."
            : totalSets > completedSets
              ? `${totalSets - completedSets} unchecked set(s) will be discarded.`
              : "Great work — every set completed!"}
        </p>
      </Sheet>
    </div>
  );
}

function ExerciseBlock({ we, index, count }: { we: WorkoutExercise; index: number; count: number }) {
  const exMap = useExerciseMap();
  const units = useGym((s) => s.profile.units);
  const workouts = useGym((s) => s.workouts);
  const addSet = useGym((s) => s.addSet);
  const updateSet = useGym((s) => s.updateSet);
  const deleteSet = useGym((s) => s.deleteSet);
  const toggleSetComplete = useGym((s) => s.toggleSetComplete);
  const removeExercise = useGym((s) => s.removeExerciseFromActive);
  const moveExercise = useGym((s) => s.moveExerciseInActive);
  const setExerciseRest = useGym((s) => s.setExerciseRest);
  const replaceExercise = useGym((s) => s.replaceExerciseInActive);
  const activeIds = useGym((s) => s.activeWorkout?.exercises.map((e) => e.exerciseId).join(",") ?? "");
  const [swap, setSwap] = useState(false);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const ex = exMap.get(we.exerciseId);

  const previous = useMemo(() => {
    for (const w of workouts) {
      const p = w.exercises.find((e) => e.exerciseId === we.exerciseId);
      if (p) return p.sets;
    }
    return null;
  }, [workouts, we.exerciseId]);

  let workingIndex = 0;
  let warmIndex = 0;
  let setNumber = 0;
  const prevWork = previous?.filter((x) => x.type !== "warmup") ?? [];
  const prevWarm = previous?.filter((x) => x.type === "warmup") ?? [];

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <button onClick={() => setInfo(true)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[17px] font-bold text-accent">{ex?.name ?? "Unknown exercise"}</span>
            <Info className="h-3.5 w-3.5 shrink-0 text-subtle" />
          </div>
          <div className="text-xs text-muted">
            {ex?.muscleGroup} · {ex?.equipment}
            {we.targetReps ? ` · target ${we.targetReps} reps` : ex ? ` · target ${ex.recommendedSets}×${ex.recommendedReps}` : ""}
          </div>
        </button>
        <button
          onClick={() => setMenu(true)}
          className="tap flex h-8 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-xs font-semibold text-muted"
          aria-label="Rest time"
        >
          <Timer className="h-3.5 w-3.5" /> {we.restSeconds ? formatDuration(we.restSeconds) : "Off"}
        </button>
        <IconButton label="Exercise options" className="h-8 w-8" onClick={() => setMenu(true)}>
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
      </div>

      {we.tip && !we.sets.some((x) => x.completed) && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          {we.trend === "up" ? (
            <ArrowUpRight className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />
          ) : we.trend === "down" ? (
            <ArrowDownRight className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
          ) : (
            <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />
          )}
          <span>{we.tip}</span>
        </div>
      )}

      <div className="grid grid-cols-[36px_1fr_1fr_1fr_44px] items-center gap-2 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
        <span className="text-center">Set</span>
        <span className="text-center">Previous</span>
        <span className="text-center">{units}</span>
        <span className="text-center">Reps</span>
        <span className="text-center">
          {editing ? (
            <button onClick={() => setEditing(false)} className="text-accent">Done</button>
          ) : (
            <button onClick={() => setEditing(true)} className="text-muted">Edit</button>
          )}
        </span>
      </div>

      <div className="space-y-1 px-3 pb-2">
        {we.sets.map((s) => {
          const label = s.type === "normal" ? String(++setNumber) : SET_LABEL[s.type];
          const prev = s.type === "warmup" ? prevWarm[warmIndex++] : prevWork[workingIndex++];
          return (
            <div
              key={s.id}
              className={cn(
                "grid grid-cols-[36px_1fr_1fr_1fr_44px] items-center gap-2 rounded-xl py-1 transition-colors",
                s.completed && "bg-accent-soft",
              )}
            >
              <button
                onClick={() => updateSet(we.id, s.id, { type: SET_TYPES[(SET_TYPES.indexOf(s.type) + 1) % SET_TYPES.length] })}
                className={cn(
                  "mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
                  s.type === "warmup" ? "text-warn" : s.type === "drop" ? "text-info" : s.type === "failure" ? "text-danger" : "text-fg",
                )}
                aria-label="Change set type"
              >
                {label}
              </button>
              <button
                className="truncate text-center text-xs text-muted"
                onClick={() => prev && updateSet(we.id, s.id, { weight: prev.weight, reps: prev.reps })}
                aria-label="Copy previous"
              >
                {prev && prev.reps ? `${kgToDisplay(prev.weight, units) ?? 0}×${prev.reps}` : "—"}
              </button>
              <NumberCell
                ariaLabel="Weight"
                decimal
                value={kgToDisplay(s.weight, units)}
                placeholder={prev ? String(kgToDisplay(prev.weight, units) ?? "") : "0"}
                onChange={(v) => updateSet(we.id, s.id, { weight: displayToKg(v, units) })}
                className={s.completed ? "bg-transparent" : ""}
              />
              <NumberCell
                ariaLabel="Reps"
                value={s.reps}
                placeholder={prev?.reps ? String(prev.reps) : "0"}
                onChange={(v) => updateSet(we.id, s.id, { reps: v })}
                className={s.completed ? "bg-transparent" : ""}
              />
              {editing ? (
                <button
                  onClick={() => deleteSet(we.id, s.id)}
                  className="tap mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-danger/15 text-danger"
                  aria-label="Delete set"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!s.completed && (s.reps == null || s.weight == null)) {
                      updateSet(we.id, s.id, {
                        reps: s.reps ?? prev?.reps ?? null,
                        weight: s.weight ?? prev?.weight ?? 0,
                      });
                    }
                    toggleSetComplete(we.id, s.id);
                  }}
                  className={cn(
                    "tap mx-auto flex h-9 w-9 items-center justify-center rounded-xl",
                    s.completed ? "animate-pop bg-accent text-accent-ink" : "bg-surface-3 text-muted",
                  )}
                  aria-label={s.completed ? "Mark set incomplete" : "Complete set"}
                >
                  <Check className="h-5 w-5" strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => addSet(we.id)} className="tap flex w-full items-center justify-center gap-1.5 border-t border-line py-3 text-sm font-semibold text-muted">
        <Plus className="h-4 w-4" /> Add set
      </button>

      <Sheet open={menu} onClose={() => setMenu(false)} title={ex?.name ?? "Exercise"}>
        <div className="text-[13px] font-medium text-muted">Rest timer after each set</div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {REST_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setExerciseRest(we.id, r)}
              className={cn(
                "tap rounded-xl py-2.5 text-sm font-semibold",
                we.restSeconds === r ? "bg-accent text-accent-ink" : "bg-surface-2",
              )}
            >
              {r === 0 ? "Off" : formatDuration(r)}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-2">
          <Button variant="secondary" icon={<ArrowUp className="h-4 w-4" />} disabled={index === 0} onClick={() => moveExercise(we.id, -1)}>
            Move up
          </Button>
          <Button variant="secondary" icon={<ArrowDown className="h-4 w-4" />} disabled={index === count - 1} onClick={() => moveExercise(we.id, 1)}>
            Move down
          </Button>
          <Button variant="secondary" icon={<Repeat className="h-4 w-4" />} onClick={() => { setMenu(false); setSwap(true); }}>
            Replace exercise
          </Button>
          <Button variant="secondary" icon={<Info className="h-4 w-4" />} onClick={() => { setMenu(false); setInfo(true); }}>
            Exercise instructions
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              setMenu(false);
              removeExercise(we.id);
            }}
          >
            Remove exercise
          </Button>
        </div>
      </Sheet>

      <ExerciseDetail exerciseId={info ? we.exerciseId : null} onClose={() => setInfo(false)} />
      <SwapSheet
        exerciseId={swap ? we.exerciseId : null}
        exclude={activeIds.split(",")}
        onClose={() => setSwap(false)}
        onPick={(id) => replaceExercise(we.id, id)}
      />
    </Card>
  );
}
