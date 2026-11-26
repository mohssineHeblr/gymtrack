"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Apple,
  BookOpen,
  ChevronRight,
  Cloud,
  CloudOff,
  Database,
  Download,
  History,
  LogOut,
  RefreshCw,
  Ruler,
  Smartphone,
  Activity,
  Upload,
} from "lucide-react";
import { TrainingSettings } from "@/components/TrainingSettings";
import { Button, Card, Field, Input, PageHeader, SectionTitle, Segmented, Select, TextArea } from "@/components/ui";
import { useGym, DEFAULT_PROFILE, migrateState, type GymState } from "@/lib/store";
import { useAuth, signOut } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { syncNow } from "@/lib/sync";
import { generateSampleData } from "@/lib/sample-data";
import { TimerSettingsPanel } from "@/components/TimerSettingsPanel";
import { useOnline } from "@/lib/hooks";
import { displayToKg, kgToDisplay, parseNum, relativeDay, formatTime } from "@/lib/utils";
import type { FitnessGoal, Theme, Units } from "@/lib/types";

const GOALS: { value: FitnessGoal; label: string }[] = [
  { value: "build_muscle", label: "Build muscle" },
  { value: "strength", label: "Get stronger" },
  { value: "lose_fat", label: "Lose fat" },
  { value: "endurance", label: "Improve endurance" },
  { value: "maintain", label: "Stay fit" },
];

