"use client";

import { useMemo, useState } from "react";
import { Ban, ChevronRight, Heart, Search } from "lucide-react";
import { Button, Sheet } from "./ui";
import { ExercisePicker } from "./ExercisePicker";
import { useExercises, useGym } from "@/lib/store";
import { alternativesFor } from "@/lib/generator";
import { useRecovery } from "@/lib/use-recovery";
import { MUSCLE_INFO, musclesFor } from "@/data/muscles";
import { cn } from "@/lib/utils";

/** Replace an exercise with a smart alternative (same muscles, available equipment). */
export function SwapSheet({
  exerciseId,
  onClose,
  onPick,
  exclude = [],
}: {
  exerciseId: string | null;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  exclude?: string[];
}) {
  const all = useExercises();
  const profile = useGym((s) => s.profile);
  const workouts = useGym((s) => s.workouts);
  const toggleFavorite = useGym((s) => s.toggleFavorite);
  const toggleExcluded = useGym((s) => s.toggleExcluded);
  const recovery = useRecovery();
  const [browse, setBrowse] = useState(false);
  const current = all.find((e) => e.id === exerciseId);

  const alts = useMemo(
    () => (exerciseId ? alternativesFor(exerciseId, all, profile, recovery, workouts, exclude).slice(0, 10) : []),
    [exerciseId, all, profile, recovery, workouts, exclude],
  );
  const fav = !!exerciseId && profile.favoriteExercises.includes(exerciseId);
  const excluded = !!exerciseId && profile.excludedExercises.includes(exerciseId);

  const pick = (id: string) => {
    onPick(id);
    onClose();
  };

  return (
    <>
      <Sheet open={!!exerciseId && !browse} onClose={onClose} title="Replace exercise">
        {current && (
          <div className="mb-4 rounded-2xl bg-surface-2 p-3">
            <div className="text-xs text-muted">Current</div>
            <div className="font-semibold">{current.name}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => toggleFavorite(current.id)}
                className={cn("tap flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold", fav ? "bg-accent text-accent-ink" : "bg-surface-3 text-fg")}
                aria-pressed={fav}
              >
                <Heart className="h-3.5 w-3.5" fill={fav ? "currentColor" : "none"} /> {fav ? "Suggesting more" : "Suggest more"}
              </button>
              <button
                onClick={() => toggleExcluded(current.id)}
                className={cn("tap flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold", excluded ? "bg-danger text-white" : "bg-surface-3 text-fg")}
                aria-pressed={excluded}
              >
                <Ban className="h-3.5 w-3.5" /> {excluded ? "Never suggested" : "Don't suggest"}
              </button>
            </div>
          </div>
        )}

        <div className="mb-2 text-[13px] font-medium text-muted">Recommended alternatives</div>
        {alts.length ? (
          <div className="space-y-1.5">
            {alts.map((e) => {
              const tg = musclesFor(e);
              return (
                <button key={e.id} onClick={() => pick(e.id)} className="tap flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {e.name}
                      {profile.favoriteExercises.includes(e.id) && <Heart className="h-3 w-3 text-accent" fill="currentColor" />}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {e.equipment} · {tg.primary.map((m) => MUSCLE_INFO[m].label).join(", ")}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-subtle" />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">No alternatives with your current equipment. Browse the full library instead.</p>
        )}
        <Button variant="secondary" className="mt-3 w-full" icon={<Search className="h-4 w-4" />} onClick={() => setBrowse(true)}>
          Browse all exercises
        </Button>
      </Sheet>
      <ExercisePicker
        open={browse}
        multi={false}
        title="Choose replacement"
        onClose={() => setBrowse(false)}
        onPick={(ids) => {
          setBrowse(false);
          if (ids[0]) pick(ids[0]);
        }}
      />
    </>
  );
}
