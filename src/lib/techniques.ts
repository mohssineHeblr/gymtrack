import type { Technique, WorkoutExercise, WorkoutSet } from "./types";

export const TECHNIQUE_INFO: Record<Technique, { label: string; short: string; description: string; stageLabel?: string; stageRest?: number }> = {
  standard: { label: "Standard sets", short: "Standard", description: "Straight sets with rest between each set." },
  dropset: {
    label: "Dropset",
    short: "Dropset",
    description: "After the main set, reduce the weight (~20%) and keep going with no rest. Each drop is logged inside the same set.",
    stageLabel: "drop",
  },
  rest_pause: {
    label: "Rest-pause",
    short: "Rest-pause",
    description: "Take a set close to failure, rest 10–20 s, then squeeze out a few more reps with the same weight. Repeat 1–3 times.",
    stageLabel: "mini-set",
    stageRest: 15,
  },
  myo_reps: {
    label: "Myo-reps",
    short: "Myo-reps",
    description: "One activation set of 12–20 reps, then mini-sets of 3–5 reps with 3–5 deep breaths (~10 s) between them.",
    stageLabel: "mini-set",
    stageRest: 10,
  },
  tempo: {
    label: "Tempo training",
    short: "Tempo",
    description: "Control every rep with a set tempo: lowering – pause – lifting – pause, in seconds (e.g. 3-1-1-0).",
  },
};

export const TEMPO_PRESETS = ["3-1-1-0", "4-0-1-0", "3-0-3-0", "2-2-1-0", "5-1-1-1"];

export const usesStages = (t?: Technique) => t === "dropset" || t === "rest_pause" || t === "myo_reps";

/** Label for a group of exercises: 2 → superset, 3+ → giant set */
export const groupKind = (size: number) => (size >= 3 ? "Giant set" : "Superset");

/** Consecutive blocks of exercises; grouped exercises share a block. */
export function toBlocks(list: WorkoutExercise[]): WorkoutExercise[][] {
  const blocks: WorkoutExercise[][] = [];
  for (const we of list) {
    const last = blocks[blocks.length - 1];
    if (we.groupId && last && last[0].groupId === we.groupId) last.push(we);
    else blocks.push([we]);
  }
  return blocks;
}

/**
 * Keep groups valid: members are contiguous (gathered at the first member's position)
 * and groups with a single member are dissolved.
 */
export function normalizeGroups<T extends { groupId?: string | null }>(list: T[]): T[] {
  const counts = new Map<string, number>();
  for (const x of list) if (x.groupId) counts.set(x.groupId, (counts.get(x.groupId) ?? 0) + 1);
  const cleaned = list.map((x) => (x.groupId && (counts.get(x.groupId) ?? 0) < 2 ? { ...x, groupId: null } : x));
  const out: T[] = [];
  const emitted = new Set<string>();
  for (const x of cleaned) {
    if (!x.groupId) {
      out.push(x);
      continue;
    }
    if (emitted.has(x.groupId)) continue;
    emitted.add(x.groupId);
    out.push(...cleaned.filter((y) => y.groupId === x.groupId));
  }
  return out;
}

/** Letters for each group in order of appearance: { groupId → "A" } */
export function groupLetters(list: { groupId?: string | null }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of list) if (x.groupId && !m.has(x.groupId)) m.set(x.groupId, String.fromCharCode(65 + m.size));
  return m;
}

/** Move an exercise: inside its group it moves within the group, otherwise whole blocks swap. */
export function moveInList(list: WorkoutExercise[], weId: string, dir: -1 | 1): WorkoutExercise[] {
  const blocks = toBlocks(list);
  const bi = blocks.findIndex((b) => b.some((e) => e.id === weId));
  if (bi < 0) return list;
  const block = blocks[bi];
  const pos = block.findIndex((e) => e.id === weId);
  if (block.length > 1 && pos + dir >= 0 && pos + dir < block.length) {
    const nb = [...block];
    [nb[pos], nb[pos + dir]] = [nb[pos + dir], nb[pos]];
    blocks[bi] = nb;
  } else {
    const bj = bi + dir;
    if (bj < 0 || bj >= blocks.length) return list;
    [blocks[bi], blocks[bj]] = [blocks[bj], blocks[bi]];
  }
  return blocks.flat();
}

export function canMove(list: WorkoutExercise[], weId: string, dir: -1 | 1) {
  const moved = moveInList(list, weId, dir);
  return moved !== list && moved.some((e, i) => e.id !== list[i].id);
}

/** Rest to use after completing `set` of `we` (per-set override wins). */
export const restForSet = (we: WorkoutExercise, set?: WorkoutSet) => set?.restSeconds ?? we.restSeconds;

/**
 * After completing round `setIndex` of an exercise in a group, which member still has to be done?
 * Returns the next exercise id, or null when the round is complete.
 */
export function nextInRound(members: WorkoutExercise[], currentId: string, setIndex: number): string | null {
  const start = members.findIndex((m) => m.id === currentId);
  for (let k = 1; k < members.length; k++) {
    const m = members[(start + k) % members.length];
    const st = m.sets.filter((s) => s.type !== "warmup")[setIndex];
    if (st && !st.completed) return m.id;
  }
  return null;
}
