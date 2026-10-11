import type { Range } from "../types";

export interface FrameLine {
  line: number;
  text: string;
  /** Columns [from, to) to underline (1-based), only on the main line. */
  highlight?: [number, number];
}

/** The lines around a range, ready to draw a code frame. */
export function buildFrame(source: string, range: Range, context = 1): FrameLine[] {
  const lines = source.split(/\r?\n/);
  const { start, end } = range;
  const first = Math.max(1, start.line - context);
  const last = Math.min(lines.length, start.line + context);
  const frame: FrameLine[] = [];
  for (let n = first; n <= last; n++) {
    const raw = lines[n - 1] ?? "";
    const text = raw.replace(/\t/g, "  ");
    const line: FrameLine = { line: n, text };
    if (n === start.line) {
      const tabShift = (col: number) => col + (raw.slice(0, col - 1).match(/\t/g)?.length ?? 0);
      const from = tabShift(start.column);
      const to = end.line === start.line ? tabShift(Math.max(end.column, start.column + 1)) : text.length + 1;
      line.highlight = [from, Math.max(to, from + 1)];
    }
    frame.push(line);
  }
  // Do not show blank lines at the start or end of the context.
  while (frame.length > 1 && !frame[0]!.highlight && frame[0]!.text.trim() === "") frame.shift();
  while (frame.length > 1 && !frame.at(-1)!.highlight && frame.at(-1)!.text.trim() === "") frame.pop();
  return frame;
}
