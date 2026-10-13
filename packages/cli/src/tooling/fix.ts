import fs from "node:fs";
import path from "node:path";
import {
  type AnalysisResult,
  type Diagnostic,
  fileEdges,
  formatSummary,
  isAutoFixable,
  type Position,
  ProjectAnalyzer,
  stripExtension,
  toKebab,
} from "@bull-js/core";
import pc from "picocolors";
import { banner } from "../commands/shared";
import { loadBullConfig } from "../config";

interface TextEdit {
  start: number;
  end: number;
  text: string;
}

export interface FixOutcome {
  code: string;
  file: string;
  /** What was done, or why it was skipped. */
  message: string;
  applied: boolean;
}

export interface FixPlan {
  outcomes: FixOutcome[];
  /** New content per (original) absolute path. */
  contents: Map<string, string>;
  /** Original path → new path. */
  renames: Map<string, string>;
}

function offsetAt(source: string, pos: Position): number {
  let offset = 0;
  for (let line = 1; line < pos.line; line++) {
    const next = source.indexOf("\n", offset);
    if (next < 0) return source.length;
    offset = next + 1;
  }
  return offset + pos.column - 1;
}

function applyEdits(source: string, edits: TextEdit[]): string {
  let out = source;
  let lastStart = Infinity;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    if (e.end > lastStart) continue; // overlapping edit: keep the first one only
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    lastStart = e.start;
  }
  return out;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Computes the safe automatic fixes for the analysis result, without writing anything.
 * Supported: MVVM003 (rename + import updates), MVVM302 (privatize/readonly) and
 * MVVM100 for type-only imports (re-export through the ViewModel).
 */