export default function ProfilePage() {
  const profile = useGym((s) => s.profile);
  const workouts = useGym((s) => s.workouts);
  const sync = useGym((s) => s.sync);
  const updateProfile = useGym((s) => s.updateProfile);
  const replaceData = useGym((s) => s.replaceData);
  const resetAll = useGym((s) => s.resetAll);
  const setSync = useGym((s) => s.setSync);
  const user = useAuth((s) => s.user);
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetText, setTargetText] = useState(() => {
    const v = kgToDisplay(profile.targetWeight, profile.units);
    return v == null ? "" : String(v);
  });

  const setUnits = (u: Units) => {
    updateProfile({ units: u });
    const v = kgToDisplay(profile.targetWeight, u);
    setTargetText(v == null ? "" : String(v));
  };

  const exportData = () => {
    const s = useGym.getState();
    const data = {
      app: "gymtrack",
      version: 2,
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      customExercises: s.customExercises,
      programs: s.programs,
      workouts: s.workouts,
      body: s.body,
      meals: s.meals,
      foods: s.foods,
      savedMeals: s.savedMeals,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gymtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== "gymtrack") throw new Error("Not a GYMTRACK backup file");
      if (!confirm("Replace all current data with this backup?")) return;
      const now = new Date().toISOString();
      const touch = <T extends { updatedAt?: string }>(arr: T[] = []) => arr.map((x) => ({ ...x, updatedAt: now }));
      // v1 backups contain flat "nutrition" logs — migrate them into meals
      const migrated = migrateState(data, Number(data.version ?? 1)) as Partial<GymState>;
      replaceData({
        profile: { ...DEFAULT_PROFILE, ...migrated.profile, timer: { ...DEFAULT_PROFILE.timer, ...migrated.profile?.timer }, updatedAt: now },
        customExercises: touch(migrated.customExercises),
        programs: touch(migrated.programs),
        workouts: touch(migrated.workouts),
        body: touch(migrated.body),
        meals: touch(migrated.meals),
        foods: touch(migrated.foods),
        savedMeals: touch(migrated.savedMeals),
      });
      alert("Backup restored.");
    } catch (e) {
      alert(`Import failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div>
      <PageHeader title="Profile" />

      <Card className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-extrabold text-accent-ink">
          {(profile.name || "A").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold">{profile.name || "Athlete"}</div>
          <div className="truncate text-sm text-muted">{user?.email ?? "Local account · this device"}</div>
          <div className="mt-1 text-xs text-muted">{workouts.length} workouts logged</div>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {[
          { href: "/history", icon: History, label: "History" },
          { href: "/body", icon: Ruler, label: "Body" },
          { href: "/nutrition", icon: Apple, label: "Nutrition" },
          { href: "/exercises", icon: BookOpen, label: "Exercises" },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="tap flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 font-semibold">
            <Icon className="h-5 w-5 text-accent" /> {label}
          </Link>
        ))}
      </div>

      <SectionTitle>Personal</SectionTitle>
      <Card className="space-y-4">
        <Field label="Name">
          <Input value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Your name" />
        </Field>
        <Field label="Primary goal">
          <Select value={profile.fitnessGoal} onChange={(e) => updateProfile({ fitnessGoal: e.target.value as FitnessGoal })}>
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Target weight (${profile.units})`}>
            <Input
              inputMode="decimal"
              value={targetText}
              placeholder="—"
              onChange={(e) => {
                setTargetText(e.target.value);
                updateProfile({ targetWeight: displayToKg(parseNum(e.target.value), profile.units) });
              }}
            />
          </Field>
          <Field label="Workouts / week">
            <Select value={profile.weeklyGoal} onChange={(e) => updateProfile({ weeklyGoal: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="My fitness goals">
          <TextArea
            value={profile.goalDescription}
            onChange={(e) => updateProfile({ goalDescription: e.target.value })}
            placeholder="e.g. Bench 100 kg by summer, run a 5k under 25 min"
            className="min-h-20"
          />
        </Field>
      </Card>

      <SectionTitle action={<Link href="/recovery" className="flex items-center gap-1 text-sm font-semibold text-accent"><Activity className="h-4 w-4" /> Recovery</Link>}>
        Training & smart workouts
      </SectionTitle>
      <Card>
        <TrainingSettings hideGoal />
      </Card>

      <SectionTitle>Rest timer</SectionTitle>
      <Card>
        <TimerSettingsPanel />
      </Card>

      <SectionTitle>Preferences</SectionTitle>
      <Card className="space-y-4">
        <Field label="Units" group>
          <Segmented value={profile.units} onChange={setUnits} options={[{ value: "kg", label: "kg" }, { value: "lbs", label: "lbs" }]} />
        </Field>
        <Field label="Theme" group>
          <Segmented
            value={profile.theme}
            onChange={(t: Theme) => updateProfile({ theme: t })}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ]}
          />
        </Field>
      </Card>

      <SectionTitle>Account & sync</SectionTitle>
      <Card className="space-y-3">
        {!isSupabaseConfigured ? (
          <div className="flex gap-3">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
            <div className="text-sm">
              <div className="font-semibold">Local mode</div>
              <p className="mt-0.5 text-muted">
                Your data is stored on this device and works offline. To back up and sync across devices, add Supabase keys (see README).
              </p>
            </div>
          </div>
        ) : user ? (
          <>
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-accent" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-semibold">{user.email}</div>
                <div className="text-muted">
                  {!online
                    ? "Offline — changes will sync when you reconnect"
                    : sync.status === "syncing"
                      ? "Syncing…"
                      : sync.status === "error"
                        ? `Sync error: ${sync.error}`
                        : sync.lastSyncedAt
                          ? `Synced ${relativeDay(sync.lastSyncedAt).toLowerCase()} at ${formatTime(sync.lastSyncedAt)}`
                          : "Not synced yet"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={<RefreshCw className={`h-4 w-4 ${sync.status === "syncing" ? "animate-spin" : ""}`} />} onClick={() => syncNow()} disabled={!online}>
                Sync now
              </Button>
              <Button
                variant="secondary"
                icon={<LogOut className="h-4 w-4" />}
                onClick={async () => {
                  if (!confirm("Sign out? Data stays on this device.")) return;
                  await signOut();
                  setSync({ lastSyncedAt: null, status: "idle", error: null });
                }}
              >
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <p className="text-sm text-muted">Sign in to back up your data and sync between your iPhone and other devices.</p>
            </div>
            <Link href="/login" className="block">
              <Button className="w-full">Sign in or create account</Button>
            </Link>
          </>
        )}
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card className="space-y-2">
        <Button variant="secondary" className="w-full justify-start" icon={<Download className="h-4 w-4" />} onClick={exportData}>
          Export backup (JSON)
        </Button>
        <Button variant="secondary" className="w-full justify-start" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
          Import backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importData(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          className="w-full justify-start"
          icon={<Database className="h-4 w-4" />}
          onClick={() => {
            if (!confirm("Add 8 weeks of sample workouts, body and nutrition data?")) return;
            const s = useGym.getState();
            const sample = generateSampleData();
            replaceData({
              workouts: [...s.workouts, ...sample.workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
              body: [...s.body, ...sample.body].sort((a, b) => a.date.localeCompare(b.date)),
              meals: [...s.meals, ...sample.meals],
            });
          }}
        >
          Load sample data
        </Button>
        <Button
          variant="danger"
          className="w-full justify-start"
          onClick={() => {
            if (confirm("Erase ALL data on this device? This cannot be undone.") && confirm("Are you absolutely sure?")) resetAll();
          }}
        >
          Reset all data
        </Button>
      </Card>

      <SectionTitle>Install on iPhone</SectionTitle>
      <Card className="flex gap-3 text-sm">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <ol className="list-decimal space-y-1 pl-4 text-muted">
          <li>Open this site in <b className="text-fg">Safari</b>.</li>
          <li>Tap the <b className="text-fg">Share</b> button.</li>
          <li>Choose <b className="text-fg">Add to Home Screen</b>.</li>
          <li>Launch GYMTRACK from your home screen.</li>
        </ol>
      </Card>

      <p className="mt-6 text-center text-xs text-subtle">GYMTRACK v1.0 · {isSupabaseConfigured ? "Cloud sync available" : "Local mode"}</p>
    </div>
  );
}
