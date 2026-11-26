"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Copy, Link2, Play, Plus, Trash2, Unlink, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, SectionTitle, Spinner, TextArea } from "@/components/ui";
import { ExercisePicker } from "@/components/ExercisePicker";
import { useExerciseMap, useGym } from "@/lib/store";
import { programStats } from "@/lib/program-utils";
import { WEEKDAYS_LETTER, cn, relativeDay, uuid } from "@/lib/utils";
import { TECHNIQUES, type ProgramDay, type ProgramExercise, type Technique, type WorkoutProgram } from "@/lib/types";
import { TECHNIQUE_INFO, TEMPO_PRESETS, groupKind, groupLetters, normalizeGroups } from "@/lib/techniques";

export default function EditProgramPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <EditProgram />
    </Suspense>
  );
}

function EditProgram() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const program = useGym((s) => s.programs.find((p) => p.id === id));
  const activeId = useGym((s) => s.profile.activeProgramId);
  const workouts = useGym((s) => s.workouts);
  const saveProgram = useGym((s) => s.saveProgram);
  const deleteProgram = useGym((s) => s.deleteProgram);
  const duplicateProgram = useGym((s) => s.duplicateProgram);
  const setActiveProgram = useGym((s) => s.setActiveProgram);
  const startFromProgramDay = useGym((s) => s.startFromProgramDay);
  const hasActiveWorkout = useGym((s) => s.activeWorkout !== null);
  const exMap = useExerciseMap();

  const [draft, setDraft] = useState<WorkoutProgram | null>(program ?? null);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (program && (!draft || draft.id !== program.id)) setDraft(program);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id]);

  // Auto-save edits shortly after the user stops typing
  useEffect(() => {
    if (!dirty || !draft) return;
    const t = setTimeout(() => {
      saveProgram(draft);
      setDirty(false);
    }, 500);
    return () => clearTimeout(t);
  }, [draft, dirty, saveProgram]);

  if (!program || !draft) {
    return (
      <div>
        <PageHeader title="Program" back="/programs" large={false} />
        <EmptyState icon={<X className="h-6 w-6" />} title="Program not found" description="It may have been deleted." />
      </div>
    );
  }

  const stats = programStats(program, workouts);
  const isActive = activeId === program.id;

  const update = (fn: (p: WorkoutProgram) => WorkoutProgram) => {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
  };
  const updateDay = (dayId: string, fn: (d: ProgramDay) => ProgramDay) =>
    update((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? fn(d) : d)) }));

  const updatePe = (dayId: string, peId: string, patch: Partial<ProgramDay["exercises"][number]>) =>
    updateDay(dayId, (d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === peId ? { ...x, ...patch } : x)) }));

  /** Link exercise ei with ei+1 into a superset (or unlink them). */
  const toggleLink = (dayId: string, ei: number) =>
    updateDay(dayId, (d) => {
      const list = [...d.exercises];
      const a = list[ei];
      const b = list[ei + 1];
      if (!a || !b) return d;
      if (a.groupId && a.groupId === b.groupId) {
        // split the group at this point: everything after ei gets a new group (or none)
        const gid = a.groupId;
        const fresh = uuid();
        for (let k = ei + 1; k < list.length && list[k].groupId === gid; k++) list[k] = { ...list[k], groupId: fresh };
      } else {
        const gid = a.groupId ?? b.groupId ?? uuid();
        const old = b.groupId;
        for (let k = 0; k < list.length; k++) if (k === ei || k === ei + 1 || (old && list[k].groupId === old)) list[k] = { ...list[k], groupId: gid };
      }
      return { ...d, exercises: normalizeGroups(list) };
    });

  const flush = () => {
    if (dirty) {
      saveProgram(draft);
      setDirty(false);
    }
  };

  const startDay = (dayId: string) => {
    flush();
    if (hasActiveWorkout && !confirm("You already have a workout in progress. Replace it?")) return;
    saveProgram(draft);
    startFromProgramDay(program.id, dayId);
    router.push("/workout");
  };

  return (
    <div>
      <PageHeader
        title={draft.name || "Untitled program"}
        back="/programs"
        large={false}
        action={
          <span className="flex items-center gap-1 text-xs text-muted">
            {dirty ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5 text-accent" />}
            {dirty ? "Saving" : "Saved"}
          </span>
        }
      />

      <div className="space-y-3">
        <Field label="Program name">
          <Input value={draft.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Description">
          <TextArea value={draft.description} onChange={(e) => update((p) => ({ ...p, description: e.target.value }))} className="min-h-16" />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant={isActive ? "secondary" : "primary"}
          icon={isActive ? <Check className="h-4 w-4" /> : undefined}
          onClick={() => setActiveProgram(isActive ? null : program.id)}
        >
          {isActive ? "Active program" : "Set as active"}
        </Button>
        <Button
          variant="secondary"
          icon={<Copy className="h-4 w-4" />}
          onClick={() => {
            flush();
            const nid = duplicateProgram(program.id);
            if (nid) router.replace(`/programs/edit?id=${nid}`);
          }}
        >
          Duplicate
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        {stats.total} completed sessions{stats.last ? ` · last ${relativeDay(stats.last).toLowerCase()}` : ""}
      </p>

      {draft.days.map((day, di) => {
        const dayStats = stats.perDay.get(day.id);
        return (
          <div key={day.id}>
            <SectionTitle
              action={
                <div className="flex gap-1">
                  <IconButton label="Move day up" className="h-8 w-8" disabled={di === 0} onClick={() => update((p) => ({ ...p, days: swap(p.days, di, di - 1) }))}>
                    <ArrowUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Move day down" className="h-8 w-8" disabled={di === draft.days.length - 1} onClick={() => update((p) => ({ ...p, days: swap(p.days, di, di + 1) }))}>
                    <ArrowDown className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label="Delete day"
                    className="h-8 w-8 text-danger"
                    onClick={() => confirm(`Delete "${day.name}"?`) && update((p) => ({ ...p, days: p.days.filter((d) => d.id !== day.id) }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              }
            >
              Day {di + 1}
            </SectionTitle>
            <Card className="p-0">
              <div className="p-4 pb-3">
                <input
                  value={day.name}
                  onChange={(e) => updateDay(day.id, (d) => ({ ...d, name: e.target.value }))}
                  className="w-full bg-transparent text-lg font-bold outline-none"
                  aria-label="Day name"
                />
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  {dayStats?.count ? <Badge>{dayStats.count}× completed</Badge> : <span>Not completed yet</span>}
                  {dayStats?.last && <span>Last {relativeDay(dayStats.last).toLowerCase()}</span>}
                </div>
                <div className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                    const on = day.weekdays.includes(wd);
                    return (
                      <button
                        key={wd}
                        onClick={() =>
                          updateDay(day.id, (d) => ({ ...d, weekdays: on ? d.weekdays.filter((x) => x !== wd) : [...d.weekdays, wd] }))
                        }
                        className={cn(
                          "tap flex h-9 flex-1 items-center justify-center rounded-xl text-xs font-bold",
                          on ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
                        )}
                        aria-pressed={on}
                      >
                        {WEEKDAYS_LETTER[wd]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-line">
                {day.exercises.map((pe, ei) => {
                  const letters = groupLetters(day.exercises);
                  const size = pe.groupId ? day.exercises.filter((x) => x.groupId === pe.groupId).length : 0;
                  const next = day.exercises[ei + 1];
                  const linked = !!pe.groupId && next?.groupId === pe.groupId;
                  return (
                  <div key={pe.id}>
                  <div className={cn("border-b border-line px-4 py-3", pe.groupId && "border-l-4 border-l-info bg-info/5")}>
                    {pe.groupId && (ei === 0 || day.exercises[ei - 1].groupId !== pe.groupId) && (
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-info">
                        {groupKind(size)} {letters.get(pe.groupId)}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{exMap.get(pe.exerciseId)?.name ?? pe.exerciseId}</div>
                      <IconButton label="Move up" className="h-8 w-8 bg-transparent text-subtle" disabled={ei === 0} onClick={() => updateDay(day.id, (d) => ({ ...d, exercises: normalizeGroups(swap(d.exercises, ei, ei - 1)) }))}>
                        <ArrowUp className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Move down" className="h-8 w-8 bg-transparent text-subtle" disabled={ei === day.exercises.length - 1} onClick={() => updateDay(day.id, (d) => ({ ...d, exercises: normalizeGroups(swap(d.exercises, ei, ei + 1)) }))}>
                        <ArrowDown className="h-4 w-4" />
                      </IconButton>
                    <IconButton label="Remove exercise" className="h-8 w-8 text-danger" onClick={() => updateDay(day.id, (d) => ({ ...d, exercises: normalizeGroups(d.exercises.filter((x) => x.id !== pe.id)) }))}>
                      <X className="h-4 w-4" />
                    </IconButton>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <MiniField label="Sets">
                        <input
                          aria-label="Sets"
                          inputMode="numeric"
                          value={pe.sets}
                          onChange={(e) => updatePe(day.id, pe.id, { sets: Math.min(20, parseInt(e.target.value, 10) || 0) })}
                          className={miniInput}
                        />
                      </MiniField>
                      <MiniField label="Reps">
                        <input aria-label="Reps" value={pe.reps} onChange={(e) => updatePe(day.id, pe.id, { reps: e.target.value })} className={miniInput} />
                      </MiniField>
                      <MiniField label="Rest">
                        <select aria-label="Rest" value={pe.restSeconds} onChange={(e) => updatePe(day.id, pe.id, { restSeconds: Number(e.target.value) })} className={miniInput}>
                          {[0, 30, 45, 60, 90, 120, 150, 180, 240, 300].map((r) => (
                            <option key={r} value={r}>{r ? `${r}s` : "Off"}</option>
                          ))}
                        </select>
                      </MiniField>
                    </div>
                    <div className={cn("mt-2 grid gap-2", pe.technique === "tempo" ? "grid-cols-2" : "grid-cols-1")}>
                      <MiniField label="Technique">
                        <select
                          aria-label="Technique"
                          value={pe.technique ?? "standard"}
                          onChange={(e) => {
                            const t = e.target.value as Technique;
                            updatePe(day.id, pe.id, { technique: t, tempo: t === "tempo" ? (pe.tempo ?? "3-1-1-0") : undefined });
                          }}
                          className={miniInput}
                        >
                          {TECHNIQUES.map((t) => (
                            <option key={t} value={t}>{TECHNIQUE_INFO[t].short}</option>
                          ))}
                        </select>
                      </MiniField>
                      {pe.technique === "tempo" && (
                        <MiniField label="Tempo">
                          <select aria-label="Tempo" value={pe.tempo ?? "3-1-1-0"} onChange={(e) => updatePe(day.id, pe.id, { tempo: e.target.value })} className={miniInput}>
                            {TEMPO_PRESETS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </MiniField>
                      )}
                    </div>
                  </div>
                  {next && (
                    <button
                      onClick={() => toggleLink(day.id, ei)}
                      className={cn(
                        "tap flex w-full items-center justify-center gap-1.5 border-b border-line py-1.5 text-[11px] font-semibold",
                        linked ? "bg-info/10 text-info" : "text-subtle",
                      )}
                      aria-pressed={linked}
                      aria-label={linked ? "Unlink superset" : "Link as superset"}
                    >
                      {linked ? <Unlink className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                      {linked ? "Linked — tap to unlink" : "Link with next as superset"}
                    </button>
                  )}
                  </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setPickerDay(day.id)}>
                  Add exercise
                </Button>
                <Button size="sm" icon={<Play className="h-4 w-4" fill="currentColor" />} disabled={!day.exercises.length} onClick={() => startDay(day.id)}>
                  Start
                </Button>
              </div>
            </Card>
          </div>
        );
      })}

      <button
        onClick={() => update((p) => ({ ...p, days: [...p.days, { id: uuid(), name: `Day ${p.days.length + 1}`, weekdays: [], exercises: [] }] }))}
        className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line py-5 text-sm font-semibold text-muted"
      >
        <Plus className="h-4 w-4" /> Add day
      </button>

      <Button
        variant="danger"
        className="mt-6 w-full"
        icon={<Trash2 className="h-4 w-4" />}
        onClick={() => {
          if (confirm(`Delete "${program.name}"? Workout history is kept.`)) {
            deleteProgram(program.id);
            router.replace("/programs");
          }
        }}
      >
        Delete program
      </Button>

      <ExercisePicker
        open={pickerDay !== null}
        onClose={() => setPickerDay(null)}
        onPick={(ids) => {
          const dayId = pickerDay;
          if (!dayId) return;
          updateDay(dayId, (d) => ({
            ...d,
            exercises: [
              ...d.exercises,
              ...ids.map((exerciseId) => {
                const ex = exMap.get(exerciseId);
                const pe: ProgramExercise = { id: uuid(), exerciseId, sets: ex?.recommendedSets ?? 3, reps: ex?.recommendedReps ?? "8-12", restSeconds: 90 };
                return pe;
              }),
            ],
          }));
        }}
      />
    </div>
  );
}

const miniInput = "h-10 w-full appearance-none rounded-xl bg-surface-2 text-center text-[15px] font-semibold text-fg outline-none focus:ring-2 focus:ring-accent/50";

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</div>
      {children}
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