export function planFixes(result: AnalysisResult): FixPlan {
  const { config } = result;
  const rel = (f: string) => path.posix.relative(config.root, f);
  const sources = new Map<string, string>();
  const source = (file: string) => {
    if (!sources.has(file)) sources.set(file, result.readSource(file) ?? fs.readFileSync(file, "utf8"));
    return sources.get(file)!;
  };
  const edits = new Map<string, TextEdit[]>();
  const addEdit = (file: string, edit: TextEdit) => {
    if (!edits.has(file)) edits.set(file, []);
    edits.get(file)!.push(edit);
  };
  const outcomes: FixOutcome[] = [];
  const renames = new Map<string, string>();
  const done = (d: Diagnostic, message: string, applied = true) =>
    outcomes.push({ code: d.code, file: rel(d.file!), message, applied });

  for (const d of result.diagnostics) {
    if (!d.file || !isAutoFixable(d)) continue;
    const src = source(d.file);

    if (d.code === "MVVM302" && d.range) {
      const start = offsetAt(src, d.range.start);
      const end = offsetAt(src, d.range.end);
      const text = src.slice(start, end);
      const name = d.data.member!;
      if (d.data.kind === "state") {
        if (src.includes(`#${name}`)) {
          done(d, `skipped: \`#${name}\` already exists`, false);
          continue;
        }
        const init = /=\s*([\s\S]*?);?\s*$/.exec(text)?.[1];
        if (!init) {
          done(d, "skipped: could not read the initializer", false);
          continue;
        }
        const lineStart = src.lastIndexOf("\n", start) + 1;
        const indent = /^[ \t]*/.exec(src.slice(lineStart))![0];
        addEdit(d.file, {
          start,
          end,
          text: `readonly #${name} = ${init};\n${indent}readonly ${name} = this.#${name}.readonly;`,
        });
        for (const m of src.matchAll(new RegExp(`this\\.${escapeRegExp(name)}\\b`, "g"))) {
          if (m.index! >= start && m.index! < end) continue;
          addEdit(d.file, { start: m.index!, end: m.index! + m[0].length, text: `this.#${name}` });
        }
        done(d, `made \`${name}\` private and exposed \`${name}\` as a read-only view`);
      } else if (d.data.kind === "mutable") {
        const modifiers = /^((?:(?:public|override|declare)\s+)*)/.exec(text)![1]!;
        addEdit(d.file, { start: start + modifiers.length, end: start + modifiers.length, text: "readonly " });
        done(d, `marked \`${name}\` as readonly`);
      } else if (d.data.kind === "param") {
        const fixed = text.replace(/^(?:(?:public|private|protected|readonly)\s+)*/, "private readonly ");
        addEdit(d.file, { start, end, text: fixed });
        done(d, `made the dependency \`${name}\` private readonly`);
      }
      continue;
    }

    if (d.code === "MVVM100" && d.range) {
      const vmName = d.data.viewModel!;
      const vmFile = path.posix.join(
        config.srcDir,
        "viewmodel",
        `${toKebab(vmName.replace(/ViewModel$/, ""))}.viewmodel.ts`,
      );
      if (!fs.existsSync(vmFile)) {
        done(d, `skipped: there is no ${rel(vmFile)} to re-export the type from`, false);
        continue;
      }
      const modelTarget = path.posix.join(path.posix.dirname(d.file), d.data.source!);
      let fromVm = path.posix.relative(path.posix.dirname(vmFile), modelTarget);
      if (!fromVm.startsWith(".")) fromVm = `./${fromVm}`;
      const names = d.data.imported!;
      const vmSource = source(vmFile);
      if (!vmSource.includes(`export type { ${names} }`)) {
        const lastImport = [...vmSource.matchAll(/^import[^;]*;[ \t]*$/gm)].at(-1);
        const at = lastImport ? lastImport.index! + lastImport[0].length + 1 : 0;
        addEdit(vmFile, { start: at, end: at, text: `export type { ${names} } from "${fromVm}";\n` });
      }
      let toVm = stripExtension(path.posix.relative(path.posix.dirname(d.file), vmFile));
      if (!toVm.startsWith(".")) toVm = `./${toVm}`;
      const start = offsetAt(src, d.range.start);
      const end = offsetAt(src, d.range.end);
      const statement = src.slice(start, end);
      addEdit(d.file, { start, end, text: statement.replace(/(["'])[^"']+\1/, `$1${toVm}$1`) });
      done(d, `the View now imports \`${names}\` from ${vmName}, which re-exports it`);
      continue;
    }

    if (d.code === "MVVM003") {
      const target = path.posix.join(path.posix.dirname(d.file), d.data.suggested!);
      if (fs.existsSync(target) || [...renames.values()].includes(target)) {
        done(d, `skipped: ${rel(target)} already exists`, false);
        continue;
      }
      renames.set(d.file, target);
      const oldSegment = stripExtension(path.posix.basename(d.file));
      const newSegment = stripExtension(path.posix.basename(target));
      let updated = 0;
      for (const e of fileEdges(config, result.files)) {
        if (e.to !== d.file) continue;
        const importer = source(e.from);
        const at = offsetAt(importer, e.range.start);
        const statement = importer.slice(at, offsetAt(importer, e.range.end));
        const quoted = new RegExp(`(["'])([^"']*?)${escapeRegExp(oldSegment)}(\\.[jt]sx?)?\\1`);
        const match = quoted.exec(statement);
        if (!match) continue;
        const replacement = `${match[1]}${match[2]}${newSegment}${match[3] && d.data.suggested!.endsWith(match[3]) ? match[3] : ""}${match[1]}`;
        addEdit(e.from, { start: at + match.index, end: at + match.index + match[0].length, text: replacement });
        updated++;
      }
      done(d, `renamed to ${rel(target)}${updated ? ` and updated ${updated} import${updated === 1 ? "" : "s"}` : ""}`);
    }
  }

  const contents = new Map<string, string>();
  for (const [file, list] of edits) contents.set(file, applyEdits(source(file), list));
  return { outcomes, contents, renames };
}

/** Writes a plan to disk. */
export function applyFixPlan(plan: FixPlan): void {
  for (const [file, content] of plan.contents) fs.writeFileSync(file, content);
  for (const [from, to] of plan.renames) fs.renameSync(from, to);
}

/** A line diff (LCS) printed as one hunk per changed block, without context lines. */
export function miniDiff(before: string, after: string, colors = pc.isColorSupported): string {
  const c = pc.createColors(colors);
  const a = before.split("\n");
  const b = after.split("\n");
  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  let inHunk = false;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
      inHunk = false;
      continue;
    }
    if (!inHunk) {
      out.push(c.cyan(`@@ line ${j + 1} @@`));
      inHunk = true;
    }
    // On ties, removals go first so each hunk reads "- old / + new".
    if (i < a.length && (j >= b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) out.push(c.red(`- ${a[i++]}`));
    else out.push(c.green(`+ ${b[j++]}`));
  }
  return out.map((l) => `      ${l}`).join("\n");
}

export async function fixCommand(rootArg: string | undefined, options: { dryRun?: boolean }): Promise<void> {
  banner(options.dryRun ? "fix (dry run)" : "fix");
  const root = path.resolve(rootArg ?? ".");
  const { config } = await loadBullConfig(root, "serve");
  const analyzer = new ProjectAnalyzer(root, config);
  const before = analyzer.analyze();
  const plan = planFixes(before);
  const rel = (f: string) => path.posix.relative(analyzer.config.root, f);

  if (plan.outcomes.length === 0) {
    const fixable = before.diagnostics.length;
    console.log(
      fixable
        ? `  ${pc.dim("Nothing to fix automatically.")} ${fixable} diagnostic(s) need a human: run ${pc.cyan("bull check")}.`
        : `  ${pc.green("✓")} Nothing to fix: the architecture is clean.`,
    );
    return;
  }

  for (const o of plan.outcomes) {
    const mark = o.applied ? pc.green(options.dryRun ? "○" : "✔") : pc.yellow("·");
    console.log(`  ${mark} ${pc.dim(o.code)}  ${o.file}  ${o.applied ? o.message : pc.yellow(o.message)}`);
  }

  if (options.dryRun) {
    console.log();
    for (const [file, content] of plan.contents) {
      const original = before.readSource(file) ?? fs.readFileSync(file, "utf8");
      console.log(
        `    ${pc.bold(rel(file))}${plan.renames.has(file) ? pc.dim(` → ${rel(plan.renames.get(file)!)}`) : ""}`,
      );
      console.log(`${miniDiff(original, content)}\n`);
    }
    for (const [from, to] of plan.renames) {
      if (!plan.contents.has(from)) console.log(`    ${pc.bold(rel(from))} ${pc.dim("→")} ${rel(to)}\n`);
    }
    console.log(`  ${pc.dim("Dry run: nothing was written. Run")} ${pc.cyan("bull fix")} ${pc.dim("to apply.")}`);
    return;
  }

  applyFixPlan(plan);
  analyzer.invalidate();
  const after = analyzer.analyze();
  console.log(`\n${formatSummary(after)}`);
  if (after.diagnostics.length)
    console.log(`\n  ${pc.dim("Run")} ${pc.cyan("bull check")} ${pc.dim("for the details of what is left.")}`);
  if (after.errorCount > 0) process.exitCode = 1;
}
