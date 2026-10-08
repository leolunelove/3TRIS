import { cellsAt, getKicks, getKicks180, spawnX } from "./pieces";
import { COLS, HIDDEN_ROWS, PIECE_IDS, ROWS, SPAWN_ROW, VISIBLE_ROWS } from "./types";
import type {
  ActivePiece,
  Cell,
  ClearEvent,
  ClearKind,
  Phase,
  PieceId,
  Point,
  Settings,
  Snapshot,
} from "./types";

const MAX_LOCK_RESETS = 15;
const LINE_CLEAR_MS = 110;
const LINE_CLEAR_MS_REDUCED = 40;
const LINES_PER_LEVEL = 10;

export type EngineEvent =
  | { type: "lock"; cells: Point[]; hard: boolean }
  | { type: "move"; dx: number }
  | { type: "rotate" }
  | { type: "hold" }
  | { type: "clear"; event: ClearEvent }
  | { type: "level"; level: number }
  | { type: "spawn"; id: PieceId }
  | { type: "over"; reason: string; cells: Point[] }
  | { type: "start" }
  | { type: "score"; amount: number; total: number };

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** Invisible ramp: relaxed early, concentrating after a few minutes, survival later. */
export function gravityCps(level: number): number {
  if (level >= 50) return 20 * 60;
  if (level >= 42) return 60;
  return 0.85 * Math.pow(1.11, Math.max(0, level - 1));
}

export function lockDelayMs(level: number): number {
  if (level >= 42) return 320;
  if (level >= 35) return 400;
  return 500;
}

function kindFor(lines: number, tspin: "none" | "mini" | "full"): ClearKind {
  if (tspin === "full") {
    if (lines === 0) return "tspin-single";
    if (lines === 1) return "tspin-single";
    if (lines === 2) return "tspin-double";
    return "tspin-triple";
  }
  if (tspin === "mini") {
    if (lines <= 0) return "tspin-mini";
    return "tspin-mini-single";
  }
  if (lines >= 4) return "tetris";
  if (lines === 3) return "triple";
  if (lines === 2) return "double";
  return "single";
}

function baseClearScore(kind: ClearKind, level: number): number {
  const table: Record<ClearKind, number> = {
    single: 100,
    double: 300,
    triple: 500,
    tetris: 800,
    "tspin-mini": 100,
    "tspin-mini-single": 200,
    "tspin-single": 800,
    "tspin-double": 1200,
    "tspin-triple": 1600,
  };
  return table[kind] * level;
}

function isDifficult(kind: ClearKind): boolean {
  return (
    kind === "tetris" ||
    kind === "tspin-single" ||
    kind === "tspin-double" ||
    kind === "tspin-triple" ||
    kind === "tspin-mini-single"
  );
}

export class Engine {
  grid: (Cell | null)[][] = [];
  active: ActivePiece | null = null;
  hold: PieceId | null = null;
  holdLocked = false;
  bag: PieceId[] = [];
  score = 0;
  lines = 0;
  level = 1;
  timeMs = 0;
  combo = -1;
  b2b = false;
  phase: Phase = "ready";
  gravityAcc = 0;
  lockTimer = 0;
  lockResets = MAX_LOCK_RESETS;
  lowestY = 0;
  clearing: number[] = [];
  clearT = 0;
  lastClear: ClearEvent | null = null;
  landFlash: { cells: Point[]; t: number } | null = null;
  pendingTSpin: "none" | "mini" | "full" = "none";
  lastHard = false;
  pieces = 0;
  deathCells: Point[] = [];
  deathReason: string | null = null;
  settings: Settings;
  listeners: ((e: EngineEvent) => void)[] = [];
  clock = 0;

  constructor(settings: Settings) {
    this.settings = settings;
    this.resetBoard();
  }

