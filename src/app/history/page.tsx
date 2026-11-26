"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Clock, Dumbbell, History, Search, Trophy } from "lucide-react";
import { EmptyState, Input, PageHeader, Button } from "@/components/ui";
import { useExerciseMap, useGym } from "@/lib/store";
import { prsInWorkout, workoutDurationSec, workoutSetCount, workoutVolume } from "@/lib/stats";
import { formatCompact, formatDuration, kgToDisplay, formatDate, formatTime } from "@/lib/utils";

export default function HistoryPage() {
  const workouts = useGym((s) => s.workouts);
  const units = useGym((s) => s.profile.units);
  const exMap = useExerciseMap();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workouts;
    return workouts.filter(
      (w) => w.name.toLowerCase().includes(q) || w.exercises.some((e) => exMap.get(e.exerciseId)?.name.toLowerCase().includes(q)),
    );
  }, [workouts, query, exMap]);

  const months = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const w of filtered) {
      const key = new Date(w.startedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      m.set(key, [...(m.get(key) ?? []), w]);
    }
    return [...m.entries()];
  }, [filtered]);

  return (
    <div>
      <PageHeader title="History" subtitle={`${workouts.length} workouts logged`} back />
      {workouts.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search workouts or exercises" className="pl-10" />
        </div>
      )}

      {!workouts.length && (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="No workouts yet"
          description="Finished workouts will appear here."
          action={<Link href="/workout"><Button>Start a workout</Button></Link>}
        />
      )}

      <div className="space-y-6">
        {months.map(([month, ws]) => (
          <section key={month}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-muted">
              {month} <span className="text-subtle">· {ws.length}</span>
            </h2>
            <div className="space-y-2.5">
              {ws.map((w) => {
                const prs = prsInWorkout(w, workouts);
                return (
                  <Link key={w.id} href={`/history/view?id=${w.id}`} className="tap block rounded-3xl border border-line bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[17px] font-bold">{w.name}</div>
                        <div className="text-xs text-muted">
                          {formatDate(w.startedAt, { weekday: "long", month: "short", day: "numeric" })} · {formatTime(w.startedAt)}
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-subtle" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1 text-muted">
                        <Clock className="h-3.5 w-3.5" /> {formatDuration(workoutDurationSec(w), true)}
                      </span>
                      <span className="flex items-center gap-1 text-muted">
                        <Dumbbell className="h-3.5 w-3.5" /> {formatCompact(kgToDisplay(workoutVolume(w), units) ?? 0)} {units}
                      </span>
                      <span className="text-muted">{workoutSetCount(w)} sets</span>
                      {prs > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-warn">
                          <Trophy className="h-3.5 w-3.5" /> {prs} PR{prs > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-1 border-t border-line pt-3">
                      {w.exercises.slice(0, 4).map((we) => {
                        const best = we.sets.reduce((b, s) => ((s.weight ?? 0) > (b?.weight ?? -1) ? s : b), we.sets[0]);
                        return (
                          <div key={we.id} className="flex justify-between text-sm">
                            <span className="truncate text-fg/90">
                              {we.sets.length} × {exMap.get(we.exerciseId)?.name ?? we.exerciseId}
                            </span>
                            <span className="shrink-0 pl-2 text-muted">
                              {best?.weight ? `${kgToDisplay(best.weight, units)} ${units} × ${best.reps}` : best?.reps ? `${best.reps} reps` : ""}
                            </span>
                          </div>
                        );
                      })}
                      {w.exercises.length > 4 && <div className="text-xs text-muted">+{w.exercises.length - 4} more</div>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
