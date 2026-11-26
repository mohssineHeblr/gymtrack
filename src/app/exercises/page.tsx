"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronRight, ImagePlus, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, Chip, Field, IconButton, Input, PageHeader, Select, Sheet, TextArea } from "@/components/ui";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { ExerciseThumb } from "@/components/ExerciseThumb";
import { filterExercises, type ExerciseFilters } from "@/components/ExercisePicker";
import { nameKey, useExercises, useGym } from "@/lib/store";
import { compressImage } from "@/lib/image";
import { MUSCLES, MUSCLE_INFO, type Muscle } from "@/data/muscles";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  EQUIPMENT,
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABEL,
  MUSCLE_GROUPS,
  type Difficulty,
  type Equipment,
  type Exercise,
  type ExerciseType,
  type MuscleGroup,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_FILTERS: ExerciseFilters = { group: "All", equipment: "All", type: "All", difficulty: "All" };

export default function ExercisesPage() {
  const all = useExercises();
  const deleteCustomExercise = useGym((s) => s.deleteCustomExercise);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ExerciseFilters>(NO_FILTERS);
  const [moreFilters, setMoreFilters] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);

  const list = useMemo(() => filterExercises(all, query, filters), [all, query, filters]);
  const grouped = useMemo(() => {
    const m = new Map<string, Exercise[]>();
    for (const e of list) m.set(e.muscleGroup, [...(m.get(e.muscleGroup) ?? []), e]);
    return MUSCLE_GROUPS.filter((g) => m.has(g)).map((g) => [g, m.get(g)!] as const);
  }, [list]);

  const detailEx = detail ? all.find((e) => e.id === detail) : undefined;
  const extraCount = [filters.equipment, filters.type, filters.difficulty].filter((x) => x !== "All").length;
  const setF = (patch: Partial<ExerciseFilters>) => setFilters((f) => ({ ...f, ...patch }));

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

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, muscle or equipment" className="pl-10" />
        </div>
        <button
          onClick={() => setMoreFilters((v) => !v)}
          aria-label="More filters"
          aria-expanded={moreFilters}
          className={cn("tap relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", moreFilters || extraCount ? "bg-accent text-accent-ink" : "bg-surface")}
        >
          <SlidersHorizontal className="h-5 w-5" />
          {extraCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-fg text-[11px] font-bold text-bg">{extraCount}</span>}
        </button>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {(["All", ...MUSCLE_GROUPS] as const).map((g) => (
          <Chip key={g} active={filters.group === g} onClick={() => setF({ group: g })}>
            {g}
          </Chip>
        ))}
      </div>

      {moreFilters && (
        <div className="mt-3 space-y-3 rounded-3xl border border-line bg-surface p-4">
          <FilterRow label="Equipment" value={filters.equipment} options={["All", ...EQUIPMENT]} onChange={(v) => setF({ equipment: v })} />
          <FilterRow
            label="Type"
            value={filters.type}
            options={["All", ...EXERCISE_TYPES]}
            format={(v) => (v === "All" ? "All" : EXERCISE_TYPE_LABEL[v as ExerciseType])}
            onChange={(v) => setF({ type: v as ExerciseFilters["type"] })}
          />
          <FilterRow
            label="Difficulty"
            value={filters.difficulty}
            options={["All", ...DIFFICULTIES]}
            format={(v) => (v === "All" ? "All" : DIFFICULTY_LABEL[v as Difficulty])}
            onChange={(v) => setF({ difficulty: v as ExerciseFilters["difficulty"] })}
          />
          {extraCount > 0 && (
            <button onClick={() => setF({ equipment: "All", type: "All", difficulty: "All" })} className="text-sm font-semibold text-accent">
              Clear filters
            </button>
          )}
        </div>
      )}

      <p className="mt-3 px-1 text-xs text-muted">{list.length} shown</p>

      <div className="mt-2 space-y-5">
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
                  <ExerciseThumb exercise={e} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{e.name}</div>
                    <div className="truncate text-xs text-muted">
                      {e.equipment} · {e.type ? EXERCISE_TYPE_LABEL[e.type] : ""}
                      {e.difficulty ? ` · ${DIFFICULTY_LABEL[e.difficulty]}` : ""}
                      {e.isCustom && " · Custom"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-subtle" />
                </button>
              ))}
            </div>
          </section>
        ))}
        {!grouped.length && (
          <div className="py-16 text-center text-sm text-muted">
            No exercises found.
            <button
              onClick={() => {
                setFilters(NO_FILTERS);
                setQuery("");
              }}
              className="mt-2 block w-full font-semibold text-accent"
            >
              Reset search
            </button>
          </div>
        )}
      </div>

      <ExerciseDetail
        exerciseId={detail}
        onClose={() => setDetail(null)}
        onEdit={detailEx?.isCustom ? () => { setEditing(detailEx); setDetail(null); } : undefined}
        onDelete={
          detailEx?.isCustom
            ? () => {
                if (confirm(`Delete "${detailEx.name}"? Past workouts that used it keep their history.`)) {
                  deleteCustomExercise(detailEx.id);
                  setDetail(null);
                }
              }
            : undefined
        }
      />
      <ExerciseForm value={editing} onClose={() => setEditing(null)} onOpenExisting={(id) => { setEditing(null); setDetail(id); }} />
    </div>
  );
}

