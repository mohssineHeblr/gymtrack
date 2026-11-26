"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  CornerDownRight,
  Layers,
  Link2,
  Repeat,
  Unlink,
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
import { Button, Card, Chip, EmptyState, IconButton, NumberCell, SectionTitle, Sheet, TextArea } from "@/components/ui";
import { useTimerSheet } from "@/components/RestTimer";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { SwapSheet } from "@/components/SwapSheet";
import { SmartWorkoutCard } from "@/components/SmartWorkoutCard";
import { useExerciseMap, useGym } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { workoutVolume } from "@/lib/stats";
import { nextInRotation, scheduleLabel } from "@/lib/program-utils";
import { cn, displayToKg, formatCompact, formatDuration, kgToDisplay, relativeDay } from "@/lib/utils";
import { TECHNIQUES, type SetType, type Workout, type WorkoutExercise, type WorkoutSet } from "@/lib/types";
import { TECHNIQUE_INFO, TEMPO_PRESETS, canMove, groupKind, groupLetters, toBlocks, usesStages } from "@/lib/techniques";

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
  const openTimer = useTimerSheet((s) => s.setOpen);
  const [picker, setPicker] = useState<{ groupId: string | null } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [editName, setEditName] = useState(false);

  const elapsed = (now - new Date(workout.startedAt).getTime()) / 1000;
  const completedSets = workout.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const totalSets = workout.exercises.reduce((a, e) => a + e.sets.length, 0);
  const volume = workoutVolume(workout);
  const blocks = toBlocks(workout.exercises);
  const letters = groupLetters(workout.exercises);

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
          <IconButton label="Rest timer" onClick={() => openTimer(true)}>
            <Timer className="h-5 w-5" />
          </IconButton>
          <Button size="md" onClick={() => setFinishOpen(true)}>
            Finish
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {blocks.map((block) => {
          if (block.length === 1 && !block[0].groupId) {
            const we = block[0];
            return <ExerciseBlock key={we.id} we={we} list={workout.exercises} />;
          }
          const gid = block[0].groupId!;
          const letter = letters.get(gid) ?? "";
          return (
            <section key={gid} className="rounded-[28px] border border-info/40 bg-info/5 p-2" aria-label={`${groupKind(block.length)} ${letter}`}>
              <div className="flex items-center gap-2 px-2 pb-2 pt-1">
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-info px-1.5 text-xs font-extrabold text-black">{letter}</span>
                <span className="text-sm font-bold text-info">
                  {groupKind(block.length)} · {block.length} exercises
                </span>
                <span className="ml-auto text-[11px] text-muted">Rest after each round</span>
              </div>
              <div className="space-y-2">
                {block.map((we, i) => (
                  <ExerciseBlock key={we.id} we={we} list={workout.exercises} groupTag={`${letter}${i + 1}`} />
                ))}
              </div>
              <button
                onClick={() => setPicker({ groupId: gid })}
                className="tap mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-semibold text-info"
              >
                <Plus className="h-4 w-4" /> Add exercise to {groupKind(block.length + 1).toLowerCase()}
              </button>
            </section>
          );
        })}
      </div>

      {!workout.exercises.length && (
        <div className="mt-6">
          <EmptyState icon={<Plus className="h-6 w-6" />} title="Add your first exercise" description="Build your workout as you go." />
        </div>
      )}

      <Button variant="secondary" size="lg" className="mt-4 w-full text-accent" icon={<Plus className="h-5 w-5" />} onClick={() => setPicker({ groupId: null })}>
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

      <ExercisePicker
        open={picker !== null}
        title={picker?.groupId ? "Add to superset" : "Add exercises"}
        onClose={() => setPicker(null)}
        onPick={(ids) => ids.forEach((id) => addExerciseToActive(id, picker?.groupId ?? null))}
      />

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

