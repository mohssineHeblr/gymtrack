"use client";

import { useMemo, useState } from "react";
import { Plus, Ruler, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button, Card, Chip, EmptyState, Field, IconButton, Input, PageHeader, SectionTitle, Sheet } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { useGym } from "@/lib/store";
import { latestMeasurement, previousMeasurement } from "@/lib/stats";
import { cn, displayToKg, formatDate, kgToDisplay, parseNum, toDateKey } from "@/lib/utils";
import type { BodyMeasurement, Units } from "@/lib/types";

type Metric = "weight" | "bodyFat" | "chest" | "waist" | "arm" | "thigh";

const METRICS: { key: Metric; label: string }[] = [
  { key: "weight", label: "Weight" },
  { key: "bodyFat", label: "Body fat" },
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "arm", label: "Arm" },
  { key: "thigh", label: "Thigh" },
];

const CM_PER_IN = 2.54;

function unitFor(m: Metric, units: Units) {
  if (m === "weight") return units;
  if (m === "bodyFat") return "%";
  return units === "lbs" ? "in" : "cm";
}

/** stored → display */
function toDisplay(m: Metric, v: number | null | undefined, units: Units): number | null {
  if (v == null) return null;
  if (m === "weight") return kgToDisplay(v, units);
  if (m === "bodyFat") return v;
  return units === "lbs" ? Math.round((v / CM_PER_IN) * 10) / 10 : v;
}

/** display → stored */
function fromDisplay(m: Metric, v: number | null, units: Units): number | null {
  if (v == null) return null;
  if (m === "weight") return displayToKg(v, units);
  if (m === "bodyFat") return v;
  return units === "lbs" ? Math.round(v * CM_PER_IN * 100) / 100 : v;
}

export default function BodyPage() {
  const body = useGym((s) => s.body);
  const units = useGym((s) => s.profile.units);
  const deleteMeasurement = useGym((s) => s.deleteMeasurement);
  const [metric, setMetric] = useState<Metric>("weight");
  const [form, setForm] = useState<BodyMeasurement | "new" | null>(null);

  const chart = useMemo(
    () => body.filter((b) => b[metric] != null).map((b) => ({ label: formatDate(b.date), value: toDisplay(metric, b[metric], units) })),
    [body, metric, units],
  );

  return (
    <div>
      <PageHeader
        title="Body"
        subtitle="Weight & measurements"
        back
        action={
          <IconButton label="Add measurement" className="bg-accent text-accent-ink" onClick={() => setForm("new")}>
            <Plus className="h-5 w-5" />
          </IconButton>
        }
      />

      {!body.length ? (
        <EmptyState
          icon={<Ruler className="h-6 w-6" />}
          title="Track your body"
          description="Log weight, body fat and measurements regularly to see how your body changes."
          action={<Button onClick={() => setForm("new")}>Add first entry</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {METRICS.map(({ key, label }) => {
              const latest = latestMeasurement(body, key);
              const prev = latest ? previousMeasurement(body, key, latest.index) : null;
              const delta = latest && prev ? latest.value - prev.value : null;
              const dispDelta = delta != null ? (toDisplay(key, Math.abs(delta), units) ?? 0) : null;
              return (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={cn(
                    "tap rounded-2xl border bg-surface p-3 text-left",
                    metric === key ? "border-accent/60" : "border-line",
                  )}
                >
                  <div className="text-[11px] font-medium text-muted">{label}</div>
                  <div className="mt-0.5 text-lg font-bold">
                    {latest ? toDisplay(key, latest.value, units)?.toFixed(1) : "—"}
                    <span className="ml-0.5 text-[11px] font-medium text-muted">{latest ? unitFor(key, units) : ""}</span>
                  </div>
                  {delta != null && delta !== 0 && (
                    <div className="flex items-center gap-0.5 text-[11px] text-muted">
                      {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {dispDelta?.toFixed(1)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <Card className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{METRICS.find((m) => m.key === metric)?.label} over time</span>
              <span className="text-xs text-muted">{chart.length} entries</span>
            </div>
            {chart.length > 1 ? (
              <TrendChart id={`body-${metric}`} data={chart} x="label" y="value" unit={unitFor(metric, units)} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">Add at least two entries to see a trend.</p>
            )}
          </Card>

          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {METRICS.map((m) => (
              <Chip key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)}>
                {m.label}
              </Chip>
            ))}
          </div>

          <SectionTitle>History</SectionTitle>
          <div className="overflow-hidden rounded-3xl border border-line bg-surface">
            {[...body].reverse().map((b, i) => (
              <div key={b.id} className={cn("flex items-center gap-3 px-4 py-3", i && "border-t border-line")}>
                <button className="min-w-0 flex-1 text-left" onClick={() => setForm(b)}>
                  <div className="font-semibold">{formatDate(b.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
                  <div className="truncate text-xs text-muted">
                    {METRICS.filter((m) => b[m.key] != null)
                      .map((m) => `${m.label} ${toDisplay(m.key, b[m.key], units)}${unitFor(m.key, units)}`)
                      .join(" · ")}
                  </div>
                </button>
                <IconButton label="Delete entry" className="h-8 w-8 text-danger" onClick={() => confirm("Delete this entry?") && deleteMeasurement(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={form !== null} onClose={() => setForm(null)} title={form && form !== "new" ? "Edit entry" : "New entry"}>
        {form !== null && <MeasurementForm key={form === "new" ? "new" : form.id} initial={form === "new" ? null : form} onDone={() => setForm(null)} />}
      </Sheet>
    </div>
  );
}

function MeasurementForm({ initial, onDone }: { initial: BodyMeasurement | null; onDone: () => void }) {
  const units = useGym((s) => s.profile.units);
  const body = useGym((s) => s.body);
  const addMeasurement = useGym((s) => s.addMeasurement);
  const updateMeasurement = useGym((s) => s.updateMeasurement);
  const [date, setDate] = useState(initial?.date ?? toDateKey());
  const last = body[body.length - 1];
  const [values, setValues] = useState<Record<Metric, string>>(() => {
    const src = initial;
    const out = {} as Record<Metric, string>;
    for (const m of METRICS) {
      const v = toDisplay(m.key, src?.[m.key], units);
      out[m.key] = v == null ? "" : String(v);
    }
    return out;
  });

  const save = () => {
    const data: Partial<BodyMeasurement> = { date };
    for (const m of METRICS) data[m.key] = fromDisplay(m.key, parseNum(values[m.key]), units);
    if (initial) updateMeasurement(initial.id, data);
    else addMeasurement(data as Omit<BodyMeasurement, "id" | "updatedAt">);
    onDone();
  };

  const hasAny = METRICS.some((m) => parseNum(values[m.key]) != null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="Date">
        <Input type="date" value={date} max={toDateKey()} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((m) => (
          <Field key={m.key} label={`${m.label} (${unitFor(m.key, units)})`}>
            <Input
              inputMode="decimal"
              value={values[m.key]}
              placeholder={last?.[m.key] != null ? String(toDisplay(m.key, last[m.key], units)) : "—"}
              onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!hasAny}>
        Save entry
      </Button>
    </form>
  );
}