function FilterRow<T extends string>({ label, value, options, onChange, format }: { label: string; value: T; options: T[]; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-subtle">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onChange(o)} className="py-1 text-xs">
            {format ? format(o) : o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function ExerciseForm({ value, onClose, onOpenExisting }: { value: Exercise | "new" | null; onClose: () => void; onOpenExisting: (id: string) => void }) {
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
          onOpenExisting={onOpenExisting}
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
  onOpenExisting,
}: {
  initial: Exercise | null;
  onSave: (e: Omit<Exercise, "id" | "isCustom" | "updatedAt">) => void;
  onOpenExisting: (id: string) => void;
}) {
  const all = useExercises();
  const [name, setName] = useState(initial?.name ?? "");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(initial?.muscleGroup ?? "Chest");
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? "Barbell");
  const [type, setType] = useState<ExerciseType>(initial?.type ?? "compound");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "intermediate");
  const [primary, setPrimary] = useState<Muscle[]>(initial?.primaryMuscles ?? []);
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondaryMuscles ?? []);
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions.join("\n") ?? "");
  const [sets, setSets] = useState(String(initial?.recommendedSets ?? 3));
  const [reps, setReps] = useState(initial?.recommendedReps ?? "8-12");
  const fileRef = useRef<HTMLInputElement>(null);

  // Duplicate detection against the whole library (built-in + custom), ignoring the exercise being edited
  const duplicate = useMemo(() => {
    const k = nameKey(name);
    if (!k) return null;
    return all.find((e) => e.id !== initial?.id && nameKey(e.name) === k) ?? null;
  }, [all, name, initial?.id]);

  const toggle = (list: Muscle[], setList: (m: Muscle[]) => void, other: Muscle[], setOther: (m: Muscle[]) => void, m: Muscle) => {
    if (list.includes(m)) setList(list.filter((x) => x !== m));
    else {
      setList([...list, m]);
      if (other.includes(m)) setOther(other.filter((x) => x !== m));
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || duplicate) return;
        onSave({
          name: name.trim(),
          muscleGroup,
          equipment,
          type,
          difficulty,
          primaryMuscles: primary,
          secondaryMuscles: secondary,
          image,
          description: description.trim(),
          instructions: instructions.split("\n").map((s) => s.trim()).filter(Boolean),
          recommendedSets: Math.max(1, parseInt(sets, 10) || 3),
          recommendedReps: reps.trim() || "8-12",
        });
      }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="tap relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface-2 text-muted"
          aria-label={image ? "Change image" : "Upload image"}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pendlay Row" required />
          </Field>
          {image && (
            <button type="button" onClick={() => setImage(null)} className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger">
              <X className="h-3 w-3" /> Remove image
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Exercise image file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setImageError(null);
            try {
              setImage(await compressImage(f));
            } catch (err) {
              setImageError(err instanceof Error ? err.message : "Could not load image");
            }
          }}
        />
      </div>
      {imageError && <p className="-mt-2 text-xs text-danger">{imageError}</p>}
      {duplicate && (
        <div className="-mt-1 rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm">
          <span className="font-semibold text-warn">“{duplicate.name}” already exists</span>
          <span className="text-muted"> {duplicate.isCustom ? "in your custom exercises" : "in the library"}.</span>
          <button type="button" className="ml-1 font-semibold text-accent" onClick={() => onOpenExisting(duplicate.id)}>
            Open it
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary muscle group">
          <Select value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
            {MUSCLE_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </Select>
        </Field>
        <Field label="Equipment">
          <Select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((g) => <option key={g}>{g}</option>)}
          </Select>
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as ExerciseType)}>
            {EXERCISE_TYPES.map((t) => <option key={t} value={t}>{EXERCISE_TYPE_LABEL[t]}</option>)}
          </Select>
        </Field>
        <Field label="Difficulty">
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
          </Select>
        </Field>
        <Field label="Sets">
          <Input inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </Field>
        <Field label="Reps">
          <Input value={reps} onChange={(e) => setReps(e.target.value)} />
        </Field>
      </div>

      <Field label="Targeted muscles (primary)" group>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Primary muscles">
          {MUSCLES.map((m) => (
            <Chip key={m} active={primary.includes(m)} onClick={() => toggle(primary, setPrimary, secondary, setSecondary, m)} className="py-1 text-xs">
              {MUSCLE_INFO[m].label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Secondary muscles" group>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Secondary muscles">
          {MUSCLES.filter((m) => !primary.includes(m)).map((m) => (
            <Chip key={m} active={secondary.includes(m)} onClick={() => toggle(secondary, setSecondary, primary, setPrimary, m)} className="py-1 text-xs">
              {MUSCLE_INFO[m].label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Description">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this exercise target?" />
      </Field>
      <Field label="Instructions" hint="One step per line">
        <TextArea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-32" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || !!duplicate}>
        Save exercise
      </Button>
    </form>
  );
}
