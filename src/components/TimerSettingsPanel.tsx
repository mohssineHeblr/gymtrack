"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Play, Smartphone, Vibrate, Volume2 } from "lucide-react";
import { Chip, Toggle } from "./ui";
import { useGym } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ALARM_SOUNDS, type TimerSettings } from "@/lib/types";
import { canVibrate, playAlarm, unlockAudio, vibrate } from "@/lib/alarm";
import {
  ensurePushSubscription,
  notificationPermission,
  pushConfigured,
  requestNotificationPermission,
  showRestNotification,
} from "@/lib/rest-notify";
import { cn, formatDuration } from "@/lib/utils";

export const REST_PRESETS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

function isIos() {
  return typeof navigator !== "undefined" && /iP(hone|ad|od)/.test(navigator.userAgent);
}
function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

/** Sound / vibration / notification preferences for the rest timer. */
export function TimerSettingsPanel({ compact = false }: { compact?: boolean }) {
  const timer = useGym((s) => s.profile.timer);
  const updateProfile = useGym((s) => s.updateProfile);
  const user = useAuth((s) => s.user);
  const set = (patch: Partial<TimerSettings>) => updateProfile({ timer: { ...timer, ...patch } });
  const [perm, setPerm] = useState<string>("default");
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  useEffect(() => setPerm(notificationPermission()), []);

  const enableNotifications = async (on: boolean) => {
    if (!on) return set({ notifications: false, push: false });
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      set({ notifications: true });
      void showRestNotification("Notifications are on. You'll be alerted when rest ends.");
    }
  };

  const enablePush = async (on: boolean) => {
    setPushMsg(null);
    if (!on) return set({ push: false });
    if (!user) return setPushMsg("Sign in (Profile → Account) to use push notifications.");
    let p = notificationPermission();
    if (p !== "granted") p = await requestNotificationPermission();
    setPerm(p);
    if (p !== "granted") return setPushMsg("Notification permission was not granted.");
    const ok = await ensurePushSubscription();
    if (!ok) return setPushMsg("Could not subscribe this device for push. Check the server setup in the README.");
    set({ push: true, notifications: true });
  };

  const iosNotInstalled = isIos() && !isStandalone();

  return (
    <div className="space-y-4">
      <Row icon={<Volume2 className="h-4 w-4" />} title="Alarm sound" sub="Plays when the countdown hits zero">
        <Toggle checked={timer.sound} onChange={(v) => set({ sound: v })} label="Alarm sound" />
      </Row>
      {timer.sound && (
        <div className="space-y-3 pl-11">
          <div className="flex flex-wrap gap-2">
            {ALARM_SOUNDS.map((s) => (
              <Chip
                key={s.id}
                active={timer.alarm === s.id}
                onClick={() => {
                  unlockAudio();
                  set({ alarm: s.id });
                  playAlarm(s.id, timer.volume);
                }}
              >
                {s.label}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={timer.volume}
              aria-label="Alarm volume"
              onChange={(e) => set({ volume: Number(e.target.value) })}
              className="h-2 flex-1 accent-[var(--accent)]"
            />
            <button
              aria-label="Preview alarm"
              onClick={() => {
                unlockAudio();
                playAlarm(timer.alarm, timer.volume);
              }}
              className="tap flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-accent"
            >
              <Play className="h-4 w-4" fill="currentColor" />
            </button>
          </div>
          {isIos() && <p className="text-xs text-subtle">On iPhone the alarm is muted by the silent switch and can't play while the screen is locked.</p>}
        </div>
      )}

      <Row
        icon={<Vibrate className="h-4 w-4" />}
        title="Vibration"
        sub={canVibrate() ? "Buzz when rest is over" : "Not supported by this browser (iPhone Safari doesn't allow it)"}
      >
        <Toggle
          checked={timer.vibration}
          onChange={(v) => {
            set({ vibration: v });
            if (v) vibrate([120]);
          }}
          label="Vibration"
        />
      </Row>

      {!compact && (
        <Row icon={<Smartphone className="h-4 w-4" />} title="Auto-start after a set" sub="Start resting as soon as you tick a set">
          <Toggle checked={timer.autoStart} onChange={(v) => set({ autoStart: v })} label="Auto-start rest timer" />
        </Row>
      )}

      <Row
        icon={perm === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        title="Notification"
        sub={
          perm === "unsupported"
            ? iosNotInstalled
              ? "Add GYMTRACK to your Home Screen first (iOS 16.4+)"
              : "Not supported by this browser"
            : perm === "denied"
              ? "Blocked — allow notifications in your browser / system settings"
              : "Alert when rest ends while the app is in the background"
        }
      >
        <Toggle
          checked={timer.notifications && perm === "granted"}
          onChange={(v) => void enableNotifications(v)}
          label="Rest notifications"
        />
      </Row>

      {!compact && pushConfigured() && (
        <div>
          <Row icon={<Bell className="h-4 w-4" />} title="Locked-screen push" sub="Server push when the phone is locked or the app is suspended">
            <Toggle checked={timer.push} onChange={(v) => void enablePush(v)} label="Locked-screen push" />
          </Row>
          {pushMsg && <p className="mt-1 pl-11 text-xs text-warn">{pushMsg}</p>}
        </div>
      )}

      {!compact && (
        <div>
          <div className="mb-2 text-[13px] font-medium text-muted">Default rest (manual timer)</div>
          <div className="grid grid-cols-5 gap-2">
            {REST_PRESETS.map((r) => (
              <button
                key={r}
                onClick={() => set({ defaultRest: r })}
                className={cn("tap rounded-xl py-2 text-sm font-semibold", timer.defaultRest === r ? "bg-accent text-accent-ink" : "bg-surface-2")}
              >
                {formatDuration(r)}
              </button>
            ))}
          </div>
        </div>
      )}

      {!compact && (
        <p className="text-xs leading-relaxed text-subtle">
          The timer keeps correct time even if the app is closed — it is based on the clock, not on a running script. Phones pause web apps in the
          background, so sound and vibration only play while GYMTRACK is open. Notifications cover the background case; on iPhone they need the
          app installed to the Home Screen and use the standard notification sound.
        </p>
      )}
    </div>
  );
}

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      {children}
    </div>
  );
}
