"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Button, Chip, Field, IconButton, Input, PageHeader, Select, Sheet, TextArea } from "@/components/ui";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { filterExercises } from "@/components/ExercisePicker";
import { useExercises, useGym } from "@/lib/store";
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from "@/lib/types";

export default function ExercisesPage() {
  const all = useExercises();
  const deleteCustomExercise = useGym((s) => s.deleteCustomExercise);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "All">("All");
  const [equipment, setEquipment] = useState<string>("All");
  const [detail, setDetail] = useState<string | null>(null);
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);

  const list = useMemo(() => filterExercises(all, query, group, equipment), [all, query, group, equipment]);
  const grouped = useMemo(() => {
    const m = new Map<string, Exercise[]>();
    for (const e of list) m.set(e.muscleGroup, [...(m.get(e.muscleGroup) ?? []), e]);
    return MUSCLE_GROUPS.filter((g) => m.has(g)).map((g) => [g, m.get(g)!] as const);
  }, [list]);

  const detailEx = detail ? all.find((e) => e.id === detail) : undefined;

  return (
    <div>
      <PageHeader
        title="Exercises"
        subtitle={`${all.length} exercises`}
        back
        action={
          <IconButton label="New exercise" className="bg-accent text-accent-ink" onClick={() => setEditing("new")}>
            <Plus className="h-5 w-5" />
          </IconButton>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, muscle or equipment" className="pl-10" />
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {(["All", ...MUSCLE_GROUPS] as const).map((g) => (
          <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
            {g}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
        {["All", ...EQUIPMENT].map((e) => (
          <Chip key={e} active={equipment === e} onClick={() => setEquipment(e)} className="py-1 text-xs">
            {e === "All" ? "All equipment" : e}
          </Chip>
        ))}
      </div>

      <div className="mt-4 space-y-5">
        {grouped.map(([g, items]) => (
          <section key={g}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-muted">
              {g} <span className="text-subtle">· {items.length}</span>
            </h2>
            <div className="overflow-hidden rounded-3xl border border-line bg-surface">
              {items.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => setDetail(e.id)}
                  className={`tap flex w-full items-center gap-3 px-4 py-3 text-left ${i ? "border-t border-line" : ""}`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-xs font-bold text-accent">
                    {e.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{e.name}</div>
                    <div className="text-xs text-muted">
                      {e.equipment} · {e.recommendedSets}×{e.recommendedReps}
                      {e.isCustom && " · Custom"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-subtle" />
                </button>
              ))}
            </div>
          </section>
        ))}
        {!grouped.length && <p className="py-16 text-center text-sm text-muted">No exercises found.</p>}
      </div>

      <ExerciseDetail
        exerciseId={detail}
        onClose={() => setDetail(null)}
        onEdit={detailEx?.isCustom ? () => { setEditing(detailEx); setDetail(null); } : undefined}
        onDelete={
          detailEx?.isCustom
            ? () => {
                if (confirm(`Delete "${detailEx.name}"?`)) {
                  deleteCustomExercise(detailEx.id);
                  setDetail(null);
                }
              }
            : undefined
        }
      />
      <ExerciseForm value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ExerciseForm({ value, onClose }: { value: Exercise | "new" | null; onClose: () => void }) {
  const addCustomExercise = useGym((s) => s.addCustomExercise);
  const updateCustomExercise = useGym((s) => s.updateCustomExercise);
  const open = value !== null;
  const initial = value && value !== "new" ? value : null;
  const [key, setKey] = useState(0);

  return (
    <Sheet open={open} onClose={() => { onClose(); setKey((k) => k + 1); }} title={initial ? "Edit exercise" : "New exercise"}>
      {open && (
        <ExerciseFormInner
          key={`${initial?.id ?? "new"}-${key}`}
          initial={initial}
          onSave={(data) => {
            if (initial) updateCustomExercise(initial.id, data);
            else addCustomExercise(data);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function ExerciseFormInner({
  initial,
  onSave,
}: {
  initial: Exercise | null;
  onSave: (e: Omit<Exercise, "id" | "isCustom" | "updatedAt">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(initial?.muscleGroup ?? "Chest");
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? "Barbell");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions.join("\n") ?? "");
  const [sets, setSets] = useState(String(initial?.recommendedSets ?? 3));
  const [reps, setReps] = useState(initial?.recommendedReps ?? "8-12");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          muscleGroup,
          equipment,
          description: description.trim(),
          instructions: instructions.split("\n").map((s) => s.trim()).filter(Boolean),
          recommendedSets: Math.max(1, parseInt(sets, 10) || 3),
          recommendedReps: reps.trim() || "8-12",
        });
      }}
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pendlay Row" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Muscle group">
          <Select value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
            {MUSCLE_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </Select>
        </Field>
        <Field label="Equipment">
          <Select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((g) => <option key={g}>{g}</option>)}
          </Select>
        </Field>
        <Field label="Sets">
          <Input inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </Field>
        <Field label="Reps">
          <Input value={reps} onChange={(e) => setReps(e.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this exercise target?" />
      </Field>
      <Field label="Instructions" hint="One step per line">
        <TextArea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-32" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={!name.trim()}>
        Save exercise
      </Button>
    </form>
  );
}
