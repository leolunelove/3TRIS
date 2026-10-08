import type { Engine } from "./engine";
import type { Action, Settings } from "./types";

const BUFFER_MS = 110;

type Buffered = { action: "rotCW" | "rotCCW" | "rot180" | "hold" | "hard"; until: number };

export class Input {
  held = new Set<string>();
  dir: -1 | 0 | 1 = 0;
  dasCharged = false;
  dasReadyAt = 0;
  arrNext = 0;
  lastDirAt = 0;
  buffer: Buffered | null = null;
  rebinding: Action | null = null;
  settings: Settings;
  engine: Engine;
  now = 0;
  enabled = true;
  onAction: (a: Action, down: boolean) => void = () => {};

  constructor(engine: Engine, settings: Settings) {
    this.engine = engine;
    this.settings = settings;
    this.now = typeof performance !== "undefined" ? performance.now() : 0;
  }

  applySettings(s: Settings) {
    this.settings = s;
  }

  private codesFor(action: Action): string[] {
    return this.settings.bindings[action];
  }

  actionFor(code: string): Action | null {
    const entries = Object.entries(this.settings.bindings) as [Action, string[]][];
    for (const [action, codes] of entries) {
      if (codes.includes(code)) return action;
    }
    return null;
  }

  isGameCode(code: string): boolean {
    return this.actionFor(code) !== null;
  }

  resetDas() {
    this.dir = 0;
    this.dasCharged = false;
    this.dasReadyAt = 0;
    this.arrNext = 0;
  }

  clearHeld() {
    this.held.clear();
    this.resetDas();
  }

  stamp(now = typeof performance !== "undefined" ? performance.now() : this.now) {
    this.now = now;
  }

  private pressDir(dir: -1 | 1) {
    this.dir = dir;
    this.dasCharged = false;
    this.dasReadyAt = this.now + this.settings.dasMs;
    this.engine.tryMove(dir, 0);
  }

  private slideIfCharged() {
    if (!this.dasCharged || this.dir === 0) return;
    if (this.settings.arrMs <= 0) this.shiftOnce();
  }

  onKeyDown(code: string): Action | null {
    if (this.rebinding) return null;
    const action = this.actionFor(code);
    if (!action) return null;
    const already = this.held.has(code);
    this.held.add(code);
    if (already) return action;
    this.onAction(action, true);

    if (!this.enabled) return action;

    this.stamp();

    if (action === "left") this.pressDir(-1);
    else if (action === "right") this.pressDir(1);
    else if (action === "soft") {
      this.engine.tryMove(0, 1);
    } else if (action === "hard") {
      if (!this.tryHard()) this.buffer = { action: "hard", until: this.now + BUFFER_MS };
    } else if (action === "rotCW") {
      if (!this.engine.tryRotate(1)) this.buffer = { action: "rotCW", until: this.now + BUFFER_MS };
      else this.slideIfCharged();
    } else if (action === "rotCCW") {
      if (!this.engine.tryRotate(-1)) this.buffer = { action: "rotCCW", until: this.now + BUFFER_MS };
      else this.slideIfCharged();
    } else if (action === "rot180") {
      if (!this.engine.tryRotate180()) this.buffer = { action: "rot180", until: this.now + BUFFER_MS };
      else this.slideIfCharged();
    } else if (action === "hold") {
      if (!this.engine.holdPiece()) this.buffer = { action: "hold", until: this.now + BUFFER_MS };
    }
    return action;
  }

  onKeyUp(code: string) {
    this.held.delete(code);
    const action = this.actionFor(code);
    if (action) this.onAction(action, false);
    if (action === "left" || action === "right") {
      this.stamp();
      const left = this.isHeld("left");
      const right = this.isHeld("right");
      if (action === "left" && this.dir === -1) {
        if (right) this.pressDir(1);
        else this.resetDas();
      } else if (action === "right" && this.dir === 1) {
        if (left) this.pressDir(-1);
        else this.resetDas();
      }
    }
  }

  isHeld(action: Action): boolean {
    return this.codesFor(action).some((c) => this.held.has(c));
  }

  private tryHard(): boolean {
    if (this.engine.phase !== "playing" || this.engine.clearing.length) return false;
    this.engine.hardDrop();
    return true;
  }

