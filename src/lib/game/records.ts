import type { Records, RunRecord } from "./types";

export const RECORDS_KEY = "3tris-records-v1";
export const HISTORY_KEY = "3tris-history-v1";
export const RECORDS_VERSION = 1;
const HISTORY_LIMIT = 20;

export const EMPTY_RECORDS: Records = {
  version: RECORDS_VERSION,
  highScore: 0,
  longestMs: 0,
  highestLevel: 1,
  mostLines: 0,
};

export function loadRecords(): Records {
  if (typeof window === "undefined") return { ...EMPTY_RECORDS };
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { ...EMPTY_RECORDS };
    const parsed = JSON.parse(raw) as Partial<Records>;
    return {
      ...EMPTY_RECORDS,
      ...parsed,
      version: RECORDS_VERSION,
    };
  } catch {
    return { ...EMPTY_RECORDS };
  }
}

export function loadHistory(): RunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RunRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function appendHistory(run: RunRecord): RunRecord[] {
  const next = [run, ...loadHistory()].slice(0, HISTORY_LIMIT);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  return next;
}
export function saveRecords(r: Records) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export type BestFlags = {
  score: boolean;
  time: boolean;
  level: boolean;
  lines: boolean;
};

export function applyRun(
  records: Records,
  run: { score: number; timeMs: number; level: number; lines: number },
): { records: Records; flags: BestFlags } {
  const flags: BestFlags = {
    score: run.score > records.highScore,
    time: run.timeMs > records.longestMs,
    level: run.level > records.highestLevel,
    lines: run.lines > records.mostLines,
  };
  const next: Records = {
    version: RECORDS_VERSION,
    highScore: Math.max(records.highScore, run.score),
    longestMs: Math.max(records.longestMs, run.timeMs),
    highestLevel: Math.max(records.highestLevel, run.level),
    mostLines: Math.max(records.mostLines, run.lines),
  };
  if (flags.score || flags.time || flags.level || flags.lines) saveRecords(next);
  return { records: next, flags };
}
