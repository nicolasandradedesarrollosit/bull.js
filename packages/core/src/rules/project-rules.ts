import fs from "node:fs";
import path from "node:path";
import type { ResolvedConfig } from "../config";
import { fileEdges, findCycles, type ProjectFile } from "../graph";
import { LAYERS } from "../layers";
import type { Diagnostic, RuleCode } from "../types";
import { RULES } from "./meta";

export type { ProjectFile };

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
    lines.push(`${branch} ${(`${layer}/`).padEnd(12)} ${mark}`);
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
  const edges = fileEdges(config, files);
  const out: Diagnostic[] = [];
  for (const cycle of findCycles(edges)) {
    const [start, next] = cycle as [string, string];
    const edge = edges.find((e) => e.from === start && e.to === next && !e.typeOnly);
    const pretty = cycle.map((p) => path.posix.relative(config.root, p)).join(" → ");
    const d = make(
      config,
      "MVVM105",
      `Cycle of ${cycle.length - 1} module(s).`,
      { cycle: pretty },
      { file: start, range: edge?.range },
    );
    if (d) out.push(d);
  }
  return out;
}
