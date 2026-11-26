"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, History, LineChart, Ruler, Trophy } from "lucide-react";
import { Card, EmptyState, PageHeader, Segmented, Select, Spinner, Stat, Button } from "@/components/ui";
import { BarsChart, TrendChart } from "@/components/charts";
import { useExerciseMap, useGym } from "@/lib/store";
import { computePRs, exerciseProgression, latestMeasurement, weeklyTrend, workoutDurationSec, workoutVolume } from "@/lib/stats";
import { formatCompact, formatDate, formatWeight, kgToDisplay, relativeDay } from "@/lib/utils";

type Tab = "overview" | "strength" | "records" | "body";

export default function ProgressPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <Progress />
    </Suspense>
  );
}

function Progress() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "overview";
  const workouts = useGym((s) => s.workouts);
  const setTab = (t: Tab) => router.replace(`/progress?tab=${t}`, { scroll: false });

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="Your training at a glance"
        action={
          <Link href="/history" className="tap flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm font-semibold">
            <History className="h-4 w-4" /> History
          </Link>
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "strength", label: "Strength" },
          { value: "records", label: "PRs" },
          { value: "body", label: "Body" },
        ]}
      />
      <div className="mt-4">
        {!workouts.length && tab !== "body" ? (
          <EmptyState
            icon={<LineChart className="h-6 w-6" />}
            title="No data yet"
            description="Complete your first workout to unlock progress charts."
            action={<Link href="/workout"><Button>Start a workout</Button></Link>}
          />
        ) : tab === "overview" ? (
          <Overview />
        ) : tab === "strength" ? (
          <Strength />
        ) : tab === "records" ? (
          <Records />
        ) : (
          <BodyTab />
        )}
      </div>
    </div>
  );
}

function Overview() {
  const workouts = useGym((s) => s.workouts);
  const units = useGym((s) => s.profile.units);
  const trend = useMemo(
    () => weeklyTrend(workouts, 12).map((w) => ({ ...w, volume: kgToDisplay(w.volume, units) ?? 0 })),
    [workouts, units],
  );
  const totalVolume = workouts.reduce((a, w) => a + workoutVolume(w), 0);
  const avgDuration = workouts.length ? workouts.reduce((a, w) => a + workoutDurationSec(w), 0) / workouts.length / 60 : 0;
  const last30 = workouts.filter((w) => Date.now() - new Date(w.startedAt).getTime() < 30 * 86_400_000).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Total volume" value={formatCompact(kgToDisplay(totalVolume, units) ?? 0)} unit={units} />
        <Stat label="Workouts" value={workouts.length} sub={`${last30} in last 30 days`} />
        <Stat label="Avg duration" value={Math.round(avgDuration)} unit="min" />
        <Stat label="Per week" value={(last30 / (30 / 7)).toFixed(1)} sub="last 30 days" />
      </div>
      <Card>
        <div className="mb-1 text-sm font-semibold">Training frequency</div>
        <div className="mb-2 text-xs text-muted">Workouts per week · last 12 weeks</div>
        <BarsChart data={trend} x="label" y="workouts" unit="workouts" height={170} />
      </Card>
      <Card>
        <div className="mb-1 text-sm font-semibold">Total volume lifted</div>
        <div className="mb-2 text-xs text-muted">Weight × reps per week ({units})</div>
        <TrendChart id="vol" data={trend} x="label" y="volume" unit={units} formatter={formatCompact} domain={[0, "auto"]} />
      </Card>
    </div>
  );
}

