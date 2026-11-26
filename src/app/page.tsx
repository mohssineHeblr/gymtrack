"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Apple,
  BookOpen,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  History,
  Play,
  Ruler,
  Scale,
  Trophy,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, ProgressBar, SectionTitle, Stat } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { useExerciseMap, useGym } from "@/lib/store";
import { computePRs, latestMeasurement, thisWeek, weekStreak, weeklyActivity, workoutDurationSec, workoutVolume } from "@/lib/stats";
import { nextScheduled, todaysDay } from "@/lib/program-utils";
import { formatCompact, formatDate, formatWeight, greeting, kgToDisplay, relativeDay, toDateKey } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { SmartWorkoutCard } from "@/components/SmartWorkoutCard";
import { BodyMap } from "@/components/BodyMap";
import { recoveryColors, useRecovery } from "@/lib/use-recovery";
import { MUSCLES, MUSCLE_INFO } from "@/data/muscles";
import { LEVEL_COLOR, recoveryLevel } from "@/lib/recovery";
import { dayTotals } from "@/lib/nutrition";

export default function Dashboard() {
  const router = useRouter();
  const profile = useGym((s) => s.profile);
  const workouts = useGym((s) => s.workouts);
  const programs = useGym((s) => s.programs);
  const body = useGym((s) => s.body);
  const meals = useGym((s) => s.meals);
  const active = useGym((s) => s.activeWorkout);
  const syncStatus = useGym((s) => s.sync.status);
  const startWorkout = useGym((s) => s.startWorkout);
  const startFromProgramDay = useGym((s) => s.startFromProgramDay);
  const user = useAuth((s) => s.user);
  const exMap = useExerciseMap();
  const recovery = useRecovery();
  const overallRecovery = Math.round(MUSCLES.reduce((a, m) => a + recovery[m].recovery, 0) / MUSCLES.length);
  const freshest = [...MUSCLES].filter((m) => MUSCLE_INFO[m].size === "large").sort((a, b) => recovery[b].recovery - recovery[a].recovery).slice(0, 3);
  const sorest = [...MUSCLES].sort((a, b) => recovery[a].recovery - recovery[b].recovery).filter((m) => recovery[m].recovery < 70).slice(0, 3);

  const program = programs.find((p) => p.id === profile.activeProgramId);
  const today = todaysDay(program);
  const next = nextScheduled(program);
  const doneToday = today && workouts.some((w) => w.programDayId === today.id && toDateKey(w.startedAt) === toDateKey());

  const week = useMemo(() => thisWeek(workouts), [workouts]);
  const activity = useMemo(() => weeklyActivity(workouts), [workouts]);
  const streak = useMemo(() => weekStreak(workouts), [workouts]);
  const weekVolume = week.reduce((a, w) => a + workoutVolume(w), 0);
  const weekMinutes = Math.round(week.reduce((a, w) => a + workoutDurationSec(w), 0) / 60);
  const weight = latestMeasurement(body, "weight");

  const prs = useMemo(
    () => [...computePRs(workouts).values()].filter((p) => p.bestWeight > 0).sort((a, b) => b.achievedAt.localeCompare(a.achievedAt)).slice(0, 4),
    [workouts],
  );

  const todayKey = toDateKey();
  const todayCalories = dayTotals(meals, todayKey).calories;

  const quickStart = () => {
    if (!active) startWorkout({ name: "Quick Workout" });
    router.push("/workout");
  };
  const startToday = () => {
    if (program && today && !active) startFromProgramDay(program.id, today.id);
    router.push("/workout");
  };

  return (
    <div className="pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 pt-2">
        <div>
          <p className="text-sm font-medium text-muted">{greeting()},</p>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">{profile.name || "Athlete"}</h1>
        </div>
        <Link href="/profile" className="tap relative flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-lg font-bold">
          {(profile.name || "A").charAt(0).toUpperCase()}
          {user && (
            <span
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-bg ${
                syncStatus === "error" ? "bg-danger" : syncStatus === "syncing" ? "bg-warn" : "bg-accent"
              }`}
            />
          )}
        </Link>
      </div>

      {/* Today */}
      <Card className="relative mt-3 overflow-hidden border-accent/20 bg-gradient-to-br from-surface to-surface-2 p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
          <Zap className="h-3.5 w-3.5" /> Today&apos;s workout
        </div>
        {active ? (
          <>
            <h2 className="mt-2 text-2xl font-bold">{active.name}</h2>
            <p className="mt-1 text-sm text-muted">In progress · {active.exercises.length} exercises</p>
            <Button className="mt-4 w-full" size="lg" icon={<Play className="h-5 w-5" fill="currentColor" />} onClick={() => router.push("/workout")}>
              Resume workout
            </Button>
          </>
        ) : today ? (
          <>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-2xl font-bold">{today.name}</h2>
              {doneToday && <Badge>Done ✓</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {program?.name} · {today.exercises.length} exercises · ~{Math.round(today.exercises.reduce((a, e) => a + e.sets * (e.restSeconds + 45), 0) / 60)} min
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {today.exercises.slice(0, 4).map((e) => (
                <span key={e.id} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-fg/80">
                  {exMap.get(e.exerciseId)?.name ?? e.exerciseId}
                </span>
              ))}
              {today.exercises.length > 4 && <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-muted">+{today.exercises.length - 4}</span>}
            </div>
            <Button className="mt-4 w-full" size="lg" icon={<Play className="h-5 w-5" fill="currentColor" />} onClick={startToday}>
              {doneToday ? "Train again" : "Start workout"}
            </Button>
          </>
        ) : (
          <>
            <h2 className="mt-2 text-2xl font-bold">{program ? "Rest day" : "No program selected"}</h2>
            <p className="mt-1 text-sm text-muted">
              {program && next ? `Next: ${next.day.name} on ${next.weekday}` : program ? "Recover, stretch and hydrate." : "Pick a program or start a free workout."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button size="lg" icon={<Play className="h-5 w-5" fill="currentColor" />} onClick={quickStart}>
                Quick start
              </Button>
              <Button size="lg" variant="secondary" onClick={() => router.push("/programs")}>
                Programs
              </Button>
            </div>
          </>
        )}
      </Card>

      {(today || active) && (
        <Button variant="secondary" className="mt-2 w-full" icon={<Dumbbell className="h-4 w-4" />} onClick={quickStart}>
          {active ? "Go to workout" : "Quick start empty workout"}
        </Button>
      )}

      {!active && (
        <>
          <SectionTitle action={<Link href="/smart" className="text-sm font-semibold text-accent">Customize</Link>}>For you</SectionTitle>
          <SmartWorkoutCard />
        </>
      )}

      {/* Recovery */}
      <SectionTitle action={<Link href="/recovery" className="text-sm font-semibold text-accent">Details</Link>}>Muscle recovery</SectionTitle>
      <Link href="/recovery" className="tap flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
        <BodyMap colors={recoveryColors(recovery)} size="sm" className="h-32 w-28 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="text-[13px] font-medium text-muted">Readiness</div>
          <div className="text-[28px] font-extrabold leading-none" style={{ color: LEVEL_COLOR[recoveryLevel(overallRecovery)] }}>
            {overallRecovery}%
          </div>
          <div className="mt-2 text-xs text-muted">Fresh</div>
          <div className="truncate font-semibold">{freshest.map((m) => MUSCLE_INFO[m].label).join(", ")}</div>
          {sorest.length > 0 && (
            <>
              <div className="mt-1.5 text-xs text-muted">Recovering</div>
              <div className="truncate font-semibold text-warn">{sorest.map((m) => `${MUSCLE_INFO[m].label} ${recovery[m].recovery}%`).join(", ")}</div>
            </>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
      </Link>

      {/* Weekly stats */}
      <SectionTitle>This week</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="col-span-2 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-muted">Weekly goal</div>
              <div className="mt-1 text-[26px] font-bold leading-none">
                {week.length}
                <span className="text-base font-medium text-muted"> / {profile.weeklyGoal} workouts</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-bold text-accent">
              <Flame className="h-4 w-4" /> {streak} wk streak
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar value={week.length} max={profile.weeklyGoal} />
          </div>
        </Card>
        <Stat label="Volume" value={formatCompact(kgToDisplay(weekVolume, profile.units) ?? 0)} unit={profile.units} icon={<Dumbbell className="h-4 w-4" />} />
        <Stat label="Time trained" value={weekMinutes >= 60 ? (weekMinutes / 60).toFixed(1) : weekMinutes} unit={weekMinutes >= 60 ? "h" : "min"} icon={<Clock className="h-4 w-4" />} />
        <Stat label="Total workouts" value={workouts.length} icon={<Trophy className="h-4 w-4" />} sub={workouts[0] ? `Last: ${relativeDay(workouts[0].startedAt)}` : "No workouts yet"} />
        <Link href="/body" className="block">
          <Stat
            className="tap h-full"
            label="Body weight"
            value={weight ? (kgToDisplay(weight.value, profile.units) ?? 0).toFixed(1) : "—"}
            unit={weight ? profile.units : undefined}
            icon={<Scale className="h-4 w-4" />}
            sub={weight ? `Logged ${formatDate(weight.date)}` : "Tap to log"}
          />
        </Link>
      </div>

      {/* Activity chart */}
      <SectionTitle>Weekly activity</SectionTitle>
      <Card className="pb-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-semibold">Minutes trained</span>
          <span className="text-xs text-muted">Mon – Sun</span>
        </div>
        <BarsChart data={activity} x="label" y="minutes" unit="min" highlightKey="isToday" height={150} />
      </Card>

      {/* Personal records */}
      <SectionTitle action={<Link href="/progress?tab=records" className="text-sm font-semibold text-accent">See all</Link>}>
        Personal records
      </SectionTitle>
      {prs.length ? (
        <div className="grid grid-cols-2 gap-2.5">
          {prs.map((p) => (
            <Card key={p.exerciseId} className="p-4">
              <Trophy className="h-4 w-4 text-warn" />
              <div className="mt-2 truncate text-sm font-semibold">{exMap.get(p.exerciseId)?.name ?? p.exerciseId}</div>
              <div className="mt-0.5 text-lg font-bold">
                {formatWeight(p.bestWeight, profile.units)} <span className="text-sm font-medium text-muted">× {p.bestWeightReps}</span>
              </div>
              <div className="text-xs text-muted">{relativeDay(p.achievedAt)}</div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-sm text-muted">Complete a workout to start setting personal records.</Card>
      )}

      {/* Shortcuts */}
      <SectionTitle>Explore</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { href: "/nutrition", icon: Apple, label: "Nutrition", sub: `${Math.round(todayCalories)} / ${profile.nutritionGoals.calories} kcal` },
          { href: "/history", icon: History, label: "History", sub: `${workouts.length} sessions` },
          { href: "/exercises", icon: BookOpen, label: "Exercises", sub: "Library & guides" },
          { href: "/body", icon: Ruler, label: "Body", sub: `${body.length} entries` },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link key={href} href={href} className="tap flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{label}</div>
              <div className="truncate text-xs text-muted">{sub}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-subtle" />
          </Link>
        ))}
      </div>
    </div>
  );
}