  on(fn: (e: EngineEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== fn);
    };
  }

  private emit(e: EngineEvent) {
    for (const fn of this.listeners) fn(e);
  }

  applySettings(s: Settings) {
    this.settings = s;
  }

  private resetBoard() {
    this.grid = Array.from({ length: ROWS }, () => Array<Cell | null>(COLS).fill(null));
    this.active = null;
    this.hold = null;
    this.holdLocked = false;
    this.bag = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.timeMs = 0;
    this.combo = -1;
    this.b2b = false;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = MAX_LOCK_RESETS;
    this.clearing = [];
    this.clearT = 0;
    this.lastClear = null;
    this.landFlash = null;
    this.pendingTSpin = "none";
    this.lastHard = false;
    this.pieces = 0;
    this.deathCells = [];
    this.deathReason = null;
    this.fillBag();
    this.fillBag();
  }

  private fillBag() {
    this.bag.push(...shuffle([...PIECE_IDS]));
  }

  peekNext(n: number): PieceId[] {
    while (this.bag.length < n + 1) this.fillBag();
    return this.bag.slice(0, n);
  }

  private take(): PieceId {
    while (this.bag.length < 8) this.fillBag();
    return this.bag.shift()!;
  }

  start() {
    if (this.phase === "playing") return;
    this.resetBoard();
    this.phase = "playing";
    this.spawn(this.take());
    this.emit({ type: "start" });
  }

  restart() {
    this.resetBoard();
    this.phase = "playing";
    this.spawn(this.take());
    this.emit({ type: "start" });
  }

  toReady() {
    this.resetBoard();
    this.phase = "ready";
  }

  pause() {
    if (this.phase === "playing") this.phase = "paused";
  }

  resume() {
    if (this.phase === "paused") this.phase = "playing";
  }

  private occupied(x: number, y: number): boolean {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y < 0) return false;
    return this.grid[y]![x] !== null;
  }

  fits(cells: Point[]): boolean {
    for (const c of cells) {
      if (this.occupied(c.x, c.y)) return false;
    }
    return true;
  }

  private pieceCells(p: ActivePiece): Point[] {
    return cellsAt(p.id, p.x, p.y, p.rot);
  }

  ghostY(): number {
    const p = this.active;
    if (!p) return 0;
    let y = p.y;
    while (this.fits(cellsAt(p.id, p.x, y + 1, p.rot))) y++;
    return y;
  }

  canMove(dx: number, dy: number): boolean {
    const p = this.active;
    if (!p) return false;
    return this.fits(cellsAt(p.id, p.x + dx, p.y + dy, p.rot));
  }

  private resetLockOnAction() {
    const p = this.active;
    if (!p) return;
    if (this.canMove(0, 1)) {
      this.lockTimer = 0;
      return;
    }
    if (this.lockResets > 0) {
      this.lockTimer = 0;
      this.lockResets--;
    }
  }

  tryMove(dx: number, dy: number, opts: { silent?: boolean } = {}): boolean {
    if (this.phase !== "playing" || this.clearing.length) return false;
    const p = this.active;
    if (!p) return false;
    if (!this.fits(cellsAt(p.id, p.x + dx, p.y + dy, p.rot))) return false;
    p.x += dx;
    p.y += dy;
    this.pendingTSpin = "none";
    if (dy > 0 && p.y > this.lowestY) {
      this.lowestY = p.y;
      this.lockResets = MAX_LOCK_RESETS;
      this.lockTimer = 0;
    } else if (dx !== 0) {
      this.resetLockOnAction();
    }
    if (dx !== 0 && !opts.silent) this.emit({ type: "move", dx });
    return true;
  }

  tryRotate(dir: 1 | -1): boolean {
    if (this.phase !== "playing" || this.clearing.length) return false;
    const p = this.active;
    if (!p) return false;
    if (p.id === "O") {
      p.rot = (p.rot + dir + 4) % 4;
      this.emit({ type: "rotate" });
      return true;
    }
    const from = p.rot;
    const to = (p.rot + dir + 4) % 4;
    const kicks = getKicks(p.id, from, to);
    for (let i = 0; i < kicks.length; i++) {
      const [kx, kyUp] = kicks[i]!;
      const nx = p.x + kx;
      const ny = p.y - kyUp;
      if (this.fits(cellsAt(p.id, nx, ny, to))) {
        p.x = nx;
        p.y = ny;
        p.rot = to;
        p.lastKick = i;
        this.pendingTSpin = this.detectTSpin(p);
        if (p.y > this.lowestY) {
          this.lowestY = p.y;
          this.lockResets = MAX_LOCK_RESETS;
        }
        this.resetLockOnAction();
        this.emit({ type: "rotate" });
        return true;
      }
    }
    return false;
  }

  tryRotate180(): boolean {
    if (this.phase !== "playing" || this.clearing.length) return false;
    const p = this.active;
    if (!p) return false;
    if (p.id === "O") {
      p.rot = (p.rot + 2) % 4;
      this.emit({ type: "rotate" });
      return true;
    }
    const from = p.rot;
    const to = (from + 2) % 4;
    const kicks = getKicks180(p.id, from);
    for (let i = 0; i < kicks.length; i++) {
      const [kx, kyUp] = kicks[i]!;
      const nx = p.x + kx;
      const ny = p.y - kyUp;
      if (this.fits(cellsAt(p.id, nx, ny, to))) {
        p.x = nx;
        p.y = ny;
        p.rot = to;
        p.lastKick = i;
        this.pendingTSpin = "none";
        if (p.y > this.lowestY) {
          this.lowestY = p.y;
          this.lockResets = MAX_LOCK_RESETS;
        }
        this.resetLockOnAction();
        this.emit({ type: "rotate" });
        return true;
      }
    }
    return false;
  }

  private detectTSpin(p: ActivePiece): "none" | "mini" | "full" {
    if (p.id !== "T") return "none";
    const corners: Point[] = [
      { x: p.x + 0, y: p.y + 0 },
      { x: p.x + 2, y: p.y + 0 },
      { x: p.x + 0, y: p.y + 2 },
      { x: p.x + 2, y: p.y + 2 },
    ];
    let filled = 0;
    for (const c of corners) {
      if (this.occupied(c.x, c.y)) filled++;
    }
    if (filled < 3) return "none";
    const front =
      p.rot === 0
        ? [corners[0]!, corners[1]!]
        : p.rot === 1
          ? [corners[1]!, corners[3]!]
          : p.rot === 2
            ? [corners[2]!, corners[3]!]
            : [corners[0]!, corners[2]!];
    const frontFilled = front.filter((c) => this.occupied(c.x, c.y)).length;
    if (frontFilled === 2) return "full";
    if (p.lastKick > 0) return "full";
    return "mini";
  }

  sonicDrop(): number {
    if (this.phase !== "playing" || this.clearing.length) return 0;
    const p = this.active;
    if (!p) return 0;
    let n = 0;
    while (this.fits(cellsAt(p.id, p.x, p.y + 1, p.rot))) {
      p.y++;
      n++;
    }
    if (n > 0) {
      this.lowestY = p.y;
      this.lockResets = MAX_LOCK_RESETS;
      this.lockTimer = 0;
    }
    return n;
  }

  hardDrop() {
    if (this.phase !== "playing" || this.clearing.length) return;
    const dist = this.sonicDrop();
    if (dist > 0) {
      this.score += dist * 2;
      this.emit({ type: "score", amount: dist * 2, total: this.score });
    }
    this.lastHard = true;
    this.lockPiece();
  }

  holdPiece(): boolean {
    if (this.phase !== "playing" || this.clearing.length) return false;
    if (this.holdLocked || !this.active) return false;
    const current = this.active.id;
    const swapped = this.hold;
    this.hold = current;
    this.holdLocked = true;
    this.active = null;
    this.emit({ type: "hold" });
    this.spawn(swapped ?? this.take());
    return true;
  }

  private spawn(id: PieceId) {
    const piece: ActivePiece = {
      id,
      x: spawnX(id),
      y: SPAWN_ROW,
      rot: 0,
      lastKick: 0,
    };
    this.active = piece;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = MAX_LOCK_RESETS;
    this.lowestY = piece.y;
    this.pendingTSpin = "none";
    this.lastHard = false;
    this.pieces += 1;
    if (!this.fits(this.pieceCells(piece))) {
      const cells = this.pieceCells(piece);
      this.place(piece);
      this.deathCells = cells;
      this.deathReason = "Spawn blocked";
      this.active = null;
      this.phase = "over";
      this.emit({ type: "over", reason: "Spawn blocked", cells });
      return;
    }
    // 20G: drop onto the stack immediately
    const g = gravityCps(this.level);
    if (g >= 60) {
      this.sonicDrop();
    }
    this.emit({ type: "spawn", id });
  }

  private place(p: ActivePiece) {
    const now = this.clock;
    for (const c of this.pieceCells(p)) {
      if (c.y >= 0 && c.y < ROWS && c.x >= 0 && c.x < COLS) {
        this.grid[c.y]![c.x] = { id: p.id, lockedAt: now };
      }
    }
  }

  private lockPiece() {
    const p = this.active;
    if (!p) return;
    const cells = this.pieceCells(p);
    this.place(p);
    this.landFlash = { cells, t: 1 };
    this.emit({ type: "lock", cells, hard: this.lastHard });
    this.lastHard = false;
    this.active = null;
    this.holdLocked = false;

    const full: number[] = [];
    for (let y = 0; y < ROWS; y++) {
      if (this.grid[y]!.every((c) => c !== null)) full.push(y);
    }

    if (full.length === 0) {
      this.combo = -1;
      this.pendingTSpin = "none";
      this.spawn(this.take());
      return;
    }

    const tspin = this.pendingTSpin;
    this.pendingTSpin = "none";
    this.combo += 1;
    const kind = kindFor(full.length, tspin);
    let gain = baseClearScore(kind, this.level);
    const wasB2b = this.b2b && isDifficult(kind);
    if (wasB2b) gain = Math.floor(gain * 1.5);
    if (this.combo > 0) gain += 50 * this.combo * this.level;
    this.score += gain;
    this.lines += full.length;
    const prevLevel = this.level;
    this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
    if (isDifficult(kind)) this.b2b = true;
    else if (full.length > 0 && tspin === "none") this.b2b = false;

    const event: ClearEvent = {
      kind,
      lines: full.length,
      combo: this.combo,
      b2b: wasB2b,
      tspin,
      scoreGain: gain,
    };
    this.lastClear = event;
    this.clearing = full;
    this.clearT = 1;
    this.emit({ type: "clear", event });
    this.emit({ type: "score", amount: gain, total: this.score });
    if (this.level !== prevLevel) this.emit({ type: "level", level: this.level });
  }

  private finishClear() {
    const remove = new Set(this.clearing);
    const next: (Cell | null)[][] = [];
    for (let y = 0; y < ROWS; y++) {
      if (!remove.has(y)) next.push(this.grid[y]!);
    }
    while (next.length < ROWS) next.unshift(Array<Cell | null>(COLS).fill(null));
    this.grid = next;
    this.clearing = [];
    this.clearT = 0;
    this.spawn(this.take());
  }

  step(dt: number, softHeld: boolean) {
    this.clock += dt;
    if (this.landFlash) {
      this.landFlash.t -= dt / 0.09;
      if (this.landFlash.t <= 0) this.landFlash = null;
    }
    if (this.phase !== "playing") return;

    if (this.clearing.length) {
      const dur = this.settings.reducedMotion ? LINE_CLEAR_MS_REDUCED : LINE_CLEAR_MS;
      this.clearT -= dt / (dur / 1000);
      if (this.clearT <= 0) this.finishClear();
      return;
    }

    this.timeMs += dt * 1000;

    const p = this.active;
    if (!p) return;

    const g = gravityCps(this.level);
    const sdf = softHeld ? (this.settings.sdfInf ? 800 : this.settings.sdf) : 1;
    this.gravityAcc += g * sdf * dt;

    let softCells = 0;
    while (this.gravityAcc >= 1) {
      this.gravityAcc -= 1;
      if (this.tryMove(0, 1)) {
        if (softHeld) softCells++;
      } else {
        this.gravityAcc = 0;
        break;
      }
    }
    if (softCells > 0) {
      this.score += softCells;
      this.emit({ type: "score", amount: softCells, total: this.score });
    }

    if (!this.canMove(0, 1)) {
      this.lockTimer += dt * 1000;
      if (this.lockTimer >= lockDelayMs(this.level)) this.lockPiece();
    } else {
      this.lockTimer = 0;
    }
  }

  snapshot(): Snapshot {
    return {
      grid: this.grid,
      active: this.active,
      ghostY: this.active ? this.ghostY() : 0,
      hold: this.hold,
      holdLocked: this.holdLocked,
      next: this.peekNext(6),
      clearing: this.clearing,
      clearT: this.clearT,
      score: this.score,
      lines: this.lines,
      level: this.level,
      timeMs: this.timeMs,
      combo: this.combo,
      b2b: this.b2b,
      lastClear: this.lastClear,
      phase: this.phase,
      landFlash: this.landFlash,
      pieces: this.pieces,
      deathCells: this.deathCells,
      deathReason: this.deathReason,
    };
  }

  visibleRow(y: number): number {
    return y - HIDDEN_ROWS;
  }

  isVisible(y: number): boolean {
    return y >= HIDDEN_ROWS && y < ROWS;
  }

  get VISIBLE_ROWS() {
    return VISIBLE_ROWS;
  }
}
