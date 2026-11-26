"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PartyPopper, RotateCcw, Trash2, Trophy, X } from "lucide-react";
import { Button, Card, EmptyState, Input, PageHeader, Spinner, TextArea } from "@/components/ui";
import { useExerciseMap, useGym } from "@/lib/store";
import { computePRs, e1rm, workoutDurationSec, workoutSetCount, workoutVolume } from "@/lib/stats";
import { formatCompact, formatDate, formatDuration, formatTime, kgToDisplay } from "@/lib/utils";

export default function WorkoutViewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <WorkoutView />
    </Suspense>
  );
}

function WorkoutView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const isNew = params.get("new") === "1";
  const workouts = useGym((s) => s.workouts);
  const units = useGym((s) => s.profile.units);
  const deleteWorkout = useGym((s) => s.deleteWorkout);
  const updateWorkout = useGym((s) => s.updateWorkout);
  const repeatWorkout = useGym((s) => s.repeatWorkout);
  const hasActive = useGym((s) => s.activeWorkout !== null);
  const exMap = useExerciseMap();
  const [editing, setEditing] = useState(false);

  const w = workouts.find((x) => x.id === id);
  const priorPRs = useMemo(() => (w ? computePRs(workouts.filter((x) => x.startedAt < w.startedAt)) : new Map()), [workouts, w]);

  if (!w) {
    return (
      <div>
        <PageHeader title="Workout" back="/history" large={false} />
        <EmptyState icon={<X className="h-6 w-6" />} title="Workout not found" />
      </div>
    );
  }

  const volume = workoutVolume(w);
  let prCount = 0;
  const exerciseRows = w.exercises.map((we) => {
    const prior = priorPRs.get(we.exerciseId);
    const sets = we.sets.map((s) => {
      const isPR =
        s.type !== "warmup" &&
        (s.weight ?? 0) > 0 &&
        (!prior || (s.weight ?? 0) > prior.bestWeight || e1rm(s.weight ?? 0, s.reps ?? 0) > prior.bestE1rm);
      return { ...s, isPR };
    });
    if (sets.some((s) => s.isPR)) prCount++;
    return { we, sets };
  });

  return (
    <div>
      <PageHeader
        title={w.name}
        back="/history"
        large={false}
        action={
          <Button size="sm" variant="secondary" onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Edit"}
          </Button>
        }
      />

      {isNew && (
        <Card className="mb-4 animate-pop border-accent/40 bg-accent-soft text-center">
          <PartyPopper className="mx-auto h-8 w-8 text-accent" />
          <div className="mt-2 text-lg font-bold">Workout complete!</div>
          <div className="text-sm text-muted">
            {prCount > 0 ? `You set ${prCount} new personal record${prCount > 1 ? "s" : ""} 🏆` : "Consistency is everything. Nice work."}
          </div>
        </Card>
      )}

      {editing ? (
        <div className="mb-4 space-y-2">
          <Input value={w.name} onChange={(e) => updateWorkout(w.id, { name: e.target.value })} aria-label="Workout name" />
          <TextArea value={w.notes ?? ""} onChange={(e) => updateWorkout(w.id, { notes: e.target.value })} placeholder="Notes" />
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted">
          {formatDate(w.startedAt, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {formatTime(w.startedAt)}
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          ["Time", formatDuration(workoutDurationSec(w), true)],
          ["Volume", `${formatCompact(kgToDisplay(volume, units) ?? 0)}`],
          ["Sets", String(workoutSetCount(w))],
          ["PRs", String(prCount)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-surface p-3 text-center">
            <div className="text-base font-bold">{v}</div>
            <div className="text-[11px] text-muted">{l === "Volume" ? `Vol (${units})` : l}</div>
          </div>
        ))}
      </div>

      {w.notes && !editing && <Card className="mt-3 text-sm text-fg/90">{w.notes}</Card>}

      <div className="mt-4 space-y-3">
        {exerciseRows.map(({ we, sets }) => {
          let n = 0;
          return (
            <Card key={we.id}>
              <div className="font-bold text-accent">{exMap.get(we.exerciseId)?.name ?? we.exerciseId}</div>
              <div className="mt-2 space-y-1">
                {sets.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span className="w-8 font-bold text-muted">{s.type === "normal" ? ++n : s.type[0].toUpperCase()}</span>
                    <span className="flex-1 font-semibold tabular-nums">
                      {s.weight ? `${kgToDisplay(s.weight, units)} ${units}` : "BW"} × {s.reps ?? 0}
                    </span>
                    {s.isPR && (
                      <span className="flex items-center gap-1 text-xs font-bold text-warn">
                        <Trophy className="h-3.5 w-3.5" /> PR
                      </span>
                    )}
                    <span className="ml-3 text-xs text-muted">
                      1RM {formatCompact(kgToDisplay(e1rm(s.weight ?? 0, s.reps ?? 0), units) ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid gap-2">
        <Button
          size="lg"
          icon={<RotateCcw className="h-4 w-4" />}
          onClick={() => {
            if (hasActive && !confirm("Replace the workout currently in progress?")) return;
            repeatWorkout(w.id);
            router.push("/workout");
          }}
        >
          Repeat this workout
        </Button>
        <Button
          variant="danger"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={() => {
            if (confirm("Delete this workout permanently?")) {
              deleteWorkout(w.id);
              router.replace("/history");
            }
          }}
        >
          Delete workout
        </Button>
      </div>
    </div>
  );
}
