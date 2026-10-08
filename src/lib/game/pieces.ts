import type { PieceId, Point } from "./types";

/** SRS spawn orientations. Offsets relative to piece origin. */
export const SHAPES: Record<PieceId, Point[][]> = {
  I: [
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ],
    [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ],
    [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ],
  ],
  O: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  ],
  T: [
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
  S: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
    [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
  Z: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
    ],
  ],
  J: [
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
  ],
  L: [
    [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
};

/**
 * SRS wall-kick tables. Coordinates are y-up as in the Tetris guideline.
 * Apply as (dx, -dy) on a downward-row grid.
 */
const JLSTZ_KICKS: Record<string, [number, number][]> = {
  "0>1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "1>0": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "1>2": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "2>1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "2>3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "3>2": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "3>0": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "0>3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};

const I_KICKS: Record<string, [number, number][]> = {
  "0>1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "1>0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "1>2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "2>1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "2>3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "3>2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "3>0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "0>3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

const KICK_180: Record<string, [number, number][]> = {
  "0>2": [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
    [-1, 0],
    [-2, 0],
    [-1, 1],
    [-2, 1],
    [0, -1],
  ],
  "2>0": [
    [0, 0],
    [-1, 0],
    [-2, 0],
    [-1, -1],
    [-2, -1],
    [1, 0],
    [2, 0],
    [1, -1],
    [2, -1],
    [0, 1],
  ],
  "1>3": [
    [0, 0],
    [0, 1],
    [0, 2],
    [-1, 1],
    [-1, 2],
    [0, -1],
    [0, -2],
    [-1, -1],
    [-1, -2],
    [1, 0],
  ],
  "3>1": [
    [0, 0],
    [0, -1],
    [0, -2],
    [1, -1],
    [1, -2],
    [0, 1],
    [0, 2],
    [1, 1],
    [1, 2],
    [-1, 0],
  ],
};

export function getKicks180(id: PieceId, from: number): [number, number][] {
  if (id === "O") return [[0, 0]];
  const to = (from + 2) % 4;
  return KICK_180[`${from}>${to}`] ?? [[0, 0]];
}

export function getKicks(id: PieceId, from: number, to: number): [number, number][] {
  if (id === "O") return [[0, 0]];
  const key = `${from}>${to}`;
  const table = id === "I" ? I_KICKS : JLSTZ_KICKS;
  return table[key] ?? [[0, 0]];
}

export function spawnX(id: PieceId): number {
  return id === "O" ? 4 : 3;
}

export function cellsAt(id: PieceId, x: number, y: number, rot: number): Point[] {
  const shape = SHAPES[id][rot] ?? SHAPES[id][0];
  return shape.map((p) => ({ x: x + p.x, y: y + p.y }));
}

/** Tightly controlled, slightly earthy saturations — physical, not neon. */
export const PIECE_COLORS: Record<PieceId, string> = {
  I: "#2FBFB8",
  O: "#C9A227",
  T: "#8B6BAD",
  S: "#4FA06A",
  Z: "#C05656",
  J: "#3D74C2",
  L: "#C87438",
};

export const PIECE_SHADOW: Record<PieceId, string> = {
  I: "#1A8A85",
  O: "#8F7310",
  T: "#634A80",
  S: "#34754B",
  Z: "#8A3535",
  J: "#28538F",
  L: "#94531F",
};

/** High-separation set. S/Z and J/L no longer sit next to each other. */
export const CONTRAST_COLORS: Record<PieceId, string> = {
  I: "#56B4E9",
  O: "#F0E442",
  T: "#CC79A7",
  S: "#009E73",
  Z: "#D55E00",
  J: "#0072B2",
  L: "#E69F00",
};

export const CONTRAST_SHADOW: Record<PieceId, string> = {
  I: "#2A6F96",
  O: "#A89A1C",
  T: "#8A4C6E",
  S: "#006B4F",
  Z: "#8C3C00",
  J: "#004E7A",
  L: "#A36E00",
};

export function paletteColors(palette: "standard" | "contrast") {
  return palette === "contrast"
    ? { fill: CONTRAST_COLORS, shadow: CONTRAST_SHADOW }
    : { fill: PIECE_COLORS, shadow: PIECE_SHADOW };
}
