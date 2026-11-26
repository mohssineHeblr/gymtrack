"use client";

import { useEffect, useMemo } from "react";
import { computeRecovery, recoveryColor, type RecoveryMap } from "./recovery";
import { useExerciseMap, useGym } from "./store";
import { useNow } from "./hooks";
import { MUSCLES, type Muscle } from "@/data/muscles";

export function useRecovery(): RecoveryMap {
  const workouts = useGym((s) => s.workouts);
  const exMap = useExerciseMap();
  const now = useNow(60_000);
  // Recompute per minute bucket so the map drifts toward "fresh" over time.
  const bucket = Math.floor(now / 60_000);
  return useMemo(() => computeRecovery(workouts, (id) => exMap.get(id), bucket * 60_000), [workouts, exMap, bucket]);
}

export function recoveryColors(rec: RecoveryMap): Record<Muscle, string> {
  return Object.fromEntries(MUSCLES.map((m) => [m, recoveryColor(rec[m].recovery)])) as Record<Muscle, string>;
}

/**
 * Returns the current smart plan, generating one when missing or stale
 * (older than 6 hours, or created before the latest finished workout).
 */
export function useSmartPlan() {
  const plan = useGym((s) => s.smartPlan);
  const hydrated = useGym((s) => s.hydrated);
  const lastWorkout = useGym((s) => s.workouts[0]?.startedAt);
  const regenerate = useGym((s) => s.regenerateSmartPlan);
  const stale =
    !plan ||
    Date.now() - new Date(plan.createdAt).getTime() > 6 * 3600 * 1000 ||
    (lastWorkout != null && lastWorkout > plan.createdAt);
  useEffect(() => {
    if (hydrated && stale) regenerate();
  }, [hydrated, stale, regenerate]);
  return stale ? null : plan;
}
