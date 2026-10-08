import { cellsAt, paletteColors } from "./pieces";
import { COLS, HIDDEN_ROWS, VISIBLE_ROWS } from "./types";
import type { Juice } from "./juice";
import type { PieceId, Settings, Snapshot } from "./types";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cell = 32;
  dpr = 1;
  w = 0;
  h = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = cssW;
    this.h = cssH;
    this.cell = cssW / COLS;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private drawCell(
    x: number,
    y: number,
    color: string,
    shadow: string,
    opts: { ghost?: boolean; flash?: number; alpha?: number; squash?: number },
  ) {
    const ctx = this.ctx;
    const s = this.cell;
    const gap = Math.max(1.25, s * 0.06);
    let px = x * s + gap / 2;
    let py = y * s + gap / 2;
    const pw = s - gap;
    let ph = s - gap;
    if (opts.squash && opts.squash < 0.999) {
      const nh = ph * opts.squash;
      py += ph - nh;
      ph = nh;
    }
    const alpha = opts.alpha ?? 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (opts.ghost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.18;
      ctx.fillRect(px, py, pw, ph);
      ctx.restore();
      return;
    }

    ctx.fillStyle = shadow;
    ctx.fillRect(px, py, pw, ph);

    const face = opts.flash ? mix(color, "#f4f4f0", opts.flash) : color;
    ctx.fillStyle = face;
    const inset = Math.max(0.8, s * 0.04);
    ctx.fillRect(px, py, pw - inset, ph - inset);

    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, "rgba(255,255,255,0.14)");
    g.addColorStop(0.45, "rgba(255,255,255,0.02)");
    g.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw - inset, ph - inset);

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(px, py, pw - inset, Math.max(1, s * 0.045));
    ctx.fillRect(px, py, Math.max(1, s * 0.045), ph - inset);

    ctx.restore();
  }

  draw(snap: Snapshot, settings: Settings, juice: Juice) {
    const ctx = this.ctx;
    const s = this.cell;
    const w = this.w;
    const h = this.h;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#101012";
    ctx.fillRect(0, 0, w, h);

    // Recessed well vignette
    const vg = ctx.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, "rgba(255,255,255,0.025)");
    vg.addColorStop(0.15, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(juice.offsetX, juice.offsetY);

    if (settings.gridVisible) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(236,236,232,0.045)";
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.moveTo(x * s + 0.5, 0);
        ctx.lineTo(x * s + 0.5, h);
      }
      for (let y = 1; y < VISIBLE_ROWS; y++) {
        ctx.moveTo(0, y * s + 0.5);
        ctx.lineTo(w, y * s + 0.5);
      }
      ctx.stroke();
    }

    const { fill, shadow } = paletteColors(settings.palette ?? "standard");
    const death = new Set((snap.deathCells ?? []).map((c) => `${c.x},${c.y}`));
    const flashMap = new Map<string, number>();
    if (snap.landFlash) {
      for (const c of snap.landFlash.cells) {
        flashMap.set(`${c.x},${c.y}`, snap.landFlash.t);
      }
    }

    for (let y = HIDDEN_ROWS; y < HIDDEN_ROWS + VISIBLE_ROWS; y++) {
      const row = snap.grid[y];
      if (!row) continue;
      const visY = y - HIDDEN_ROWS;
      const clearing = snap.clearing.includes(y);
      for (let x = 0; x < COLS; x++) {
        const cell = row[x];
        if (!cell) continue;
        let flash = flashMap.get(`${x},${y}`) ?? 0;
        if (clearing) {
          const t = 1 - snap.clearT;
          flash = Math.max(flash, t < 0.55 ? 0.85 : 0.2);
        }
        const color = clearing ? mix(fill[cell.id], "#f7f7f2", Math.min(1, flash + 0.4)) : fill[cell.id];
        this.drawCell(x, visY, color, shadow[cell.id], {
          flash: death.has(`${x},${y}`) ? Math.max(flash, 0.55) : flash,
          alpha: clearing ? 0.35 + snap.clearT * 0.65 : 1,
          squash: flashMap.has(`${x},${y}`) && !settings.reducedMotion ? juice.squash : 1,
        });
      }
    }

    if (snap.clearing.length && !settings.reducedMotion) {
      ctx.fillStyle = `rgba(220,255,245,${snap.clearT * 0.3})`;
      for (const y of snap.clearing) ctx.fillRect(0, (y - HIDDEN_ROWS) * s, w, s);
    }

    if (snap.phase === "over" && death.size) {
      ctx.save();
      ctx.strokeStyle = "rgba(247,247,242,0.85)";
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      for (const key of death) {
        const [x, y] = key.split(",").map(Number);
        if (y < HIDDEN_ROWS || y >= HIDDEN_ROWS + VISIBLE_ROWS) continue;
        const visY = y - HIDDEN_ROWS;
        ctx.strokeRect(x * s + 2, visY * s + 2, s - 4, s - 4);
      }
      ctx.restore();
    }

    const p = snap.active;
    if (p && snap.phase !== "over") {
      const ghostOpacity = settings.ghostOpacity;
      if (ghostOpacity > 0 && snap.ghostY !== p.y) {
        const gcells = cellsAt(p.id, p.x, snap.ghostY, p.rot);
        for (const c of gcells) {
          if (c.y < HIDDEN_ROWS) continue;
          this.drawCell(c.x, c.y - HIDDEN_ROWS, mix(fill[p.id], "#eaf9f2", 0.3), shadow[p.id], {
            ghost: true,
            alpha: Math.min(1, ghostOpacity * 1.9),
          });
        }
      }
      const cells = cellsAt(p.id, p.x, p.y, p.rot);
      const squash = juice.squash;
      for (const c of cells) {
        if (c.y < HIDDEN_ROWS) continue;
        this.drawCell(c.x, c.y - HIDDEN_ROWS, fill[p.id], shadow[p.id], {
          squash,
          flash: juice.impact * 0.35,
        });
      }
    }

    if (juice.flash > 0) {
      ctx.fillStyle = `rgba(247,247,242,${juice.flash * 0.07})`;
      ctx.fillRect(-8, -8, w + 16, h + 16);
    }

    ctx.restore();

    // Inner rim
    ctx.strokeStyle = "rgba(236,236,232,0.06)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }
}

export function pieceBounds(id: PieceId): { w: number; h: number; ox: number; oy: number } {
  const cells = cellsAt(id, 0, 0, 0);
  let minX = 99,
    minY = 99,
    maxX = -99,
    maxY = -99;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1, ox: minX, oy: minY };
}
