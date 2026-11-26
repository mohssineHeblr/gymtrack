"use client";

import { MUSCLE_INFO, type Muscle } from "@/data/muscles";
import { cn } from "@/lib/utils";

/**
 * Stylised front/back body figure. Each muscle region is filled with the
 * colour passed in `colors`; regions without a colour use the neutral body tone.
 * Paths are drawn for the figure's left half and mirrored.
 */

type Region = { muscle: Muscle; d: string };

const FRONT: Region[] = [
  { muscle: "traps", d: "M88 60 Q94 58 99 60 L99 68 Q90 68 81 73 Q83 64 88 60 Z" },
  { muscle: "frontDelts", d: "M72 74 Q80 68 86 72 L84 92 Q77 94 70 99 Q67 84 72 74 Z" },
  { muscle: "sideDelts", d: "M70 75 L69 100 Q62 100 59 95 Q59 80 70 75 Z" },
  { muscle: "chest", d: "M88 74 Q97 72 99 76 L99 106 Q90 113 79 109 Q73 104 74 96 Q76 84 88 74 Z" },
  { muscle: "biceps", d: "M60 101 Q66 99 72 104 L70 134 Q63 139 57 134 Q56 114 60 101 Z" },
  { muscle: "forearms", d: "M56 139 Q63 143 70 139 L64 182 Q57 185 51 181 Q51 158 56 139 Z" },
  { muscle: "obliques", d: "M78 113 Q83 115 87 116 L87 166 Q81 162 77 154 Q75 132 78 113 Z" },
  { muscle: "abs", d: "M89 115 L99 113 L99 172 Q93 172 89 168 Z" },
  { muscle: "quads", d: "M77 186 Q86 181 93 188 L92 256 Q84 262 78 255 Q71 221 77 186 Z" },
  { muscle: "adductors", d: "M94 190 Q98 189 99 194 L99 236 Q96 240 94 234 Z" },
  { muscle: "calves", d: "M79 272 Q86 266 93 272 L90 334 Q84 339 81 334 Q75 302 79 272 Z" },
];

const BACK: Region[] = [
  { muscle: "traps", d: "M86 60 Q94 58 99 60 L99 112 Q93 104 88 90 Q84 80 78 74 Q81 64 86 60 Z" },
  { muscle: "rearDelts", d: "M72 74 Q78 70 84 76 L83 92 Q76 94 70 99 Q67 84 72 74 Z" },
  { muscle: "sideDelts", d: "M70 75 L69 100 Q62 100 59 95 Q59 80 70 75 Z" },
  { muscle: "upperBack", d: "M86 82 Q90 94 97 112 L84 112 Q80 102 82 92 Q83 86 86 82 Z" },
  { muscle: "lats", d: "M76 100 Q80 108 84 114 L97 116 L95 148 Q85 146 79 136 Q74 118 76 100 Z" },
  { muscle: "lowerBack", d: "M88 150 L99 151 L99 176 Q93 176 87 172 Q86 160 88 150 Z" },
  { muscle: "triceps", d: "M60 101 Q66 99 72 104 L70 134 Q63 139 57 134 Q56 114 60 101 Z" },
  { muscle: "forearms", d: "M56 139 Q63 143 70 139 L64 182 Q57 185 51 181 Q51 158 56 139 Z" },
  { muscle: "glutes", d: "M79 178 Q90 174 99 182 L99 214 Q88 221 79 213 Q74 196 79 178 Z" },
  { muscle: "hamstrings", d: "M78 218 Q88 223 97 219 L93 268 Q84 274 79 267 Q74 242 78 218 Z" },
  { muscle: "calves", d: "M79 278 Q88 272 94 280 L90 334 Q84 339 81 334 Q73 306 79 278 Z" },
];

/** Neutral silhouette parts (head, neck, hands, hips, feet …) drawn under the muscles. */
const SILHOUETTE_HALF =
  "M100 10 Q82 10 82 32 Q82 50 92 54 L92 60 Q80 62 70 72 Q57 78 57 96 Q53 116 55 138 Q49 160 49 182 Q47 192 52 196 Q60 198 64 186 Q70 160 72 140 L75 118 Q74 150 76 172 Q70 200 74 230 Q76 256 77 266 Q72 300 79 336 Q78 348 74 354 Q80 360 92 356 Q92 344 91 336 Q96 302 95 268 Q97 240 99 200 L100 200 Z";

function Figure({ regions, colors, label }: { regions: Region[]; colors: Partial<Record<Muscle, string>>; label: string }) {
  const titles = (m: Muscle) => MUSCLE_INFO[m].label;
  const half = (mirror: boolean) => (
    <g transform={mirror ? "translate(200,0) scale(-1,1)" : undefined}>
      <path d={SILHOUETTE_HALF} fill="var(--surface-3)" />
      {regions.map((r) => (
        <path
          key={r.muscle}
          d={r.d}
          fill={colors[r.muscle] ?? "var(--surface-2)"}
          stroke="var(--surface)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        >
          <title>{titles(r.muscle)}</title>
        </path>
      ))}
    </g>
  );
  return (
    <svg viewBox="40 4 120 360" className="absolute inset-0 h-full w-full" role="img" aria-label={label}>
      {half(false)}
      {half(true)}
    </svg>
  );
}

export function BodyMap({
  colors,
  className,
  size = "md",
}: {
  colors: Partial<Record<Muscle, string>>;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("grid grid-cols-2", size === "sm" ? "h-44 gap-1" : "h-80 gap-3", className)}>
      <div className="flex min-h-0 flex-col items-center">
        <div className="relative min-h-0 w-full flex-1">
          <Figure regions={FRONT} colors={colors} label="Front body muscle map" />
        </div>
        {size === "md" && <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">Front</span>}
      </div>
      <div className="flex min-h-0 flex-col items-center">
        <div className="relative min-h-0 w-full flex-1">
          <Figure regions={BACK} colors={colors} label="Back body muscle map" />
        </div>
        {size === "md" && <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">Back</span>}
      </div>
    </div>
  );
}
