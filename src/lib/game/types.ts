export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 20;
export const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
export const SPAWN_ROW = HIDDEN_ROWS;

export const PIECE_IDS = ["I", "O", "T", "S", "Z", "J", "L"] as const;
export type PieceId = (typeof PIECE_IDS)[number];

export type GameMode = "endless" | "sprint";

export type Phase = "ready" | "playing" | "paused" | "over";

export type Overlay = "settings" | "help" | "results" | "leaderboard" | null;

export type Action =
  | "left"
  | "right"
  | "soft"
  | "hard"
  | "rotCW"
  | "rotCCW"
  | "rot180"
  | "hold"
  | "restart"
  | "pause";

export type Bindings = Record<Action, string[]>;

export type Point = { x: number; y: number };

export type Cell = {
  id: PieceId;
  lockedAt: number;
};

export type ActivePiece = {
  id: PieceId;
  x: number;
  y: number;
  rot: number;
  lastKick: number;
};

export type ClearKind =
  | "single"
  | "double"
  | "triple"
  | "tetris"
  | "tspin-mini"
  | "tspin-mini-single"
  | "tspin-single"
  | "tspin-double"
  | "tspin-triple";

export type ClearEvent = {
  kind: ClearKind;
  lines: number;
  combo: number;
  b2b: boolean;
  tspin: "none" | "mini" | "full";
  scoreGain: number;
};

export type Palette = "standard" | "contrast";

export type Settings = {
  bindings: Bindings;
  dasMs: number;
  arrMs: number;
  sdf: number;
  sdfInf: boolean;
  fullscreen: boolean;
  screenShake: boolean;
  reducedMotion: boolean;
  ghostOpacity: number;
  gridVisible: boolean;
  showNext: boolean;
  nextCount: number;
  master: number;
  music: number;
  sfx: number;
  palette: Palette;
};

export type Records = {
  version: number;
  highScore: number;
  sprintBestMs?: number;
  longestMs: number;
  highestLevel: number;
  mostLines: number;
};

export type RunRecord = {
  mode?: GameMode;
  completed?: boolean;
  at: number;
  score: number;
  lines: number;
  level: number;
  timeMs: number;
  pieces: number;
  pps: number;
  bestCrossMs: number | null;
};

export type Snapshot = {
  grid: (Cell | null)[][];
  active: ActivePiece | null;
  ghostY: number;
  hold: PieceId | null;
  holdLocked: boolean;
  next: PieceId[];
  clearing: number[];
  clearT: number;
  score: number;
  lines: number;
  level: number;
  timeMs: number;
  combo: number;
  b2b: boolean;
  lastClear: ClearEvent | null;
  phase: Phase;
  landFlash: { cells: Point[]; t: number } | null;
  pieces: number;
  deathCells: Point[];
  deathReason: string | null;
};
