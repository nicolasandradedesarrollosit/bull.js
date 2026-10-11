import fs from "node:fs";
import path from "node:path";
import type { ResolvedConfig } from "../config";
import type { ModuleFacts } from "../facts";
import { LAYERS, resolveImport } from "../layers";
import type { Diagnostic, FileKind, Range, RuleCode } from "../types";
import { RULES } from "./meta";

export interface ProjectFile {
  file: string;
  kind: FileKind;
  facts: ModuleFacts | null;
}

function make(
  config: ResolvedConfig,
  code: RuleCode,
  message: string,
  data: Record<string, string>,
  extra: Partial<Diagnostic> = {},
): Diagnostic | null {
  const configured = config.rules.get(code);
  if (configured === "off") return null;
  return { code, severity: configured ?? RULES[code].severity, message, data, ...extra };
}

/** Expected folder tree, marking what is missing. */
function layerTree(config: ResolvedConfig, present: Set<string>): string[] {
  const src = path.posix.relative(config.root, config.srcDir) || "src";
  const lines = [`${src}/`];
  LAYERS.forEach((layer, i) => {
    const branch = i === LAYERS.length - 1 ? "└──" : "├──";
    const mark = present.has(layer) ? "✓" : "✗ missing";
    lines.push(`${branch} ${(layer + "/").padEnd(12)} ${mark}`);
  });
  return lines;
}

export function runStructureRules(config: ResolvedConfig, files: ProjectFile[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const push = (d: Diagnostic | null) => d && out.push(d);

  const present = new Set(
    LAYERS.filter((layer) => {
      try {
        return fs.statSync(path.posix.join(config.srcDir, layer)).isDirectory();
      } catch {
        return false;
      }
    }),
  );
  const tree = layerTree(config, present);
  for (const layer of LAYERS) {
    const dir = path.posix.relative(config.root, path.posix.join(config.srcDir, layer));
    if (!present.has(layer)) {
      push(make(config, "MVVM001", `The \`${dir}/\` folder is missing.`, { missing: layer, dir }, { notes: tree }));
    } else if (!files.some((f) => f.kind === layer)) {
      push(make(config, "MVVM004", `The \`${dir}/\` folder has no files.`, { layer, dir }));
    }
  }

  if (!fs.existsSync(config.compositionRoot)) {
    const rel = path.posix.relative(config.root, config.compositionRoot);
    push(make(config, "MVVM005", `\`${rel}\` does not exist.`, { file: rel }));
  }
  return out;
}

/** MVVM105: import cycles (type-only imports do not count because they disappear at compile time). */
export function runCycleRule(config: ResolvedConfig, files: ProjectFile[]): Diagnostic[] {
  const known = new Set(files.map((f) => f.file));
  const edges = new Map<string, Array<{ to: string; range: Range }>>();
  for (const f of files) {
    if (!f.facts || f.kind === "ignored") continue;
    const list: Array<{ to: string; range: Range }> = [];
    for (const imp of f.facts.imports) {
      if (imp.typeOnly) continue;
      const t = resolveImport(f.file, imp.source, config, (p) => known.has(p));
      if (t.type === "file" && t.resolved) list.push({ to: t.resolved, range: imp.range });
    }
    edges.set(f.file, list);
  }

  const out: Diagnostic[] = [];
  for (const scc of stronglyConnected([...edges.keys()], (n) => (edges.get(n) ?? []).map((e) => e.to))) {
    const selfLoop = scc.length === 1 && (edges.get(scc[0]!) ?? []).some((e) => e.to === scc[0]);
    if (scc.length < 2 && !selfLoop) continue;
    const members = new Set(scc);
    const start = [...scc].sort()[0]!;
    const cyclePath = findCycle(start, members, (n) => (edges.get(n) ?? []).map((e) => e.to));
    const next = cyclePath[1] ?? start;
    const edge = (edges.get(start) ?? []).find((e) => e.to === next);
    const pretty = cyclePath.map((p) => path.posix.relative(config.root, p)).join(" → ");
    const d = make(config, "MVVM105", `Cycle of ${cyclePath.length - 1} module(s).`, { cycle: pretty }, { file: start, range: edge?.range });
    if (d) out.push(d);
  }
  return out;
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
function findCycle(start: string, members: Set<string>, next: (n: string) => string[]): string[] {
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
