import { create } from "zustand";
import { EMPTY_RECORDS, loadHistory, loadRecords } from "./records";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";
import type { GameMode, Overlay, Phase, PieceId, Records, RunRecord, Settings } from "./types";

export type SettingsTab = "controls" | "video" | "audio" | "game";

export type HudState = {
  phase: Phase;
  mode: GameMode;
  completed: boolean;
  clearSerial: number;
  overlay: Overlay;
  score: number;
  lines: number;
  level: number;
  timeMs: number;
  hold: PieceId | null;
  holdLocked: boolean;
  next: PieceId[];
  combo: number;
  b2b: boolean;
  lastClearLabel: string | null;
  levelToast: number | null;
  newBest: boolean;
  records: Records;
  history: RunRecord[];
  pieces: number;
  bestCrossMs: number | null;
  deathReason: string | null;
  settings: Settings;
  rebinding: keyof Settings["bindings"] | null;
  settingsTab: SettingsTab;
};

type Actions = {
  patch: (p: Partial<HudState>) => void;
  setSettings: (s: Settings, persist?: boolean) => void;
  setOverlay: (o: Overlay) => void;
};

const bootSettings = typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings();
const bootRecords = typeof window === "undefined" ? EMPTY_RECORDS : loadRecords();
const bootHistory = typeof window === "undefined" ? [] : loadHistory();

export const useTris = create<HudState & Actions>((set, get) => ({
  phase: "ready",
  mode: "endless",
  completed: false,
  clearSerial: 0,
  overlay: null,
  score: 0,
  lines: 0,
  level: 1,
  timeMs: 0,
  hold: null,
  holdLocked: false,
  next: [],
  combo: -1,
  b2b: false,
  lastClearLabel: null,
  levelToast: null,
  newBest: false,
  records: bootRecords,
  history: bootHistory,
  pieces: 0,
  bestCrossMs: null,
  deathReason: null,
  settings: bootSettings,
  rebinding: null,
  settingsTab: "controls",
  patch: (p) => set(p),
  setSettings: (s, persist = true) => {
    set({ settings: s });
    if (persist) saveSettings(s);
  },
  setOverlay: (o) =>
    set({
      overlay: o,
      rebinding: get().rebinding && o !== "settings" ? null : get().rebinding,
    }),
}));

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatScore(n: number): string {
  if (n < 1_000_000) return String(Math.max(0, n | 0)).padStart(6, "0");
  return n.toLocaleString("en-US");
}

export function clearLabel(kind: string, b2b: boolean, combo: number): string {
  const names: Record<string, string> = {
    single: "SINGLE",
    double: "DOUBLE",
    triple: "TRIPLE",
    tetris: "QUAD",
    "tspin-mini": "",
    "tspin-mini-single": "SPIN",
    "tspin-single": "SPIN",
    "tspin-double": "SPIN",
    "tspin-triple": "SPIN",
  };
  const base = names[kind] ?? "";
  if (!base && combo < 1 && !b2b) return "";
  const bits = [];
  if (b2b && base) bits.push("B2B");
  if (base) bits.push(base);
  if (combo >= 1) bits.push(`${combo + 1} COMBO`);
  return bits.join("  ");
}

export function formatSprintTime(ms: number): string {
  return `${formatTime(ms)}.${String(Math.floor(ms % 1000 / 10)).padStart(2, "0")}`;
}
