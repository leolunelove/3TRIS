import { LEADERBOARD_URL, LEADERBOARD_KEY } from "./leaderboard-config";
import type { GameMode, RunRecord } from "./types";

export type LeaderboardEntry = { id: string; nickname: string; score: number; lines: number; level: number; time_ms: number };
export function newRunId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
let memoryToken = "";
export function playerToken(): string {
  if (memoryToken) return memoryToken;
  try { memoryToken = localStorage.getItem("3tris-player-token-v1") ?? ""; } catch { /* session identity still works */ }
  if (!/^[a-f0-9]{64}$/.test(memoryToken)) {
    memoryToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem("3tris-player-token-v1", memoryToken); } catch { /* session only */ }
  }
  return memoryToken;
}
let memoryNickname = "";
export function savedNickname(): string {
  try {
    const saved = localStorage.getItem("3tris-nickname-v1")?.trim() ?? "";
    if (/^[A-Za-z0-9 _-]{2,16}$/.test(saved)) memoryNickname = saved;
  } catch { /* use this session's name when storage is unavailable */ }
  return memoryNickname;
}
export function rememberNickname(nickname: string): void {
  const name = nickname.trim();
  if (!/^[A-Za-z0-9 _-]{2,16}$/.test(name)) return;
  memoryNickname = name;
  try { localStorage.setItem("3tris-nickname-v1", name); } catch { /* session only */ }
}
async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!LEADERBOARD_URL) throw new Error("Leaderboard is not connected yet.");
  const response = await fetch(`${LEADERBOARD_URL}${path}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { apikey: LEADERBOARD_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ?? AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Leaderboard unavailable. Please try again.");
  return data as T;
}
export function getLeaderboard(mode: GameMode, signal?: AbortSignal) {
  return request<{ entries: LeaderboardEntry[] }>(`?mode=${mode}`, undefined, signal);
}
export function beginLeaderboardRun(runId: string, mode: GameMode) {
  return request<{ ok: boolean }>("", { action: "start", runId, mode, playerToken: playerToken() });
}
export async function postLeaderboardRun(runId: string, run: RunRecord, nickname: string) {
  rememberNickname(nickname);
  const result = await request<{ rank: number | null; improved: boolean }>("", {
    action: "submit", runId, playerToken: playerToken(), nickname: nickname.trim(),
    score: run.score, lines: run.lines, level: run.level, timeMs: Math.round(run.timeMs), pieces: run.pieces, completed: !!run.completed,
  });
  return result;
}