function Strength() {
  const workouts = useGym((s) => s.workouts);
  const units = useGym((s) => s.profile.units);
  const exMap = useExerciseMap();
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of workouts) for (const we of w.exercises) counts.set(we.exerciseId, (counts.get(we.exerciseId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n, name: exMap.get(id)?.name ?? id }));
  }, [workouts, exMap]);
  const [selected, setSelected] = useState<string>(options[0]?.id ?? "");
  const data = useMemo(
    () =>
      exerciseProgression(workouts, selected).map((p) => ({
        ...p,
        e1rm: kgToDisplay(p.e1rm, units) ?? 0,
        topWeight: kgToDisplay(p.topWeight, units) ?? 0,
      })),
    [workouts, selected, units],
  );
  const first = data[0];
  const last = data[data.length - 1];
  const change = first && last && first.e1rm ? ((last.e1rm - first.e1rm) / first.e1rm) * 100 : 0;

  return (
    <div className="space-y-3">
      <Select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Exercise">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.n})
          </option>
        ))}
      </Select>
      {data.length ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Est. 1RM" value={last.e1rm} unit={units} />
            <Stat label="Top set" value={last.topWeight} unit={units} />
            <Stat label="Change" value={`${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} />
          </div>
          <Card>
            <div className="mb-1 text-sm font-semibold">Estimated one-rep max</div>
            <div className="mb-2 text-xs text-muted">Epley formula · best set per session</div>
            <TrendChart id="e1rm" data={data} x="label" y="e1rm" unit={units} />
          </Card>
          <Card>
            <div className="mb-1 text-sm font-semibold">Heaviest weight</div>
            <div className="mb-2 text-xs text-muted">Top working set per session</div>
            <TrendChart id="top" data={data} x="label" y="topWeight" unit={units} color="var(--info)" />
          </Card>
        </>
      ) : (
        <Card className="text-sm text-muted">No data for this exercise yet.</Card>
      )}
    </div>
  );
}

function Records() {
  const workouts = useGym((s) => s.workouts);
  const units = useGym((s) => s.profile.units);
  const exMap = useExerciseMap();
  const prs = useMemo(
    () => [...computePRs(workouts).values()].sort((a, b) => (exMap.get(a.exerciseId)?.name ?? "").localeCompare(exMap.get(b.exerciseId)?.name ?? "")),
    [workouts, exMap],
  );
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      {prs.map((p, i) => (
        <Link key={p.exerciseId} href={`/history/view?id=${p.workoutId}`} className={`tap flex items-center gap-3 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warn/15 text-warn">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{exMap.get(p.exerciseId)?.name ?? p.exerciseId}</div>
            <div className="text-xs text-muted">
              e1RM {formatWeight(p.bestE1rm, units)} · max {p.maxReps} reps · {relativeDay(p.achievedAt)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold">{p.bestWeight ? formatWeight(p.bestWeight, units) : "BW"}</div>
            <div className="text-xs text-muted">× {p.bestWeightReps}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function BodyTab() {
  const body = useGym((s) => s.body);
  const units = useGym((s) => s.profile.units);
  const target = useGym((s) => s.profile.targetWeight);
  const data = body.filter((b) => b.weight != null).map((b) => ({ label: formatDate(b.date), weight: kgToDisplay(b.weight, units) }));
  const latest = latestMeasurement(body, "weight");
  return (
    <div className="space-y-3">
      {data.length ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Current" value={latest ? (kgToDisplay(latest.value, units) ?? 0).toFixed(1) : "—"} unit={units} />
            <Stat label="Goal" value={target ? (kgToDisplay(target, units) ?? 0).toFixed(1) : "—"} unit={target ? units : undefined} sub={target ? undefined : "Set in Profile"} />
          </div>
          <Card>
            <div className="mb-2 text-sm font-semibold">Body weight</div>
            <TrendChart id="bw" data={data} x="label" y="weight" unit={units} />
          </Card>
        </>
      ) : (
        <EmptyState icon={<Ruler className="h-6 w-6" />} title="No body data" description="Log your weight and measurements to see trends." />
      )}
      <Link href="/body" className="tap flex items-center justify-between rounded-3xl border border-line bg-surface p-4 font-semibold">
        <span className="flex items-center gap-2"><Ruler className="h-5 w-5 text-accent" /> Body measurements</span>
        <ChevronRight className="h-4 w-4 text-subtle" />
      </Link>
    </div>
  );
}
