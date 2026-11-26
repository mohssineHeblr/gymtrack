"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { BodyMap } from "@/components/BodyMap";
import { Button, Card, PageHeader, SectionTitle, Segmented } from "@/components/ui";
import { MUSCLES, MUSCLE_INFO, type Muscle } from "@/data/muscles";
import { LEVEL_COLOR, LEVEL_LABEL, recoveryLevel, weeklySetsPerMuscle, type RecoveryLevel } from "@/lib/recovery";
import { recoveryColors, useRecovery } from "@/lib/use-recovery";
import { useExerciseMap, useGym } from "@/lib/store";
import { relativeDay } from "@/lib/utils";

const LEVELS: RecoveryLevel[] = ["fresh", "ready", "recovering", "fatigued"];
/** Evidence-based hypertrophy range: ~10–20 hard sets per muscle per week */
const SET_TARGET: [number, number] = [10, 20];

export default function RecoveryPage() {
  const recovery = useRecovery();
  const workouts = useGym((s) => s.workouts);
  const exMap = useExerciseMap();
  const [sort, setSort] = useState<"recovery" | "volume">("recovery");
  const colors = recoveryColors(recovery);
  const weekly = useMemo(() => weeklySetsPerMuscle(workouts, (id) => exMap.get(id)), [workouts, exMap]);

  const overall = Math.round(MUSCLES.reduce((a, m) => a + recovery[m].recovery, 0) / MUSCLES.length);
  const list = [...MUSCLES].sort((a, b) =>
    sort === "recovery" ? recovery[a].recovery - recovery[b].recovery : weekly[b] - weekly[a],
  );

  return (
    <div>
      <PageHeader title="Muscle Recovery" back />

      <Card className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[13px] font-medium text-muted">Overall readiness</div>
            <div className="mt-1 text-[34px] font-extrabold leading-none" style={{ color: LEVEL_COLOR[recoveryLevel(overall)] }}>
              {overall}%
            </div>
          </div>
          <Link href="/smart">
            <Button size="sm" icon={<Sparkles className="h-4 w-4" />}>
              Smart workout
            </Button>
          </Link>
        </div>
        <BodyMap colors={colors} className="mt-3" />
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {LEVELS.map((l) => (
            <span key={l} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
              {LEVEL_LABEL[l]}
            </span>
          ))}
        </div>
      </Card>

      <SectionTitle>Muscles</SectionTitle>
      <Segmented
        value={sort}
        onChange={setSort}
        options={[
          { value: "recovery", label: "By recovery" },
          { value: "volume", label: "Sets this week" },
        ]}
        className="mb-2.5"
      />
      <Card className="divide-y divide-line p-0">
        {list.map((m) => (
          <MuscleRow key={m} muscle={m} recovery={recovery[m].recovery} hoursLeft={recovery[m].hoursLeft} last={recovery[m].lastTrained} sets={weekly[m]} />
        ))}
      </Card>
      <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
        Recovery is estimated from the hard sets you logged in the last few days. Large muscles take ~72 h to recover, smaller ones 36–48 h.
        For muscle growth, aim for roughly {SET_TARGET[0]}–{SET_TARGET[1]} weekly sets per muscle (secondary muscles count as half a set).
      </p>
    </div>
  );
}

function MuscleRow({ muscle, recovery, hoursLeft, last, sets }: { muscle: Muscle; recovery: number; hoursLeft: number; last: string | null; sets: number }) {
  const level = recoveryLevel(recovery);
  const setsLabel = Math.round(sets * 10) / 10;
  const volumeTone = sets >= SET_TARGET[1] ? "text-warn" : sets >= SET_TARGET[0] ? "text-accent" : "text-muted";
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{MUSCLE_INFO[muscle].label}</span>
          <span className="text-sm font-bold tabular-nums">{recovery}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full transition-all" style={{ width: `${recovery}%`, background: LEVEL_COLOR[level] }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>
            {LEVEL_LABEL[level]}
            {hoursLeft > 0 && ` · ready in ~${hoursLeft} h`}
            {last && ` · trained ${relativeDay(last).toLowerCase()}`}
          </span>
          <span className={volumeTone}>{setLabel(setsLabel)}</span>
        </div>
      </div>
    </div>
  );
}

const setLabel = (n: number) => `${n} set${n === 1 ? "" : "s"} / wk`;
