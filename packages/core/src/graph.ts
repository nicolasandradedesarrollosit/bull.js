import path from "node:path";
import type { AnalysisResult } from "./analyze";
import type { ResolvedConfig } from "./config";
import type { ModuleFacts } from "./facts";
import { resolveImport } from "./layers";
import type { FileKind, Range, RuleCode } from "./types";

export interface ProjectFile {
  file: string;
  kind: FileKind;
  facts: ModuleFacts | null;
}

export interface FileEdge {
  from: string;
  to: string;
  source: string;
  range: Range;
  /** `import type`: erased at compile time, so it never forms a runtime cycle. */
  typeOnly: boolean;
}

/** Edges between project files (imports that resolve to a known file). */
export function fileEdges(config: ResolvedConfig, files: ProjectFile[]): FileEdge[] {
  const known = new Set(files.map((f) => f.file));
  const edges: FileEdge[] = [];
  for (const f of files) {
    if (!f.facts || f.kind === "ignored") continue;
    for (const imp of f.facts.imports) {
      const t = resolveImport(f.file, imp.source, config, (p) => known.has(p));
      if (t.type === "file" && t.resolved) {
        edges.push({ from: f.file, to: t.resolved, source: imp.source, range: imp.range, typeOnly: imp.typeOnly });
      }
    }
  }
  return edges;
}

/**
 * Runtime import cycles. Each cycle is a path that starts and ends at the same
 * file, starting from the alphabetically first file of the cycle.
 */
export function findCycles(edges: FileEdge[]): string[][] {
  const next = new Map<string, string[]>();
  for (const e of edges) {
    if (e.typeOnly) continue;
    if (!next.has(e.from)) next.set(e.from, []);
    next.get(e.from)!.push(e.to);
  }
  const out = (n: string) => next.get(n) ?? [];
  const cycles: string[][] = [];
  for (const scc of stronglyConnected([...next.keys()], out)) {
    const selfLoop = scc.length === 1 && out(scc[0]!).includes(scc[0]!);
    if (scc.length < 2 && !selfLoop) continue;
    const start = [...scc].sort()[0]!;
    cycles.push(shortestCycle(start, new Set(scc), out));
  }
  return cycles;
}

/** Tarjan: strongly connected components. */
function stronglyConnected(nodes: string[], next: (n: string) => string[]): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const result: string[][] = [];

  const visit = (v: string) => {
    indices.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of next(v)) {
      if (!indices.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, indices.get(w)!));
      }
    }
    if (low.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      result.push(component);
    }
  };
  for (const n of nodes) if (!indices.has(n)) visit(n);
  return result;
}

/** Shortest path that leaves `start` and returns to it without leaving the component. */
function shortestCycle(start: string, members: Set<string>, next: (n: string) => string[]): string[] {
  const prev = new Map<string, string>();
  const queue = [start];
  while (queue.length) {
    const node = queue.shift()!;
    for (const w of next(node)) {
      if (!members.has(w)) continue;
      if (w === start) {
        const chain: string[] = [];
        for (let cur = node; cur !== start; cur = prev.get(cur)!) chain.unshift(cur);
        return [start, ...chain, start];
      }
      if (!prev.has(w)) {
        prev.set(w, node);
        queue.push(w);
      }
    }
  }
  return [start, start];
}

// ─── Import graph for tooling (`bull graph`) ─────────────────────────────────

export interface GraphNode {
  file: string;
  /** Path relative to the project root. */
  rel: string;
  kind: FileKind;
}

export interface GraphEdge {
  from: string;
  to: string;
  typeOnly: boolean;
  /** The dependency-direction rule this edge breaks, if any. */
  violation?: RuleCode;
  /** Whether the edge is part of a runtime import cycle (MVVM105). */
  inCycle: boolean;
}

export interface ImportGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles: string[][];
}

/** Which dependency-direction rule an edge between two kinds of file breaks. */
export function edgeViolation(from: FileKind, to: FileKind): RuleCode | undefined {
  if (to === "root" && from !== "root") return "MVVM106";
  if (from === "view" && to === "model") return "MVVM100";
  if (from === "viewmodel" && to === "view") return "MVVM101";
  if (from === "model" && (to === "viewmodel" || to === "view")) return "MVVM102";
  return undefined;
}

export function buildImportGraph(result: AnalysisResult): ImportGraph {
  const { config } = result;
  const files = result.files.filter((f) => f.kind !== "ignored" && f.facts);
  const kindOf = new Map(files.map((f) => [f.file, f.kind]));
  const raw = fileEdges(config, files);
  const cycles = findCycles(raw);
  const cycleEdges = new Set<string>();
  for (const cycle of cycles) for (let i = 0; i < cycle.length - 1; i++) cycleEdges.add(`${cycle[i]}→${cycle[i + 1]}`);

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const e of raw) {
    const key = `${e.from}→${e.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      from: e.from,
      to: e.to,
      typeOnly: e.typeOnly,
      violation: edgeViolation(kindOf.get(e.from)!, kindOf.get(e.to) ?? "outside"),
      inCycle: cycleEdges.has(key),
    });
  }
  return {
    nodes: files.map((f) => ({ file: f.file, rel: path.posix.relative(config.root, f.file), kind: f.kind })),
    edges,
    cycles,
  };
}
