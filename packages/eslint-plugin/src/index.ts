import {
  extractFacts,
  resolveConfig,
  RULE_LIST,
  runFileRules,
  type Diagnostic,
  type ResolvedConfig,
  type RuleMeta,
  type TriadArchitectureConfig,
} from "@triad/core";
import tsParser from "@typescript-eslint/parser";
import type { ESLint, Linter, Rule } from "eslint";

/**
 * The same rules that run in `triad build`, now in the editor.
 *
 * Each ESLint rule maps to an MVVM code. They all share a single analysis per
 * file (cached by AST), so enabling all of them costs the same as enabling one.
 */

type Settings = TriadArchitectureConfig & { root?: string };

const configCache = new Map<string, ResolvedConfig>();
const resultCache = new WeakMap<object, Diagnostic[]>();

function configFor(context: Rule.RuleContext): ResolvedConfig {
  const settings = (context.settings?.triad ?? {}) as Settings;
  const root = settings.root ?? context.cwd;
  const key = JSON.stringify([root, settings]);
  let config = configCache.get(key);
  if (!config) {
    config = resolveConfig(root, settings).config;
    configCache.set(key, config);
  }
  return config;
}

function diagnosticsFor(context: Rule.RuleContext): Diagnostic[] {
  const ast = context.sourceCode.ast;
  let diagnostics = resultCache.get(ast);
  if (!diagnostics) {
    // The @typescript-eslint/parser AST is TSESTree, the same one @triad/core uses.
    const facts = extractFacts(ast as unknown as Parameters<typeof extractFacts>[0]);
    diagnostics = runFileRules(context.filename, facts, configFor(context));
    resultCache.set(ast, diagnostics);
  }
  return diagnostics;
}

function createRule(meta: RuleMeta): Rule.RuleModule {
  return {
    meta: {
      type: "problem",
      docs: { description: `${meta.code}: ${meta.summary}` },
      messages: { violation: "{{message}} {{fix}} ({{code}} · triad explain {{code}})" },
      schema: [],
    },
    create(context) {
      return {
        "Program:exit"() {
          for (const d of diagnosticsFor(context)) {
            if (d.code !== meta.code) continue;
            const firstStep = meta.fix(d.data)[0] ?? "";
            context.report({
              messageId: "violation",
              data: { message: d.message.replace(/`/g, "'"), fix: `→ ${firstStep.replace(/`/g, "'")}`, code: d.code },
              loc: d.range
                ? {
                    start: { line: d.range.start.line, column: d.range.start.column - 1 },
                    end: { line: d.range.end.line, column: d.range.end.column - 1 },
                  }
                : { line: 1, column: 0 },
            });
          }
        },
      };
    },
  };
}

const fileRules = RULE_LIST.filter((meta) => meta.scope === "file" && meta.category !== "config");

const rules: Record<string, Rule.RuleModule> = Object.fromEntries(fileRules.map((meta) => [meta.slug, createRule(meta)]));

const plugin = {
  meta: { name: "@triad/eslint-plugin", version: "0.1.0" },
  rules,
  configs: {} as Record<string, Linter.Config[]>,
} satisfies ESLint.Plugin;

plugin.configs.recommended = [
  {
    name: "triad/recommended",
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser as Linter.Parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: { triad: plugin as ESLint.Plugin },
    rules: Object.fromEntries(
      fileRules.map((meta) => [`triad/${meta.slug}`, meta.severity === "error" ? "error" : "warn"]),
    ) as Linter.RulesRecord,
  },
];

export default plugin;
export { rules };
