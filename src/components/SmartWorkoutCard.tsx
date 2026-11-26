"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { BodyMap } from "./BodyMap";
import { useExerciseMap } from "@/lib/store";
import { useSmartPlan } from "@/lib/use-recovery";
import { MUSCLE_INFO } from "@/data/muscles";
import { cn } from "@/lib/utils";

/** Today's generated workout — links to the /smart preview. */
export function SmartWorkoutCard({ className }: { className?: string }) {
  const plan = useSmartPlan();
  const exMap = useExerciseMap();
  if (!plan) return <div className={cn("h-[184px] animate-pulse rounded-3xl bg-surface", className)} />;
  const colors = Object.fromEntries(plan.muscles.map((m) => [m, "var(--accent)"]));
  return (
    <Link href="/smart" className={cn("tap block rounded-3xl border border-accent/25 bg-gradient-to-br from-surface to-surface-2 p-4", className)}>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Smart workout
          </div>
          <div className="mt-1 text-xl font-bold leading-tight">{plan.name}</div>
          <div className="mt-1 text-sm text-muted">
            ~{plan.estMinutes} min · {plan.exercises.length} exercises
          </div>
          <div className="mt-2 line-clamp-2 text-xs text-muted">
            {plan.exercises
              .map((e) => exMap.get(e.exerciseId)?.name)
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="w-20 shrink-0">
          <BodyMap colors={colors} size="sm" className="h-28" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink">
        <span className="truncate">
          {plan.muscles
            .slice(0, 3)
            .map((m) => MUSCLE_INFO[m].label)
            .join(", ")}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          Preview <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
