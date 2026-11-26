"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, ChevronRight, Plus } from "lucide-react";
import { Badge, Card, IconButton, PageHeader, SectionTitle } from "@/components/ui";
import { useGym } from "@/lib/store";
import { programStats } from "@/lib/program-utils";
import { WEEKDAYS_LETTER, cn, relativeDay } from "@/lib/utils";
import type { WorkoutProgram } from "@/lib/types";

export default function ProgramsPage() {
  const router = useRouter();
  const programs = useGym((s) => s.programs);
  const activeId = useGym((s) => s.profile.activeProgramId);
  const createProgram = useGym((s) => s.createProgram);

  const active = programs.find((p) => p.id === activeId);
  const custom = programs.filter((p) => !p.isPreset && p.id !== activeId);
  const presets = programs.filter((p) => p.isPreset && p.id !== activeId);

  return (
    <div>
      <PageHeader
        title="Programs"
        subtitle="Structured routines scheduled by day"
        action={
          <IconButton
            label="Create program"
            className="bg-accent text-accent-ink"
            onClick={() => router.push(`/programs/edit?id=${createProgram()}`)}
          >
            <Plus className="h-5 w-5" />
          </IconButton>
        }
      />

      {active && (
        <>
          <SectionTitle>Active program</SectionTitle>
          <ProgramCard program={active} active />
        </>
      )}

      {custom.length > 0 && (
        <>
          <SectionTitle>My programs</SectionTitle>
          <div className="space-y-2.5">
            {custom.map((p) => <ProgramCard key={p.id} program={p} />)}
          </div>
        </>
      )}

      <SectionTitle>Templates</SectionTitle>
      <div className="space-y-2.5">
        {presets.map((p) => <ProgramCard key={p.id} program={p} />)}
      </div>

      <button
        onClick={() => router.push(`/programs/edit?id=${createProgram()}`)}
        className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line py-5 text-sm font-semibold text-muted"
      >
        <Plus className="h-4 w-4" /> Create custom program
      </button>
    </div>
  );
}

function ProgramCard({ program, active }: { program: WorkoutProgram; active?: boolean }) {
  const workouts = useGym((s) => s.workouts);
  const stats = programStats(program, workouts);
  const scheduled = new Set(program.days.flatMap((d) => d.weekdays));
  const todayWd = new Date().getDay();

  return (
    <Link href={`/programs/edit?id=${program.id}`} className="block">
      <Card className={cn("tap", active && "border-accent/40 bg-gradient-to-br from-surface to-surface-2")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[17px] font-bold">{program.name}</h3>
              {active && (
                <Badge>
                  <Check className="mr-0.5 h-3 w-3" /> Active
                </Badge>
              )}
              {program.isPreset && !active && <Badge className="bg-surface-3 text-muted">Template</Badge>}
            </div>
            {program.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{program.description}</p>}
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-subtle" />
        </div>
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <span
              key={wd}
              className={cn(
                "flex h-7 flex-1 items-center justify-center rounded-lg text-[11px] font-bold",
                scheduled.has(wd) ? "bg-accent-soft text-accent" : "bg-surface-2 text-subtle",
                wd === todayWd && "ring-1 ring-fg/40",
              )}
            >
              {WEEKDAYS_LETTER[wd]}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span>{program.days.length} days</span>
          <span className="flex items-center gap-1">
            <CalendarCheck className="h-3.5 w-3.5" /> {stats.total} sessions completed
          </span>
          {stats.last && <span>Last {relativeDay(stats.last).toLowerCase()}</span>}
        </div>
      </Card>
    </Link>
  );
}
