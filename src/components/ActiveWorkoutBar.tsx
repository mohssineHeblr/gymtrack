"use client";

import Link from "next/link";
import { ChevronRight, Dumbbell } from "lucide-react";
import { useGym } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { formatDuration } from "@/lib/utils";

export function ActiveWorkoutBar() {
  const w = useGym((s) => s.activeWorkout);
  const resting = useGym((s) => s.restTimer.endsAt !== null);
  const now = useNow(1000, w !== null);
  if (!w || resting) return null;
  const elapsed = (now - new Date(w.startedAt).getTime()) / 1000;
  return (
    <div className="bottom-nav-offset fixed inset-x-0 z-40 mx-auto max-w-lg animate-fade-up px-4">
    <Link
      href="/workout"
      className="tap flex items-center gap-3 rounded-3xl bg-accent p-3 text-accent-ink shadow-[0_10px_40px_-10px_var(--accent)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/10">
        <Dumbbell className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{w.name}</div>
        <div className="text-xs font-semibold opacity-70">In progress · {formatDuration(elapsed)}</div>
      </div>
      <span className="flex items-center text-sm font-bold">
        Resume <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
    </div>
  );
}
