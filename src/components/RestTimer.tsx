"use client";

import { useEffect, useRef } from "react";
import { Minus, Plus, Timer, X } from "lucide-react";
import { useGym } from "@/lib/store";
import { beep, useNow } from "@/lib/hooks";
import { formatDuration } from "@/lib/utils";

export function RestTimer() {
  const { endsAt, duration } = useGym((s) => s.restTimer);
  const stopRest = useGym((s) => s.stopRest);
  const adjustRest = useGym((s) => s.adjustRest);
  const now = useNow(250, endsAt !== null);
  const fired = useRef<number | null>(null);

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (!endsAt) return;
    if (remaining === 0 && fired.current !== endsAt) {
      fired.current = endsAt;
      beep();
      const t = setTimeout(stopRest, 1500);
      return () => clearTimeout(t);
    }
  }, [remaining, endsAt, stopRest]);

  if (!endsAt) return null;
  const pct = duration > 0 ? (remaining / duration) * 100 : 0;

  return (
    <div className="bottom-nav-offset fixed inset-x-0 z-50 mx-auto max-w-lg animate-fade-up px-4">
      <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-surface shadow-2xl shadow-black/60">
        <div className="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
        <div className="relative flex items-center gap-3 p-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <Timer className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{remaining === 0 ? "Rest over — go!" : "Rest"}</div>
            <div className="text-2xl font-bold tabular-nums">{formatDuration(remaining)}</div>
          </div>
          <button aria-label="Subtract 15 seconds" onClick={() => adjustRest(-15)} className="tap flex h-10 items-center gap-0.5 rounded-xl bg-surface-2 px-2.5 text-sm font-semibold">
            <Minus className="h-3.5 w-3.5" />15
          </button>
          <button aria-label="Add 15 seconds" onClick={() => adjustRest(15)} className="tap flex h-10 items-center gap-0.5 rounded-xl bg-surface-2 px-2.5 text-sm font-semibold">
            <Plus className="h-3.5 w-3.5" />15
          </button>
          <button aria-label="Stop rest timer" onClick={stopRest} className="tap flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
