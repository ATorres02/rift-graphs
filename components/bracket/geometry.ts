/**
 * Fixed sizes of the bracket boxes, in px. Heights are fixed so the connector
 * lines can be drawn on the server; column widths stay fluid because each set of
 * connectors lives in its own fixed-width gap.
 */
export const G = {
  /** One series: two teams side by side. */
  cell: 44,
  cellGap: 6,
  /** Date, format and record line above a group. */
  head: 22,
  blockGap: 18,
  /** Row of teams in a qualified, eliminated or champion box. */
  outcome: 40,
  /** Width of the connector gap between two columns. */
  gap: 20,
  colMin: 164,
  /** Column title ("Round 1"). */
  title: 28,
} as const;

export interface Placed {
  top: number;
  height: number;
  /** Vertical centre of the box body, where connector lines meet it. */
  anchor: number;
}

export const groupHeight = (cells: number) => G.head + cells * G.cell + Math.max(0, cells - 1) * G.cellGap;
export const outcomeHeight = () => G.head + G.outcome;
export const stackHeight = (heights: number[]) =>
  heights.reduce((a, b) => a + b, 0) + Math.max(0, heights.length - 1) * G.blockGap;

export const placeAt = (top: number, height: number): Placed => ({
  top,
  height,
  anchor: top + G.head + (height - G.head) / 2,
});

/** Stacks boxes top to bottom, centred in a column of `height`. */
export function stack(heights: number[], height: number): Placed[] {
  let top = (height - stackHeight(heights)) / 2;
  return heights.map((h) => {
    const p = placeAt(top, h);
    top += h + G.blockGap;
    return p;
  });
}

/** Minimum width of a bracket with `columns` columns, so phones scroll instead of squeezing it. */
export const bracketMinWidth = (columns: number) => columns * G.colMin + (columns - 1) * G.gap;
