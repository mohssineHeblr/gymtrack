"use client";

import type { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_TINT: Record<string, string> = {
  compound: "text-accent",
  isolation: "text-info",
  cardio: "text-warn",
  plyometric: "text-danger",
  mobility: "text-muted",
};

/** Exercise image if the user uploaded one, otherwise a lettered tile tinted by exercise type. */
export function ExerciseThumb({ exercise, className, selected }: { exercise: Exercise; className?: string; selected?: boolean }) {
  if (exercise.image && !selected) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={exercise.image} alt="" className={cn("h-10 w-10 shrink-0 rounded-2xl object-cover", className)} loading="lazy" />
    );
  }
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-bold",
        selected ? "bg-accent text-accent-ink" : cn("bg-surface-2", TYPE_TINT[exercise.type ?? "compound"]),
        className,
      )}
    >
      {exercise.name.slice(0, 2).toUpperCase()}
    </div>
  );
}
