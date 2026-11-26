"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { Minus, Pause, Play, Plus, RotateCcw, Settings2, SkipForward, Timer } from "lucide-react";
import { Sheet } from "./ui";
import { REST_PRESETS, TimerSettingsPanel } from "./TimerSettingsPanel";
import { useGym } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { playAlarm, vibrate } from "@/lib/alarm";
import { cancelRestPush, refreshToken, scheduleRestPush, showRestNotification } from "@/lib/rest-notify";
import { cn, formatDuration } from "@/lib/utils";

/** UI state for the expanded timer sheet (opened from the workout header or the floating bar). */
export const useTimerSheet = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** How long after the end the "rest over" state stays visible */
const DONE_VISIBLE_MS = 4000;
/** Alarms for timers that ended longer ago than this (e.g. app was suspended) are skipped */
const LATE_ALARM_MS = 30_000;

function useRestEngine() {
  const t = useGym((s) => s.restTimer);
  const timerPrefs = useGym((s) => s.profile.timer);
  const markRestAlerted = useGym((s) => s.markRestAlerted);
  const stopRest = useGym((s) => s.stopRest);
  const running = t.endsAt !== null;
  const now = useNow(250, running);

  const remainingMs = t.endsAt ? t.endsAt - now : (t.pausedRemaining ?? 0) * 1000;
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  const done = running && remainingMs <= 0;

  // Fire the alarm once per countdown (timestamp-based, so it also works after the app was suspended)
  useEffect(() => {
    if (!t.endsAt || !done || t.alertedFor === t.endsAt) return;
    markRestAlerted(t.endsAt);
    const late = Date.now() - t.endsAt > LATE_ALARM_MS;
    const hidden = document.visibilityState === "hidden";
    if (!late) {
      if (timerPrefs.sound) playAlarm(timerPrefs.alarm, timerPrefs.volume);
      if (timerPrefs.vibration) vibrate();
    }
    if (hidden && timerPrefs.notifications) void showRestNotification();
  }, [done, t.endsAt, t.alertedFor, timerPrefs, markRestAlerted]);

  // Auto-dismiss a finished countdown while the app is visible
  useEffect(() => {
    if (!t.endsAt || !done) return;
    const endsAt = t.endsAt;
    let id: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(id);
      id = setTimeout(stopRest, Math.max(2500, endsAt + DONE_VISIBLE_MS - Date.now()));
    };
    const onVis = () => document.visibilityState === "visible" && arm();
    if (document.visibilityState === "visible") arm();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [done, t.endsAt, stopRest]);

  // Push fallback: schedule when the app goes to the background, cancel when it's visible again
  useEffect(() => {
    if (!timerPrefs.push) return;
    void refreshToken();
    const onVis = () => {
      const cur = useGym.getState().restTimer;
      if (document.visibilityState === "hidden") {
        if (cur.endsAt && cur.endsAt > Date.now()) scheduleRestPush(cur.endsAt);
      } else {
        cancelRestPush();
        void refreshToken();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onVis);
    };
  }, [timerPrefs.push]);

  useEffect(() => {
    if (!t.endsAt) cancelRestPush();
  }, [t.endsAt]);

  // Countdown in the tab title (handy on desktop)
  useEffect(() => {
    const base = "GYMTRACK";
    if (running && !done) document.title = `${formatDuration(remaining)} · Rest`;
    else if (t.pausedRemaining != null) document.title = `⏸ ${formatDuration(remaining)} · Rest`;
    else document.title = base;
    return () => {
      document.title = base;
    };
  }, [running, done, remaining, t.pausedRemaining]);

  return { t, remaining, done, running, paused: t.pausedRemaining != null };
}

function CountdownRing({ remaining, duration, size, stroke, done, paused }: { remaining: number; duration: number; size: number; stroke: number; done: boolean; paused: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = done ? 1 : duration > 0 ? Math.min(1, remaining / duration) : 0;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={paused ? "var(--warn)" : "var(--accent)"}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 0.25s linear" }}
      />
    </svg>
  );
}

export function RestTimer() {
  const { t, remaining, done, running, paused } = useRestEngine();
  const open = useTimerSheet((s) => s.open);
  const setOpen = useTimerSheet((s) => s.setOpen);
  const stopRest = useGym((s) => s.stopRest);
  const adjustRest = useGym((s) => s.adjustRest);
  const pauseRest = useGym((s) => s.pauseRest);
  const resumeRest = useGym((s) => s.resumeRest);
  const active = running || paused;

  return (
    <>
      {active && !open && (
        <div className="bottom-nav-offset fixed inset-x-0 z-50 mx-auto max-w-lg animate-fade-up px-4">
          <div className={cn("relative overflow-hidden rounded-3xl border bg-surface shadow-2xl shadow-black/60", done ? "border-accent" : "border-accent/30")}>
            <div className="relative flex items-center gap-3 p-3">
              <button onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Open rest timer">
                <div className="relative h-12 w-12 shrink-0">
                  <CountdownRing remaining={remaining} duration={t.duration} size={48} stroke={5} done={done} paused={paused} />
                  <Timer className={cn("absolute inset-0 m-auto h-5 w-5", paused ? "text-warn" : "text-accent")} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {done ? "Rest over — go!" : paused ? "Paused" : (t.label ?? "Rest")}
                  </div>
                  <div className={cn("text-2xl font-bold tabular-nums", done && "text-accent")}>{formatDuration(remaining)}</div>
                </div>
              </button>
              {!done && (
                <>
                  <button aria-label="Subtract 15 seconds" onClick={() => adjustRest(-15)} className="tap flex h-10 items-center gap-0.5 rounded-xl bg-surface-2 px-2 text-sm font-semibold">
                    <Minus className="h-3.5 w-3.5" />15
                  </button>
                  <button aria-label="Add 15 seconds" onClick={() => adjustRest(15)} className="tap flex h-10 items-center gap-0.5 rounded-xl bg-surface-2 px-2 text-sm font-semibold">
                    <Plus className="h-3.5 w-3.5" />15
                  </button>
                  <button
                    aria-label={paused ? "Resume rest timer" : "Pause rest timer"}
                    onClick={paused ? resumeRest : pauseRest}
                    className="tap flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2"
                  >
                    {paused ? <Play className="h-4 w-4" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}
                  </button>
                </>
              )}
              <button aria-label="Stop rest timer" onClick={stopRest} className="tap flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink">
                <SkipForward className="h-4 w-4" fill="currentColor" />
              </button>
            </div>
          </div>
        </div>
      )}
      <TimerSheet open={open} onClose={() => setOpen(false)} remaining={remaining} done={done} paused={paused} active={active} />
    </>
  );
}