  private flushBuffer() {
    if (!this.buffer) return;
    if (this.now > this.buffer.until) {
      this.buffer = null;
      return;
    }
    const a = this.buffer.action;
    let ok = false;
    if (a === "rotCW") ok = this.engine.tryRotate(1);
    else if (a === "rotCCW") ok = this.engine.tryRotate(-1);
    else if (a === "rot180") ok = this.engine.tryRotate180();
    else if (a === "hold") ok = this.engine.holdPiece();
    else if (a === "hard") ok = this.tryHard();
    if (ok) {
      this.buffer = null;
      this.slideIfCharged();
    }
  }

  tick(now: number) {
    this.now = now;
    if (!this.enabled) return;
    this.flushBuffer();
    if (this.dir === 0) return;
    if (!this.dasCharged) {
      if (now >= this.dasReadyAt) {
        this.dasCharged = true;
        this.shiftOnce();
        this.arrNext = now + Math.max(this.settings.arrMs, 0);
      }
      return;
    }
    if (this.settings.arrMs <= 0) {
      this.shiftOnce();
      return;
    }
    if (now >= this.arrNext) {
      this.shiftOnce();
      this.arrNext = now + this.settings.arrMs;
    }
  }

  private shiftOnce() {
    this.engine.tryMove(this.dir, 0, { silent: true });
  }

  softHeld(): boolean {
    return this.enabled && (this.isHeld("soft") || this.padSoft);
  }

  padDir: -1 | 0 | 1 = 0;
  padSoft = false;
  padPause = false;
  private padDown = new Set<string>();

  pollPad(now: number) {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((p) => p && p.mapping === "standard") ?? Array.from(pads).find(Boolean);
    if (!pad || !this.enabled) {
      if (this.padDir !== 0) this.releasePadDir();
      this.padSoft = false;
      this.padDown.clear();
      return;
    }
    this.stamp(now);
    const ax = pad.axes[0] ?? 0;
    const left = !!(pad.buttons[14]?.pressed || ax < -0.45);
    const right = !!(pad.buttons[15]?.pressed || ax > 0.45);
    const dir: -1 | 0 | 1 = left && !right ? -1 : right && !left ? 1 : 0;
    if (dir !== this.padDir) {
      this.releasePadDir();
      this.padDir = dir;
      if (dir !== 0) this.pressDir(dir);
    }
    this.padSoft = !!(pad.buttons[13]?.pressed || (pad.axes[1] ?? 0) > 0.55);
    const edges: [number, "rotCW" | "rotCCW" | "rot180" | "hold" | "hard" | "pause"][] = [
      [0, "hard"],
      [1, "rotCW"],
      [2, "rotCCW"],
      [4, "rot180"],
      [5, "rotCW"],
      [3, "hold"],
      [9, "pause"],
    ];
    for (const [i, action] of edges) {
      const down = !!pad.buttons[i]?.pressed;
      const key = `pad${i}`;
      if (down && !this.padDown.has(key)) {
        this.padDown.add(key);
        this.firePad(action);
      } else if (!down) this.padDown.delete(key);
    }
  }

  private releasePadDir() {
    if (this.padDir === 0) return;
    const was = this.padDir;
    this.padDir = 0;
    if (this.dir !== was) return;
    const left = this.isHeld("left");
    const right = this.isHeld("right");
    if (was === -1 && right) this.pressDir(1);
    else if (was === 1 && left) this.pressDir(-1);
    else this.resetDas();
  }

  private firePad(action: "rotCW" | "rotCCW" | "rot180" | "hold" | "hard" | "pause") {
    if (action === "pause") {
      this.padPause = true;
      return;
    }
    if (action === "hard") {
      if (!this.tryHard()) this.buffer = { action: "hard", until: this.now + BUFFER_MS };
    } else if (action === "rotCW") {
      if (!this.engine.tryRotate(1)) this.buffer = { action: "rotCW", until: this.now + BUFFER_MS };
      else this.slideIfCharged();
    } else if (action === "rotCCW") {
      if (!this.engine.tryRotate(-1)) this.buffer = { action: "rotCCW", until: this.now + BUFFER_MS };
      else this.slideIfCharged();
    } else if (action === "rot180") {
      if (!this.engine.tryRotate180()) this.buffer = { action: "rot180", until: this.now + BUFFER_MS };
      else this.slideIfCharged();
    } else if (action === "hold") {
      if (!this.engine.holdPiece()) this.buffer = { action: "hold", until: this.now + BUFFER_MS };
    }
  }
}
