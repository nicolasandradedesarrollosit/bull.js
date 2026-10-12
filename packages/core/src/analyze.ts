import fs from "node:fs";
import path from "node:path";
import { type BullArchitectureConfig, type ResolvedConfig, resolveConfig } from "./config";
import { extractFacts, type ModuleFacts, parseModule } from "./facts";
import { classifyFile } from "./layers";
import { isCodeFile, normalizePath } from "./paths";
import { runFileRules } from "./rules/file-rules";
import { type ProjectFile, runCycleRule, runStructureRules } from "./rules/project-rules";
import type { Diagnostic, FileKind } from "./types";

export interface AnalysisResult {
  config: ResolvedConfig;
  files: ProjectFile[];
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  /** Number of files per kind. */
  stats: Record<FileKind, number>;
  durationMs: number;
  /** Source of an analyzed file (for code frames). */
  readSource(file: string): string | undefined;
}

interface CacheEntry {
  mtimeMs: number;
  size: number;
  source: string;
  facts: ModuleFacts | null;
  parseError?: Diagnostic;
}

/**
 * Analyzes a whole project. Parsing is cached per file (by mtime and size),
 * so re-analyzing after a change in dev is cheap.
 */
export class ProjectAnalyzer {
  readonly config: ResolvedConfig;
  readonly #configDiagnostics: Diagnostic[];
  readonly #cache = new Map<string, CacheEntry>();

  constructor(root: string, userConfig?: BullArchitectureConfig) {
    const { config, diagnostics } = resolveConfig(root, userConfig);
    this.config = config;
    this.#configDiagnostics = diagnostics;
  }

  /** Forgets the cached parse of one file (or all of them). */
  invalidate(file?: string): void {
    if (file) this.#cache.delete(normalizePath(file));
    else this.#cache.clear();
  }

  analyze(): AnalysisResult {
    const started = performance.now();
    const { config } = this;
    const paths = scan(config.srcDir);
    if (fs.existsSync(config.compositionRoot) && !paths.includes(config.compositionRoot))
      paths.push(config.compositionRoot);

    const seen = new Set(paths);
    for (const cached of this.#cache.keys()) if (!seen.has(cached)) this.#cache.delete(cached);

    const files: ProjectFile[] = [];
    const diagnostics: Diagnostic[] = [...this.#configDiagnostics];
    const stats: Record<FileKind, number> = {
      model: 0,
      viewmodel: 0,
      view: 0,
      root: 0,
      allowed: 0,
      outside: 0,
      ignored: 0,
    };

    for (const file of paths) {
      const kind = classifyFile(file, config);
      stats[kind]++;
      if (kind === "ignored") {
        files.push({ file, kind, facts: null });
        continue;
      }
      const entry = this.#load(file);
      if (!entry) continue;
      files.push({ file, kind, facts: entry.facts });
      if (entry.parseError) diagnostics.push(entry.parseError);
    }

    const exists = (p: string) => seen.has(p);
    for (const f of files) diagnostics.push(...runFileRules(f.file, f.facts, config, exists));
    diagnostics.push(...runStructureRules(config, files), ...runCycleRule(config, files));

    diagnostics.sort(compareDiagnostics);
    return {
      config,
      files,
      diagnostics,
      errorCount: diagnostics.filter((d) => d.severity === "error").length,
      warningCount: diagnostics.filter((d) => d.severity === "warning").length,
      stats,
      durationMs: performance.now() - started,
      readSource: (file) => this.#cache.get(normalizePath(file))?.source,
    };
  }

  #load(file: string): CacheEntry | undefined {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      return undefined;
    }
    const cached = this.#cache.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;

    const source = fs.readFileSync(file, "utf8");
    let entry: CacheEntry;
    try {
      entry = { mtimeMs: stat.mtimeMs, size: stat.size, source, facts: extractFacts(parseModule(source, file)) };
    } catch (error) {
      const e = error as { message?: string; lineNumber?: number; column?: number };
      const line = e.lineNumber ?? 1;
      const column = (e.column ?? 0) + 1;
      entry = {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        source,
        facts: null,
        parseError: {
          code: "MVVM901",
          severity: "error",
          message: e.message ?? String(error),
          file,
          range: { start: { line, column }, end: { line, column: column + 1 } },
          data: {},
        },
      };
    }
    this.#cache.set(file, entry);
    return entry;
  }
}

export function analyzeProject(root: string, userConfig?: BullArchitectureConfig): AnalysisResult {
  return new ProjectAnalyzer(root, userConfig).analyze();
}

function scan(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = normalizePath(path.join(dir, entry.name));
    if (entry.isDirectory()) out.push(...scan(full));
    else if (isCodeFile(entry.name)) out.push(full);
  }
  return out.sort();
}

function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  if (!a.file !== !b.file) return a.file ? 1 : -1;
  if (a.file && b.file && a.file !== b.file) return a.file < b.file ? -1 : 1;
  const la = a.range?.start.line ?? 0;
  const lb = b.range?.start.line ?? 0;
  if (la !== lb) return la - lb;
  return (a.range?.start.column ?? 0) - (b.range?.start.column ?? 0);
}
