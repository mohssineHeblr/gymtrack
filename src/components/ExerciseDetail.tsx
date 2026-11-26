"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { Badge, Button, Sheet } from "./ui";
import { TrendChart } from "./charts";
import { useExerciseMap, useGym } from "@/lib/store";
import { computePRs, exerciseProgression } from "@/lib/stats";
import { formatDate, formatWeight, kgToDisplay } from "@/lib/utils";

export function ExerciseDetail({
  exerciseId,
  onClose,
  onEdit,
  onDelete,
}: {
  exerciseId: string | null;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const exMap = useExerciseMap();
  const workouts = useGym((s) => s.workouts);
  const units = useGym((s) => s.profile.units);
  const ex = exerciseId ? exMap.get(exerciseId) : undefined;

  const progression = useMemo(
    () => (exerciseId ? exerciseProgression(workouts, exerciseId).map((p) => ({ ...p, e1rm: kgToDisplay(p.e1rm, units) ?? 0 })) : []),
    [workouts, exerciseId, units],
  );
  const pr = useMemo(() => (exerciseId ? computePRs(workouts).get(exerciseId) : undefined), [workouts, exerciseId]);

  return (
    <Sheet open={!!ex} onClose={onClose} title={ex?.name}>
      {ex && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge>{ex.muscleGroup}</Badge>
            <Badge className="bg-surface-3 text-fg">{ex.equipment}</Badge>
            {ex.isCustom && <Badge className="bg-surface-3 text-muted">Custom</Badge>}
          </div>
          <p className="text-[15px] leading-relaxed text-fg/90">{ex.description}</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-muted">Recommended</div>
              <div className="text-lg font-bold">
                {ex.recommendedSets} × {ex.recommendedReps}
              </div>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="flex items-center gap-1 text-xs text-muted">
                <Trophy className="h-3 w-3 text-warn" /> Your best
              </div>
              <div className="text-lg font-bold">
                {pr ? `${formatWeight(pr.bestWeight, units)} × ${pr.bestWeightReps}` : "—"}
              </div>
            </div>
          </div>

          {ex.instructions.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">How to</h4>
              <ol className="space-y-2.5">
                {ex.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-[15px]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                    <span className="text-fg/90">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {progression.length > 1 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Estimated 1RM</h4>
              <TrendChart id={`ex-${ex.id}`} data={progression} x="label" y="e1rm" unit={units} height={170} />
              <p className="mt-1 text-xs text-muted">
                {progression.length} sessions · last {formatDate(progression[progression.length - 1].date)}
              </p>
            </div>
          )}

          {(onEdit || onDelete) && (
            <div className="grid grid-cols-2 gap-2">
              {onEdit && (
                <Button variant="secondary" onClick={onEdit}>
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button variant="danger" onClick={onDelete}>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
