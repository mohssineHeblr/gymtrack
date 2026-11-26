"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Clock, Dumbbell, Info, Minus, Play, RefreshCw, Repeat, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { BodyMap } from "@/components/BodyMap";
import { SwapSheet } from "@/components/SwapSheet";
import { TrainingSettings } from "@/components/TrainingSettings";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { Button, Card, EmptyState, IconButton, PageHeader, Sheet, Skeleton } from "@/components/ui";
import { useExerciseMap, useGym } from "@/lib/store";
import { useSmartPlan } from "@/lib/use-recovery";
import { SPLIT_LABEL } from "@/lib/generator";
import { formatDuration, formatWeight } from "@/lib/utils";
import { MUSCLE_INFO } from "@/data/muscles";
import type { WorkoutExercise } from "@/lib/types";

export default function SmartWorkoutPage() {
  const router = useRouter();
  const plan = useSmartPlan();
  const active = useGym((s) => s.activeWorkout);
  const profile = useGym((s) => s.profile);
  const regenerate = useGym((s) => s.regenerateSmartPlan);
  const swap = useGym((s) => s.swapPlanExercise);
  const remove = useGym((s) => s.removePlanExercise);
  const startSmartPlan = useGym((s) => s.startSmartPlan);
  const [settings, setSettings] = useState(false);
  const [swapping, setSwapping] = useState<WorkoutExercise | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const start = () => {
    if (active && !confirm("You already have a workout in progress. Replace it with this smart workout?")) return;
    startSmartPlan();
    router.push("/workout");
  };

  const closeSettings = () => {
    setSettings(false);
    regenerate();
  };

  const colors = plan ? Object.fromEntries(plan.muscles.map((m) => [m, "var(--accent)"])) : {};

  return (
    <div>
      <PageHeader
        title="Smart Workout"
        back
        action={
          <IconButton label="Workout settings" onClick={() => setSettings(true)}>
            <SlidersHorizontal className="h-5 w-5" />
          </IconButton>
        }
      />

      {!plan ? (
        <div className="space-y-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <>
          <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-surface to-surface-2">
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                  <Sparkles className="h-3.5 w-3.5" /> Built for you today
                </div>
                <h2 className="mt-1.5 text-2xl font-bold leading-tight">{plan.name}</h2>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> ~{plan.estMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Dumbbell className="h-3.5 w-3.5" /> {plan.exercises.length} exercises
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{plan.reason}</p>
              </div>
              <div className="w-24 shrink-0">
                <BodyMap colors={colors} size="sm" className="h-36" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {plan.muscles.map((m) => (
                <span key={m} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  {MUSCLE_INFO[m].label}
                </span>
              ))}
            </div>
          </Card>

          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setSettings(true)} className="tap flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5 text-muted" /> {profile.smart.duration} min
            </button>
            <button onClick={() => setSettings(true)} className="tap flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">
              Focus: {SPLIT_LABEL[profile.smart.split]}
            </button>
            <button onClick={() => setSettings(true)} className="tap flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">
              {profile.equipment.length === 8 ? "Full gym" : `${profile.equipment.length} equipment types`}
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {plan.exercises.map((we, i) => (
              <PlanRow
                key={we.id}
                we={we}
                index={i}
                onSwap={() => setSwapping(we)}
                onRemove={() => remove(we.id)}
                onInfo={() => setInfo(we.exerciseId)}
              />
            ))}
          </div>

          {!plan.exercises.length && (
            <EmptyState
              icon={<Dumbbell className="h-6 w-6" />}
              title="No exercises"
              description="Shuffle to build a new workout, or adjust your equipment and focus."
            />
          )}

          <div className="sticky bottom-nav-offset z-20 mt-4 grid grid-cols-[auto_1fr] gap-2 pb-2">
            <Button size="lg" variant="secondary" icon={<RefreshCw className="h-5 w-5" />} onClick={() => regenerate()} aria-label="Shuffle workout">
              Shuffle
            </Button>
            <Button size="lg" icon={<Play className="h-5 w-5" fill="currentColor" />} onClick={start} disabled={!plan.exercises.length}>
              Start workout
            </Button>
          </div>
        </>
      )}

      <Sheet
        open={settings}
        onClose={closeSettings}
        title="Workout settings"
        footer={
          <Button size="lg" className="w-full" onClick={closeSettings}>
            Apply & rebuild
          </Button>
        }
      >
        <TrainingSettings />
      </Sheet>

      <SwapSheet
        exerciseId={swapping?.exerciseId ?? null}
        exclude={plan?.exercises.map((e) => e.exerciseId) ?? []}
        onClose={() => setSwapping(null)}
        onPick={(id) => swapping && swap(swapping.id, id)}
      />
      <ExerciseDetail exerciseId={info} onClose={() => setInfo(null)} />
    </div>
  );
}

function PlanRow({ we, index, onSwap, onRemove, onInfo }: { we: WorkoutExercise; index: number; onSwap: () => void; onRemove: () => void; onInfo: () => void }) {
  const exMap = useExerciseMap();
  const units = useGym((s) => s.profile.units);
  const ex = exMap.get(we.exerciseId);
  const work = we.sets.filter((s) => s.type !== "warmup");
  const warm = we.sets.length - work.length;
  const top = work[0];
  const TrendIcon = we.trend === "up" ? ArrowUpRight : we.trend === "down" ? ArrowDownRight : Minus;

  return (
    <Card className="animate-fade-up p-0" >
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-bold text-muted">{index + 1}</div>
        <button onClick={onInfo} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold">{ex?.name ?? we.exerciseId}</span>
            <Info className="h-3.5 w-3.5 shrink-0 text-subtle" />
          </div>
          <div className="mt-0.5 text-sm">
            <span className="font-semibold text-accent">
              {work.length} × {top?.reps ?? we.targetReps}
            </span>
            {top?.weight ? <span className="text-fg/90"> @ {formatWeight(top.weight, units)}</span> : top?.weight === 0 ? <span className="text-muted"> · bodyweight</span> : null}
            <span className="text-muted">
              {" "}
              · {formatDuration(we.restSeconds)} rest{warm ? ` · ${warm} warm-up` : ""}
            </span>
          </div>
        </button>
      </div>
      {we.tip && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          <TrendIcon className={`mt-px h-3.5 w-3.5 shrink-0 ${we.trend === "up" ? "text-accent" : we.trend === "down" ? "text-warn" : "text-muted"}`} />
          <span>{we.tip}</span>
        </div>
      )}
      <div className="grid grid-cols-2 border-t border-line">
        <button onClick={onSwap} className="tap flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-fg/90">
          <Repeat className="h-4 w-4" /> Swap
        </button>
        <button onClick={onRemove} className="tap flex items-center justify-center gap-1.5 border-l border-line py-2.5 text-sm font-semibold text-muted" aria-label={`Remove ${ex?.name ?? "exercise"}`}>
          <Trash2 className="h-4 w-4" /> Remove
        </button>
      </div>
    </Card>
  );
}
