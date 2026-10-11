import path from "node:path";
import type { AnalysisResult } from "../analyze";
import { RULES, type RuleCategory } from "../rules/meta";
import type { Diagnostic, FileKind, RuleCode, Severity } from "../types";
import { buildFrame, type FrameLine } from "./frame";

export interface SerializedDiagnostic {
  code: RuleCode;
  slug: string;
  severity: Severity;
  category: RuleCategory;
  title: string;
  message: string;
  /** Path relative to the project root. */
  file?: string;
  absoluteFile?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  why: string;
  fix: string[];
  notes?: string[];
  explain: string;
  frame?: FrameLine[];
}

export interface SerializedResult {
  version: 1;
  ok: boolean;
  errorCount: number;
  warningCount: number;
  stats: Record<FileKind, number>;
  diagnostics: SerializedDiagnostic[];
}

export function serializeDiagnostic(
  d: Diagnostic,
  root: string,
  readSource?: (file: string) => string | undefined,
): SerializedDiagnostic {
  const meta = RULES[d.code];
  const source = d.file && readSource ? readSource(d.file) : undefined;
  return {
    code: d.code,
    slug: meta.slug,
    severity: d.severity,
    category: meta.category,
    title: meta.title,
    message: d.message,
    file: d.file ? path.posix.relative(root, d.file) : undefined,
    absoluteFile: d.file,
    line: d.range?.start.line,
    column: d.range?.start.column,
    endLine: d.range?.end.line,
    endColumn: d.range?.end.column,
    why: meta.why,
    fix: meta.fix(d.data),
    notes: d.notes,
    explain: `triad explain ${d.code}`,
    frame: source && d.range ? buildFrame(source, d.range) : undefined,
  };
}

export function serializeResult(result: AnalysisResult, options: { frames?: boolean } = {}): SerializedResult {
  const read = options.frames === false ? undefined : result.readSource;
  return {
    version: 1,
    ok: result.errorCount === 0,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    stats: result.stats,
    diagnostics: result.diagnostics.map((d) => serializeDiagnostic(d, result.config.root, read)),
  };
}
