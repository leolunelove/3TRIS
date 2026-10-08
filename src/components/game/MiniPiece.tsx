import { cellsAt, paletteColors } from "@/lib/game/pieces";
import { pieceBounds } from "@/lib/game/renderer";
import type { Palette, PieceId } from "@/lib/game/types";

export function MiniPiece({
  id,
  dimmed = false,
  size = 14,
  palette = "standard",
}: {
  id: PieceId | null;
  dimmed?: boolean;
  size?: number;
  palette?: Palette;
}) {
  if (!id) {
    return <div className="mini-piece mini-piece-empty" aria-hidden />;
  }
  const { fill, shadow } = paletteColors(palette);
  const b = pieceBounds(id);
  const cells = cellsAt(id, 0, 0, 0);
  const w = b.w * size;
  const h = b.h * size;
  return (
    <svg
      className="mini-piece"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{ opacity: dimmed ? 0.35 : 1 }}
    >
      {cells.map((c, i) => {
        const x = (c.x - b.ox) * size;
        const y = (c.y - b.oy) * size;
        const g = Math.max(1, size * 0.08);
        return (
          <g key={i}>
            <rect x={x} y={y} width={size} height={size} fill={shadow[id]} />
            <rect
              x={x}
              y={y}
              width={size - g}
              height={size - g}
              fill={fill[id]}
            />
          </g>
        );
      })}
    </svg>
  );
}