function scrollToExercise(weId: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(`we-${weId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-info");
    setTimeout(() => el.classList.remove("ring-2", "ring-info"), 1400);
  });
}

function ExerciseBlock({ we, list, groupTag }: { we: WorkoutExercise; list: WorkoutExercise[]; groupTag?: string }) {
  const exMap = useExerciseMap();
  const units = useGym((s) => s.profile.units);
  const autoStart = useGym((s) => s.profile.timer.autoStart);
  const workouts = useGym((s) => s.workouts);
  const addSet = useGym((s) => s.addSet);
  const updateSet = useGym((s) => s.updateSet);
  const deleteSet = useGym((s) => s.deleteSet);
  const addStage = useGym((s) => s.addStage);
  const updateStage = useGym((s) => s.updateStage);
  const deleteStage = useGym((s) => s.deleteStage);
  const toggleSetComplete = useGym((s) => s.toggleSetComplete);
  const startRest = useGym((s) => s.startRest);
  const [swap, setSwap] = useState(false);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [setMenuFor, setSetMenuFor] = useState<string | null>(null);
  const replaceExercise = useGym((s) => s.replaceExerciseInActive);
  const ex = exMap.get(we.exerciseId);
  const technique = we.technique ?? "standard";
  const tInfo = TECHNIQUE_INFO[technique];
  const stageable = usesStages(technique);

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

  const complete = (s: WorkoutSet, prev?: WorkoutSet) => {
    if (!s.completed && (s.reps == null || s.weight == null)) {
      updateSet(we.id, s.id, {
        reps: s.reps ?? prev?.reps ?? null,
        weight: s.weight ?? prev?.weight ?? 0,
      });
    }
    const next = toggleSetComplete(we.id, s.id);
    if (next) scrollToExercise(next);
  };

  const addStageFor = (s: WorkoutSet) => {
    addStage(we.id, s.id);
    if (tInfo.stageRest && autoStart) startRest(tInfo.stageRest, `${tInfo.short} pause`);
  };

  const selectedSet = we.sets.find((x) => x.id === setMenuFor) ?? null;

  return (
    <Card className="p-0 transition-shadow" id={`we-${we.id}`}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        {groupTag && <span className="rounded-lg bg-info/15 px-1.5 py-0.5 text-xs font-extrabold text-info">{groupTag}</span>}
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

      {technique !== "standard" && (
        <button onClick={() => setMenu(true)} className="mx-4 mb-2 flex w-[calc(100%-2rem)] items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-left text-xs">
          <Layers className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
          <span>
            <span className="font-bold text-warn">
              {tInfo.label}
              {technique === "tempo" && we.tempo ? ` ${we.tempo}` : ""}
            </span>
            <span className="text-muted">
              {" "}
              ·{" "}
              {technique === "tempo"
                ? "lower – pause – lift – pause (seconds)"
                : stageable
                  ? `tap “+ ${tInfo.stageLabel}” after a set to log each ${tInfo.stageLabel}`
                  : ""}
            </span>
          </span>
        </button>
      )}

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
          const stages = s.stages ?? [];
          return (
            <div key={s.id} className={cn("rounded-xl transition-colors", s.completed && "bg-accent-soft")}>
              <div className="grid grid-cols-[36px_1fr_1fr_1fr_44px] items-center gap-2 py-1">
                <button
                  onClick={() => setSetMenuFor(s.id)}
                  className={cn(
                    "mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-lg text-sm font-bold leading-none",
                    s.type === "warmup" ? "text-warn" : s.type === "drop" ? "text-info" : s.type === "failure" ? "text-danger" : "text-fg",
                  )}
                  aria-label="Set options"
                >
                  {label}
                  {s.restSeconds != null && <span className="mt-0.5 text-[9px] font-semibold text-subtle">{s.restSeconds ? formatDuration(s.restSeconds) : "0s"}</span>}
                </button>
                <button
                  className="truncate text-center text-xs text-muted"
                  onClick={() => prev && updateSet(we.id, s.id, { weight: prev.weight, reps: prev.reps })}
                  aria-label="Copy previous"
                >
                  {prev && prev.reps ? `${kgToDisplay(prev.weight, units) ?? 0}×${prev.reps}${prev.stages?.length ? ` +${prev.stages.length}` : ""}` : "—"}
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
                    onClick={() => complete(s, prev)}
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

              {/* Drop / mini-set stages, grouped under their set */}
              {stages.length > 0 && (
                <div className="ml-[22px] space-y-1 border-l-2 border-warn/50 pb-1 pl-2" aria-label={`${tInfo.short} stages`}>
                  {stages.map((st, si) => (
                    <div key={st.id} className="grid grid-cols-[50px_1fr_1fr_36px] items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-warn">
                        <CornerDownRight className="h-3 w-3" />
                        {technique === "dropset" || s.type === "drop" ? `D${si + 1}` : `+${si + 1}`}
                      </span>
                      <NumberCell
                        ariaLabel={`Stage ${si + 1} weight`}
                        decimal
                        value={kgToDisplay(st.weight, units)}
                        placeholder="0"
                        onChange={(v) => updateStage(we.id, s.id, st.id, { weight: displayToKg(v, units) })}
                        className="h-9 bg-surface-2/70"
                      />
                      <NumberCell
                        ariaLabel={`Stage ${si + 1} reps`}
                        value={st.reps}
                        placeholder="reps"
                        onChange={(v) => updateStage(we.id, s.id, st.id, { reps: v })}
                        className="h-9 bg-surface-2/70"
                      />
                      <button
                        aria-label={`Remove stage ${si + 1}`}
                        onClick={() => deleteStage(we.id, s.id, st.id)}
                        className="tap mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-subtle"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {(stageable || s.type === "drop") && s.type !== "warmup" && !editing && (
                <button
                  onClick={() => addStageFor(s)}
                  className="tap mb-1 ml-[22px] flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-warn"
                >
                  <Plus className="h-3 w-3" /> {tInfo.stageLabel ?? "drop"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => addSet(we.id)} className="tap flex w-full items-center justify-center gap-1.5 border-t border-line py-3 text-sm font-semibold text-muted">
        <Plus className="h-4 w-4" /> Add set
      </button>

      <ExerciseMenu we={we} list={list} open={menu} onClose={() => setMenu(false)} onSwap={() => setSwap(true)} onInfo={() => setInfo(true)} />

      <SetOptionsSheet
        we={we}
        set={selectedSet}
        onClose={() => setSetMenuFor(null)}
        onAddStage={(s) => {
          addStageFor(s);
          setSetMenuFor(null);
        }}
      />

      <ExerciseDetail exerciseId={info ? we.exerciseId : null} onClose={() => setInfo(false)} />
      <SwapSheet
        exerciseId={swap ? we.exerciseId : null}
        exclude={list.map((e) => e.exerciseId)}
        onClose={() => setSwap(false)}
        onPick={(id) => replaceExercise(we.id, id)}
      />
    </Card>
  );
}

function ExerciseMenu({
  we,
  list,
  open,
  onClose,
  onSwap,
  onInfo,
}: {
  we: WorkoutExercise;
  list: WorkoutExercise[];
  open: boolean;
  onClose: () => void;
  onSwap: () => void;
  onInfo: () => void;
}) {
  const exMap = useExerciseMap();
  const removeExercise = useGym((s) => s.removeExerciseFromActive);
  const moveExercise = useGym((s) => s.moveExerciseInActive);
  const setExerciseRest = useGym((s) => s.setExerciseRest);
  const setTechnique = useGym((s) => s.setExerciseTechnique);
  const groupExercises = useGym((s) => s.groupExercises);
  const ungroupExercise = useGym((s) => s.ungroupExercise);
  const [linking, setLinking] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const ex = exMap.get(we.exerciseId);
  const technique = we.technique ?? "standard";
  const groupSize = we.groupId ? list.filter((e) => e.groupId === we.groupId).length : 0;
  const candidates = list.filter((e) => e.id !== we.id && (!we.groupId || e.groupId !== we.groupId));

  const close = () => {
    setLinking(false);
    setSelected([]);
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={linking ? "Superset with…" : (ex?.name ?? "Exercise")}>
      {linking ? (
        <div>
          <p className="text-sm text-muted">
            Pick the exercises to perform back-to-back with <b className="text-fg">{ex?.name}</b>. 2 exercises make a superset, 3 or more a giant set. Rest starts after the
            whole round.
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line">
            {candidates.map((c, i) => {
              const on = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                  className={cn("tap flex w-full items-center gap-3 px-4 py-3 text-left", i && "border-t border-line")}
                  aria-pressed={on}
                >
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg border", on ? "border-accent bg-accent text-accent-ink" : "border-line")}>
                    {on && <Check className="h-4 w-4" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 font-semibold">{exMap.get(c.exerciseId)?.name ?? c.exerciseId}</span>
                  {c.groupId && <span className="text-xs text-info">in a superset</span>}
                </button>
              );
            })}
            {!candidates.length && <p className="p-4 text-sm text-muted">Add another exercise to the workout first.</p>}
          </div>
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={!selected.length}
            onClick={() => {
              groupExercises([we.id, ...selected]);
              close();
            }}
          >
            {selected.length + 1 + (groupSize > 1 ? groupSize - 1 : 0) >= 3 ? "Create giant set" : "Create superset"}
          </Button>
        </div>
      ) : (
        <>
          <div className="text-[13px] font-medium text-muted">Rest timer after each set</div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {REST_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setExerciseRest(we.id, r)}
                className={cn("tap rounded-xl py-2.5 text-sm font-semibold", we.restSeconds === r ? "bg-accent text-accent-ink" : "bg-surface-2")}
              >
                {r === 0 ? "Off" : formatDuration(r)}
              </button>
            ))}
          </div>

          <div className="mt-5 text-[13px] font-medium text-muted">Training technique</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {TECHNIQUES.map((t) => (
              <Chip key={t} active={technique === t} onClick={() => setTechnique(we.id, t)}>
                {TECHNIQUE_INFO[t].short}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{TECHNIQUE_INFO[technique].description}</p>
          {technique === "tempo" && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-semibold text-muted">Tempo (lower-pause-lift-pause)</div>
              <div className="flex flex-wrap items-center gap-2">
                {TEMPO_PRESETS.map((tp) => (
                  <Chip key={tp} active={we.tempo === tp} onClick={() => setTechnique(we.id, "tempo", tp)} className="tabular-nums">
                    {tp}
                  </Chip>
                ))}
                <input
                  aria-label="Custom tempo"
                  defaultValue={we.tempo && !TEMPO_PRESETS.includes(we.tempo) ? we.tempo : ""}
                  placeholder="custom"
                  onBlur={(e) => /^\d(-\d){3}$/.test(e.target.value.trim()) && setTechnique(we.id, "tempo", e.target.value.trim())}
                  className="h-9 w-24 rounded-full bg-surface-2 px-3 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-2">
            {we.groupId ? (
              <Button variant="secondary" icon={<Unlink className="h-4 w-4" />} onClick={() => { ungroupExercise(we.id); close(); }}>
                Remove from {groupKind(groupSize).toLowerCase()}
              </Button>
            ) : null}
            <Button variant="secondary" icon={<Link2 className="h-4 w-4" />} onClick={() => setLinking(true)} disabled={!candidates.length}>
              {we.groupId ? "Add exercises to this group" : "Superset / giant set with…"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={<ArrowUp className="h-4 w-4" />} disabled={!canMove(list, we.id, -1)} onClick={() => moveExercise(we.id, -1)}>
                Move up
              </Button>
              <Button variant="secondary" icon={<ArrowDown className="h-4 w-4" />} disabled={!canMove(list, we.id, 1)} onClick={() => moveExercise(we.id, 1)}>
                Move down
              </Button>
            </div>
            <Button variant="secondary" icon={<Repeat className="h-4 w-4" />} onClick={() => { close(); onSwap(); }}>
              Replace exercise
            </Button>
            <Button variant="secondary" icon={<Info className="h-4 w-4" />} onClick={() => { close(); onInfo(); }}>
              Exercise instructions
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                close();
                removeExercise(we.id);
              }}
            >
              Remove exercise
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

const SET_TYPE_INFO: Record<SetType, { label: string; hint: string }> = {
  normal: { label: "Working set", hint: "Counts towards volume and PRs" },
  warmup: { label: "Warm-up", hint: "Excluded from volume and PRs" },
  drop: { label: "Drop set", hint: "Log each weight reduction as a stage" },
  failure: { label: "To failure", hint: "Taken to muscular failure" },
};

function SetOptionsSheet({ we, set: s, onClose, onAddStage }: { we: WorkoutExercise; set: WorkoutSet | null; onClose: () => void; onAddStage: (s: WorkoutSet) => void }) {
  const updateSet = useGym((st) => st.updateSet);
  const deleteSet = useGym((st) => st.deleteSet);
  const technique = we.technique ?? "standard";
  return (
    <Sheet open={!!s} onClose={onClose} title="Set options">
      {s && (
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-[13px] font-medium text-muted">Set type</div>
            <div className="grid grid-cols-2 gap-2">
              {SET_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => updateSet(we.id, s.id, { type: t })}
                  className={cn("tap rounded-2xl px-3 py-2.5 text-left", s.type === t ? "bg-accent text-accent-ink" : "bg-surface-2")}
                  aria-pressed={s.type === t}
                >
                  <div className="text-sm font-bold">{SET_TYPE_INFO[t].label}</div>
                  <div className={cn("text-[11px]", s.type === t ? "text-accent-ink/70" : "text-muted")}>{SET_TYPE_INFO[t].hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-muted">Rest after this set</div>
            <div className="grid grid-cols-5 gap-2">
              <button
                onClick={() => updateSet(we.id, s.id, { restSeconds: null })}
                className={cn("tap col-span-2 rounded-xl py-2.5 text-sm font-semibold", s.restSeconds == null ? "bg-accent text-accent-ink" : "bg-surface-2")}
              >
                Default ({we.restSeconds ? formatDuration(we.restSeconds) : "off"})
              </button>
              {REST_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => updateSet(we.id, s.id, { restSeconds: r })}
                  className={cn("tap rounded-xl py-2.5 text-sm font-semibold", s.restSeconds === r ? "bg-accent text-accent-ink" : "bg-surface-2")}
                >
                  {r === 0 ? "Off" : formatDuration(r)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            {s.type !== "warmup" && (
              <Button variant="secondary" icon={<Layers className="h-4 w-4" />} onClick={() => onAddStage(s)}>
                Add {TECHNIQUE_INFO[technique].stageLabel ?? "drop"} to this set
              </Button>
            )}
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                deleteSet(we.id, s.id);
                onClose();
              }}
            >
              Delete set
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