function TimerSheet({ open, onClose, remaining, done, paused, active }: { open: boolean; onClose: () => void; remaining: number; done: boolean; paused: boolean; active: boolean }) {
  const t = useGym((s) => s.restTimer);
  const defaultRest = useGym((s) => s.profile.timer.defaultRest);
  const startRest = useGym((s) => s.startRest);
  const stopRest = useGym((s) => s.stopRest);
  const adjustRest = useGym((s) => s.adjustRest);
  const pauseRest = useGym((s) => s.pauseRest);
  const resumeRest = useGym((s) => s.resumeRest);
  const resetRest = useGym((s) => s.resetRest);
  const [settings, setSettings] = useState(false);
  const [chosen, setChosen] = useState(defaultRest);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) setChosen(defaultRest);
    wasOpen.current = open;
  }, [open, defaultRest]);

  const display = active ? remaining : chosen;
  const total = active ? t.duration : chosen;

  return (
    <Sheet open={open} onClose={onClose} title={settings ? "Timer settings" : "Rest timer"}>
      {settings ? (
        <div className="pb-2">
          <TimerSettingsPanel />
          <button onClick={() => setSettings(false)} className="tap mt-5 w-full rounded-2xl bg-surface-2 py-3 text-sm font-semibold">
            Back to timer
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center pb-2">
          <div className="relative mt-1">
            <CountdownRing remaining={display} duration={total} size={232} stroke={14} done={done} paused={paused} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {done ? "Rest over" : paused ? "Paused" : active ? (t.label ?? "Resting") : "Ready"}
              </div>
              <div className={cn("text-[56px] font-extrabold leading-none tabular-nums", done && "text-accent")} aria-live="polite">
                {formatDuration(display)}
              </div>
              {active && <div className="mt-1 text-xs text-subtle">of {formatDuration(t.duration)}</div>}
            </div>
          </div>

          <div className="mt-5 flex w-full items-center justify-center gap-3">
            <RoundBtn label="Subtract 15 seconds" onClick={() => (active ? adjustRest(-15) : setChosen((c) => Math.max(5, c - 15)))}>
              <Minus className="h-4 w-4" />
              <span className="text-[11px]">15</span>
            </RoundBtn>
            {active ? (
              <button
                aria-label={paused ? "Resume" : "Pause"}
                onClick={paused ? resumeRest : pauseRest}
                disabled={done}
                className="tap flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-40"
              >
                {paused ? <Play className="h-8 w-8" fill="currentColor" /> : <Pause className="h-8 w-8" fill="currentColor" />}
              </button>
            ) : (
              <button aria-label="Start timer" onClick={() => startRest(chosen)} className="tap flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-ink">
                <Play className="h-8 w-8" fill="currentColor" />
              </button>
            )}
            <RoundBtn label="Add 15 seconds" onClick={() => (active ? adjustRest(15) : setChosen((c) => Math.min(3600, c + 15)))}>
              <Plus className="h-4 w-4" />
              <span className="text-[11px]">15</span>
            </RoundBtn>
          </div>

          {active && (
            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <button onClick={resetRest} className="tap flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              <button
                onClick={() => {
                  stopRest();
                  onClose();
                }}
                className="tap flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold"
              >
                <SkipForward className="h-4 w-4" /> Skip rest
              </button>
            </div>
          )}

          <div className="mt-5 w-full">
            <div className="mb-2 text-[13px] font-medium text-muted">{active ? "Restart with" : "Duration"}</div>
            <div className="grid grid-cols-5 gap-2">
              {REST_PRESETS.map((r) => (
                <button
                  key={r}
                  onClick={() => (active ? startRest(r, t.label) : setChosen(r))}
                  className={cn("tap rounded-xl py-2.5 text-sm font-semibold", (active ? t.duration : chosen) === r ? "bg-accent text-accent-ink" : "bg-surface-2")}
                >
                  {formatDuration(r)}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setSettings(true)} className="tap mt-5 flex items-center gap-2 text-sm font-semibold text-accent">
            <Settings2 className="h-4 w-4" /> Sound, vibration & notifications
          </button>
        </div>
      )}
    </Sheet>
  );
}

function RoundBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} onClick={onClick} className="tap flex h-14 w-14 flex-col items-center justify-center rounded-full bg-surface-2 font-semibold">
      {children}
    </button>
  );
}
