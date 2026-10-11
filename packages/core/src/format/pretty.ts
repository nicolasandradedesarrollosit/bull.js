import pc from "picocolors";
import type { AnalysisResult } from "../analyze";
import { RULES, RULE_LIST, type RuleMeta } from "../rules/meta";
import type { RuleCode } from "../types";
import { serializeDiagnostic, type SerializedDiagnostic } from "./serialize";

export interface PrettyOptions {
  colors?: boolean;
  /** Maximum line width. Defaults to 88. */
  width?: number;
}

type Colors = ReturnType<typeof pc.createColors>;

function colorsFor(options: PrettyOptions): Colors {
  return pc.createColors(options.colors ?? pc.isColorSupported);
}

/** Wraps a paragraph into lines of at most `width` characters. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  // Text between backticks is never split, even if it has spaces.
  for (const word of text.match(/(?:[^\s`]*`[^`]*`)+[^\s`]*|\S+/g) ?? []) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Highlights text between backticks. */
function code(text: string, c: Colors): string {
  return text.replace(/`([^`]+)`/g, (_, inner: string) => c.cyan(inner));
}

export function formatDiagnostic(d: SerializedDiagnostic, options: PrettyOptions = {}): string {
  const c = colorsFor(options);
  const width = options.width ?? 88;
  const tone = d.severity === "error" ? c.red : c.yellow;
  const out: string[] = [];

  const location = d.file ? `${d.file}${d.line ? `:${d.line}:${d.column}` : ""}` : "";
  const left = `── ${d.title} `;
  const right = ` ${location}${location ? "  " : ""}${d.code}`;
  const fill = Math.max(3, width - left.length - right.length);
  out.push(tone(c.bold(left)) + tone("─".repeat(fill)) + c.dim(right));
  out.push("");
  out.push(`  ${c.bold(code(d.message, c))}`);
  out.push("");

  if (d.frame?.length) {
    const gutter = String(d.frame.at(-1)!.line).length;
    for (const line of d.frame) {
      const num = String(line.line).padStart(gutter);
      if (line.highlight) {
        out.push(`  ${tone(c.bold(num))} ${c.dim("│")} ${line.text}`);
        const [from, to] = line.highlight;
        out.push(`  ${" ".repeat(gutter)} ${c.dim("│")} ${" ".repeat(from - 1)}${tone("^".repeat(Math.max(1, to - from)))}`);
      } else {
        out.push(`  ${c.dim(num)} ${c.dim("│")} ${c.dim(line.text)}`);
      }
    }
    out.push("");
  }

  for (const line of d.notes ?? []) out.push(`    ${line.includes("✗") ? line.replace(/✗.*$/, (m) => c.red(m)) : line.replace(/✓/, c.green("✓"))}`);
  if (d.notes?.length) out.push("");

  for (const line of wrap(d.why, width - 4)) out.push(`  ${code(line, c)}`);
  out.push("");

  out.push(`  ${c.bold(c.green("How to fix:"))}`);
  let step = 0;
  for (const item of d.fix) {
    if (item.startsWith("  ")) {
      out.push(`       ${code(item.trimStart(), c)}`);
      continue;
    }
    const [first = "", ...rest] = wrap(item, width - 7);
    out.push(`    ${c.green(`${++step}.`)} ${code(first, c)}`);
    for (const line of rest) out.push(`       ${code(line, c)}`);
  }
  out.push("");
  if (d.fixable) out.push(`  ${c.cyan("✦")} Auto-fixable: run ${c.cyan("bull fix")}`);
  out.push(c.dim(`  More info: ${d.explain}`));
  return out.join("\n");
}

const EDGE: Partial<Record<RuleCode, string>> = {
  MVVM100: "View ──▶ Model",
  MVVM101: "ViewModel ──▶ View",
  MVVM102: "Model ──▶ upper layer",
  MVVM103: "ViewModel ──▶ React",
  MVVM104: "Model ──▶ React",
  MVVM105: "import cycle",
  MVVM106: "layer ──▶ composition root",
};

/** "VIEW OWNS STATE" → "View owns state". */
export function sentenceCase(title: string): string {
  const lower = title.toLowerCase();
  return (lower.charAt(0).toUpperCase() + lower.slice(1))
    .replace(/\bviewmodel\b/gi, "ViewModel")
    .replace(/\bview\b/gi, "View")
    .replace(/\bmodel\b/gi, "Model")
    .replace(/\b(dom|jsx)\b/gi, (m) => m.toUpperCase())
    .replace(/\bi\/o\b/gi, "I/O")
    .replace(/\breact\b/gi, "React")
    .replace(/\bnew\b/gi, "new");
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatSummary(result: AnalysisResult, options: PrettyOptions = {}): string {
  const c = colorsFor(options);
  const { stats } = result;
  const total = stats.model + stats.viewmodel + stats.view + stats.root;
  const ms = `${Math.round(result.durationMs)}ms`;

  if (result.diagnostics.length === 0) {
    return (
      `  ${c.green("✓")} ${c.bold("MVVM architecture ok")} ${c.dim("·")} ${plural(total, "file", "files")} ` +
      c.dim(`(model ${stats.model} · viewmodel ${stats.viewmodel} · view ${stats.view}) · ${ms}`)
    );
  }

  const out: string[] = [];
  const files = new Set(result.diagnostics.map((d) => d.file ?? "(project)")).size;
  const parts = [];
  if (result.errorCount) parts.push(c.red(plural(result.errorCount, "error", "errors")));
  if (result.warningCount) parts.push(c.yellow(plural(result.warningCount, "warning", "warnings")));
  const icon = result.errorCount ? c.red("✗") : c.yellow("!");
  out.push(`  ${icon} ${c.bold("MVVM architecture:")} ${parts.join(", ")} in ${plural(files, "file", "files")} ${c.dim(`· ${ms}`)}`);
  out.push("");
  out.push(`  ${c.dim("Allowed direction:")}  ${c.green("View ──▶ ViewModel ──▶ Model")}`);

  const counts = new Map<RuleCode, number>();
  for (const d of result.diagnostics) counts.set(d.code, (counts.get(d.code) ?? 0) + 1);
  const edges = [...counts].filter(([code]) => EDGE[code]);
  if (edges.length) {
    out.push(`  ${c.dim("Dependencies that break the direction:")}`);
    for (const [code, n] of edges) {
      out.push(`    ${c.red("✗")} ${EDGE[code]!.padEnd(28)} ${c.dim(`×${n}`.padEnd(5))} ${c.dim(code)}`);
    }
  }
  const others = [...counts].filter(([code]) => !EDGE[code]);
  if (others.length) {
    out.push(`  ${c.dim("Other rules:")}`);
    for (const [code, n] of others) {
      const meta = RULES[code];
      const mark = meta.severity === "error" ? c.red("✗") : c.yellow("!");
      out.push(`    ${mark} ${sentenceCase(meta.title).padEnd(36)} ${c.dim(`×${n}`.padEnd(5))} ${c.dim(code)}`);
    }
  }
  return out.join("\n");
}

/** The full report: every diagnostic followed by the summary. */
export function formatReport(result: AnalysisResult, options: PrettyOptions = {}): string {
  const blocks = result.diagnostics.map((d) =>
    formatDiagnostic(serializeDiagnostic(d, result.config.root, result.readSource), options),
  );
  return [...blocks, formatSummary(result, options)].join("\n\n") + "\n";
}

// ─── bull explain ────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<RuleMeta["category"], string> = {
  structure: "Structure",
  dependencies: "Dependency direction",
  view: "View",
  viewmodel: "ViewModel",
  model: "Model",
  config: "Configuration",
};

export function formatExplain(meta: RuleMeta, options: PrettyOptions = {}): string {
  const c = colorsFor(options);
  const width = options.width ?? 88;
  const out: string[] = [];
  out.push(`${c.bold(meta.code)} ${c.dim("·")} ${c.bold(meta.title)} ${c.dim(`(${meta.slug})`)}`);
  const sev = meta.severity === "error" ? c.red("error") : c.yellow("warning");
  out.push(
    c.dim(`${CATEGORY_LABEL[meta.category]} · `) +
      sev +
      c.dim(` · ${meta.configurable ? "configurable" : "cannot be disabled"} · ${meta.scope === "file" ? "also in ESLint" : "build/check only"}${meta.fixable ? " · auto-fixable" : ""}`),
  );
  out.push("");
  for (const line of wrap(meta.summary, width)) out.push(c.bold(line));
  out.push("");
  out.push(c.bold("Why"));
  for (const line of wrap(meta.why, width - 2)) out.push(`  ${code(line, c)}`);
  out.push("");
  out.push(c.bold("How to fix"));
  let step = 0;
  for (const item of meta.fix({})) {
    if (item.startsWith("  ")) {
      out.push(`     ${code(item.trimStart(), c)}`);
      continue;
    }
    const [first = "", ...rest] = wrap(item, width - 5);
    out.push(`  ${c.green(`${++step}.`)} ${code(first, c)}`);
    for (const line of rest) out.push(`     ${code(line, c)}`);
  }
  if (meta.example) {
    out.push("");
    out.push(c.red("✗ Don't"));
    for (const line of meta.example.bad.split("\n")) out.push(`  ${c.dim("│")} ${line}`);
    out.push("");
    out.push(c.green("✓ Do"));
    for (const line of meta.example.good.split("\n")) out.push(`  ${c.dim("│")} ${line}`);
  }
  return out.join("\n") + "\n";
}

export function formatRuleList(options: PrettyOptions = {}): string {
  const c = colorsFor(options);
  const out: string[] = [c.bold("Bull architecture rules"), ""];
  let category = "";
  for (const meta of RULE_LIST) {
    if (meta.category !== category) {
      category = meta.category;
      out.push(c.bold(CATEGORY_LABEL[meta.category]));
    }
    const sev = meta.severity === "error" ? c.red("●") : c.yellow("●");
    const lock = meta.configurable ? "  " : "🔒";
    out.push(`  ${sev} ${c.bold(meta.code)} ${lock} ${meta.summary}`);
  }
  out.push("");
  out.push(c.dim("🔒 = part of the MVVM core, cannot be disabled.  Details: bull explain <code>"));
  return out.join("\n") + "\n";
}

export function ruleToMarkdown(meta: RuleMeta): string {
  const out: string[] = [];
  out.push(`# ${meta.code} · ${sentenceCase(meta.title)}`);
  out.push("");
  out.push(
    `> **${CATEGORY_LABEL[meta.category]}** · ${meta.severity === "error" ? "error" : "warning"} · ` +
      `${meta.configurable ? "configurable" : "cannot be disabled"} · ESLint rule: \`bull/${meta.slug}\``,
  );
  out.push("");
  out.push(meta.summary);
  out.push("");
  out.push("## Why");
  out.push("");
  out.push(meta.why);
  out.push("");
  out.push("## How to fix");
  out.push("");
  let step = 0;
  for (const item of meta.fix({})) {
    if (item.startsWith("  ")) out.push(`   - ${item.trim()}`);
    else out.push(`${++step}. ${item}`);
  }
  if (meta.example) {
    out.push("");
    out.push("## Example");
    out.push("");
    out.push("❌ Don't:");
    out.push("");
    out.push("```tsx", meta.example.bad, "```");
    out.push("");
    out.push("✅ Do:");
    out.push("");
    out.push("```tsx", meta.example.good, "```");
  }
  return out.join("\n") + "\n";
}
