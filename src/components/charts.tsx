"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

type Datum = Record<string, string | number | boolean | null | undefined>;

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  fmt,
}: Partial<TooltipContentProps<number, string>> & { unit?: string; fmt?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0].value ?? 0);
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-fg">
        {fmt ? fmt(v) : v.toLocaleString()} {unit}
      </div>
    </div>
  );
}

const axisProps = {
  tick: { fill: "var(--muted)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export function TrendChart({
  data,
  x,
  y,
  unit,
  height = 200,
  color = "var(--accent)",
  domain = ["auto", "auto"],
  formatter,
  id = "trend",
}: {
  data: Datum[];
  x: string;
  y: string;
  unit?: string;
  height?: number;
  color?: string;
  domain?: [number | string, number | string];
  formatter?: (v: number) => string;
  id?: string;
}) {
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={x} {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} width={40} domain={domain} tickFormatter={(v: number) => (formatter ? formatter(v) : String(v))} />
          <Tooltip
            cursor={{ stroke: "var(--subtle)", strokeDasharray: "4 4" }}
            content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} unit={unit} fmt={formatter} />}
          />
          <Area
            type="monotone"
            dataKey={y}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${id})`}
            dot={data.length <= 16 ? { r: 3, fill: color, strokeWidth: 2, stroke: "var(--surface)" } : false}
            activeDot={{ r: 5, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({
  data,
  x,
  y,
  unit,
  height = 180,
  highlightKey,
  formatter,
  color = "var(--accent)",
}: {
  data: Datum[];
  x: string;
  y: string;
  unit?: string;
  height?: number;
  /** boolean field marking the bar to highlight (others are dimmed) */
  highlightKey?: string;
  formatter?: (v: number) => string;
  color?: string;
}) {
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={x} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} width={40} allowDecimals={false} tickFormatter={(v: number) => (formatter ? formatter(v) : String(v))} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} unit={unit} fmt={formatter} />}
          />
          <Bar dataKey={y} radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d, i) => (
              <Cell key={i} fill={color} fillOpacity={highlightKey ? (d[highlightKey] ? 1 : 0.45) : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
