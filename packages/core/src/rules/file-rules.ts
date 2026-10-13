import path from "node:path";
import type { ResolvedConfig } from "../config";
import { type ImportFact, IO_PACKAGES, isDomGlobal, isIoGlobal, type ModuleFacts } from "../facts";
import { classifyFile, type ImportTarget, LAYER_LABEL, NAMING, resolveImport } from "../layers";
import { isCodeFile, normalizePath, toPascalCase } from "../paths";
import type { Diagnostic, FileKind, Range, RuleCode } from "../types";
import { RULES } from "./meta";

/** Hooks the View cannot use: state and effects live in the ViewModel. */
export const FORBIDDEN_VIEW_HOOKS = new Set([
  "useState",
  "useReducer",
  "useEffect",
  "useLayoutEffect",
  "useInsertionEffect",
  "useMemo",
  "useSyncExternalStore",
  "useActionState",
  "useOptimistic",
]);

const ARRAY_LOGIC = new Set([
  "filter",
  "reduce",
  "reduceRight",
  "sort",
  "toSorted",
  "find",
  "findLast",
  "some",
  "every",
  "flatMap",
]);
const VM_PARAM = /^(vm|viewModel)$|(Vm|ViewModel)$/;
const REACT_PACKAGES = /^(react|react-dom|preact)(\/|$)/;

interface Ctx {
  file: string;
  kind: FileKind;
  facts: ModuleFacts;
  config: ResolvedConfig;
  target(imp: ImportFact): ImportTarget;
  report(code: RuleCode, range: Range | undefined, message: string, data?: Record<string, string>): void;
}

const FILE_START: Range = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

/**
 * Runs every rule that can be evaluated by looking at a single file.
 * `exists` lets imports resolve to their real extension (ESLint does not need it).
 */
export function runFileRules(
  file: string,
  facts: ModuleFacts | null,
  config: ResolvedConfig,
  exists?: (file: string) => boolean,
): Diagnostic[] {
  const abs = normalizePath(file);
  const kind = classifyFile(abs, config);
  const diagnostics: Diagnostic[] = [];
  const targets = new Map<ImportFact, ImportTarget>();

  const ctx: Ctx = {
    file: abs,
    kind,
    facts: facts ?? emptyFacts(),
    config,
    target(imp) {
      let t = targets.get(imp);
      if (!t) {
        t = resolveImport(abs, imp.source, config, exists);
        targets.set(imp, t);
      }
      return t;
    },
    report(code, range, message, data = {}) {
      const configured = config.rules.get(code);
      if (configured === "off") return;
      diagnostics.push({ code, severity: configured ?? RULES[code].severity, message, file: abs, range, data });
    },
  };

  if (kind === "ignored" || kind === "root") return diagnostics;
  if (kind === "outside" || kind === "allowed") {
    if (kind === "outside" && abs.startsWith(`${config.srcDir}/`) && isCodeFile(abs)) {
      const rel = path.posix.relative(config.root, abs);
      ctx.report("MVVM002", FILE_START, `\`${rel}\` does not belong to any layer.`, { file: rel });
    }
    return diagnostics;
  }

  checkNaming(ctx);
  if (!facts) return diagnostics;
  checkDependencies(ctx);
  if (kind === "view") checkView(ctx);
  if (kind === "viewmodel") checkViewModel(ctx);
  if (kind === "model") checkModel(ctx);
  return diagnostics;
}

function emptyFacts(): ModuleFacts {
  return {
    imports: [],
    jsx: null,
    hooks: [],
    globals: [],
    calls: [],
    members: [],
    assignments: [],
    news: [],
    declarators: [],
    destructurings: [],
    params: [],
    classes: [],
  };
}

// ─── Naming (MVVM003) ─────────────────────────────────────────────────────────

export function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function checkNaming(ctx: Ctx): void {
  const layer = ctx.kind as "model" | "viewmodel" | "view";
  if (!isCodeFile(ctx.file)) return;
  const { suffixes, extension } = NAMING[layer];
  const base = path.posix.basename(ctx.file);
  const ext = path.posix.extname(base);
  const stem = base.slice(0, -ext.length);
  const hasSuffix = suffixes.some((s) => stem.endsWith(s) && stem.length > s.length);
  if (hasSuffix && ext === extension) return;

  const cleanStem = toKebab(
    stem
      .replace(/\.(model|repository|service|entity|types|viewmodel|view)$/i, "")
      .replace(/(ViewModel|View|Model)$/, ""),
  );
  const suggested = `${cleanStem || "name"}${suffixes[0]}${extension}`;
  const expected = suffixes.map((s) => `*${s}${extension}`).join(", ");
  const reason =
    ext !== extension
      ? ext === ".tsx" && layer !== "view"
        ? `is .tsx, but there can be no JSX in the ${LAYER_LABEL[layer]} layer`
        : `has the ${ext} extension, but the ${LAYER_LABEL[layer]} layer uses ${extension}`
      : `does not follow the ${LAYER_LABEL[layer]} layer convention`;
  ctx.report("MVVM003", FILE_START, `\`${base}\` ${reason}.`, { file: base, expected, suggested });
}

// ─── Dependencies (MVVM100-106 and the import side of 103/104/205/400) ────────

function importedNames(imp: ImportFact): string {
  const names = imp.specifiers.map((s) => (s.imported === "default" ? s.local : s.imported));
  return names.length ? names.join(", ") : imp.source;
}

export function expectedViewModelName(viewFile: string): string {
  const stem = path.posix
    .basename(viewFile)
    .replace(/\.view\.tsx$/, "")
    .replace(/\.[^.]+$/, "");
  return `${toPascalCase(stem)}ViewModel`;
}

function checkDependencies(ctx: Ctx): void {
  for (const imp of ctx.facts.imports) {
    const t = ctx.target(imp);
    if (t.type === "package") {
      checkPackageImport(ctx, imp, t.name);
      continue;
    }
    if (t.kind === "root") {
      ctx.report("MVVM106", imp.range, `This file imports the composition root (\`${imp.source}\`).`, {
        source: imp.source,
      });
      continue;
    }
    if (ctx.kind === "view" && t.kind === "model") {
      const imported = importedNames(imp);
      ctx.report(
        "MVVM100",
        imp.range,
        imp.typeOnly
          ? `The View imports the type \`${imported}\` directly from the Model.`
          : `The View imports \`${imported}\` directly from the Model.`,
        {
          imported,
          source: imp.source,
          modelPath: imp.source,
          typeOnly: String(imp.typeOnly),
          viewModel: expectedViewModelName(ctx.file),
        },
      );
    } else if (ctx.kind === "viewmodel" && t.kind === "view") {
      ctx.report("MVVM101", imp.range, `The ViewModel imports \`${importedNames(imp)}\` from the View.`, {
        source: imp.source,
      });
    } else if (ctx.kind === "model" && (t.kind === "viewmodel" || t.kind === "view")) {
      ctx.report(
        "MVVM102",
        imp.range,
        `The Model imports \`${importedNames(imp)}\` from the ${LAYER_LABEL[t.kind]} layer.`,
        {
          source: imp.source,
          targetLayer: t.kind,
        },
      );
    }
  }
}

function checkPackageImport(ctx: Ctx, imp: ImportFact, pkg: string): void {
  const isReact = REACT_PACKAGES.test(imp.source) || imp.source === "@bull-js/runtime/react";
  if (ctx.kind === "view") {
    if (imp.source === "@bull-js/runtime" && !imp.typeOnly) {
      const values = imp.specifiers.filter((s) => !s.typeOnly).map((s) => s.imported);
      if (values.length || imp.specifiers.length === 0) {
        ctx.report(
          "MVVM205",
          imp.range,
          `The View imports \`${values.join(", ") || "@bull-js/runtime"}\` from the reactive runtime.`,
          {
            imported: values.join(", ") || "@bull-js/runtime",
          },
        );
      }
    }
    if (IO_PACKAGES.has(pkg)) {
      ctx.report("MVVM200", imp.range, `The View imports \`${pkg}\`, a data access library.`, { api: pkg });
    }
  } else if (ctx.kind === "viewmodel") {
    if (isReact) {
      ctx.report("MVVM103", imp.range, `The ViewModel imports \`${imp.source}\`.`, {
        source: imp.source,
        what: "import",
      });
    } else if (IO_PACKAGES.has(pkg)) {
      ctx.report("MVVM305", imp.range, `The ViewModel imports \`${pkg}\` to access data directly.`, { api: pkg });
    }
  } else if (ctx.kind === "model") {
    if (isReact) {
      ctx.report("MVVM104", imp.range, `The Model imports \`${imp.source}\`.`, { source: imp.source });
    } else if (imp.source === "@bull-js/runtime" || imp.source.startsWith("@bull-js/runtime/")) {
      ctx.report("MVVM400", imp.range, `The Model imports \`${importedNames(imp)}\` from @bull-js/runtime.`, {
        imported: importedNames(imp),
      });
    }
  }
}

// ─── View (MVVM200-206) ───────────────────────────────────────────────────────

function checkView(ctx: Ctx): void {
  const { facts } = ctx;
  const viewModel = expectedViewModelName(ctx.file);

  const reportedIo = new Set<string>();
  for (const g of facts.globals) {
    if (!isIoGlobal(g.name) || reportedIo.has(g.name)) continue;
    reportedIo.add(g.name);
    ctx.report("MVVM200", g.range, `The View uses \`${g.name}\`.`, { api: g.name });
  }

  for (const hook of facts.hooks) {
    if (!FORBIDDEN_VIEW_HOOKS.has(hook.name) || ctx.config.view.allowHooks.has(hook.name)) continue;
    ctx.report("MVVM201", hook.range, `The View uses \`${hook.name}\`.`, { hook: hook.name, viewModel });
  }

  const vmLocals = viewModelLocals(facts);
  /** How deep inside the ViewModel a chain reaches: `vm.count.set` and a destructured `count.set` are both 2. */
  const vmDepth = (chain: { root: string | null; path: string[] }): number | null => {
    const prefix = chain.root ? vmLocals.get(chain.root) : undefined;
    return prefix ? prefix.length + chain.path.length - 1 : null;
  };
  const bindingLocals = new Set([
    ...facts.declarators.filter((d) => d.callee === "useBinding").map((d) => d.name),
    ...facts.destructurings
      .filter((d) => "callee" in d.init && d.init.callee === "useBinding")
      .flatMap((d) => d.bindings.map((b) => b.local)),
  ]);

  const assignedAt = new Set<string>();
  for (const a of facts.assignments) {
    // A member of the ViewModel: `vm.count.value = 3`, or `count.value = 3` after destructuring it.
    if (vmDepth(a) === null || a.path.length < 2) continue;
    assignedAt.add(`${a.range.start.line}:${a.range.start.column}`);
    ctx.report("MVVM202", a.range, `The View assigns \`${a.path.join(".")}\`.`, { target: `${a.path.join(".")} = …` });
  }
  for (const c of facts.calls) {
    const last = c.path.at(-1);
    const depth = vmDepth(c);
    if (depth !== null && depth >= 2 && (last === "set" || last === "update")) {
      ctx.report("MVVM202", c.range, `The View calls \`${c.path.join(".")}()\`.`, { target: `${c.path.join(".")}(…)` });
    }
    if (c.root && bindingLocals.has(c.root) && c.path.length === 2 && last && ARRAY_LOGIC.has(last)) {
      ctx.report("MVVM203", c.range, `The View runs \`${c.path.join(".")}(…)\` on ViewModel data.`, {
        method: last,
        binding: c.root,
      });
    }
  }

  for (const m of facts.members) {
    const prefix = m.root ? vmLocals.get(m.root) : undefined;
    if (!prefix) continue;
    // `.value` of something inside the ViewModel: `vm.count.value`, `count.value`, `all.count.value`.
    const valueAt = m.path.indexOf("value");
    if (valueAt < 1 || prefix.length + valueAt < 2) continue;
    if (assignedAt.has(`${m.range.start.line}:${m.range.start.column}`)) continue;
    const binding = m.path.slice(0, valueAt).join(".");
    ctx.report("MVVM206", m.range, `The View reads \`${binding}.value\` without subscribing.`, {
      target: `${binding}.value`,
      binding,
    });
  }

  const viewModelImports = importedLocals(ctx, "viewmodel");
  for (const n of facts.news) {
    if (viewModelImports.has(n.name)) {
      ctx.report("MVVM204", n.range, `The View creates \`new ${n.name}(…)\`.`, { name: n.name });
    }
  }
}

/**
 * Every local that holds the ViewModel or a part of it, with its path inside the ViewModel:
 * `const vm = useViewModel(X)` → `[]`, `const { pay } = useViewModel(X)` → `["pay"]`, and then
 * `const { isRunning } = pay` → `["pay", "isRunning"]`. Parameters named like a ViewModel count too.
 */
function viewModelLocals(facts: ModuleFacts): Map<string, string[]> {
  const locals = new Map<string, string[]>();
  const fromViewModel = (callee: string) => callee === "useViewModel" || callee === "useChildViewModel";
  for (const d of facts.declarators) if (fromViewModel(d.callee)) locals.set(d.name, []);
  for (const p of facts.params) if (VM_PARAM.test(p)) locals.set(p, []);
  for (const d of facts.destructurings) {
    if (!("callee" in d.init) || !fromViewModel(d.init.callee)) continue;
    for (const b of d.bindings) locals.set(b.local, b.path);
  }
  // Destructuring a local that already comes from the ViewModel, possibly in several steps.
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of facts.destructurings) {
      if (!("chain" in d.init)) continue;
      const [root, ...rest] = d.init.chain;
      const prefix = root ? locals.get(root) : undefined;
      if (!prefix) continue;
      for (const b of d.bindings) {
        if (locals.has(b.local)) continue;
        locals.set(b.local, [...prefix, ...rest, ...b.path]);
        changed = true;
      }
    }
  }
  return locals;
}

/** Local names imported as values from files of the given layer. */
function importedLocals(ctx: Ctx, layer: FileKind, sourceFilter?: (imp: ImportFact) => boolean): Set<string> {
  const names = new Set<string>();
  for (const imp of ctx.facts.imports) {
    const t = ctx.target(imp);
    if (t.type !== "file" || t.kind !== layer || (sourceFilter && !sourceFilter(imp))) continue;
    for (const s of imp.specifiers) if (!s.typeOnly) names.add(s.local);
  }
  return names;
}

// ─── ViewModel (MVVM103, 300-305) ─────────────────────────────────────────────

function checkViewModel(ctx: Ctx): void {
  const { facts } = ctx;
  if (facts.jsx) ctx.report("MVVM103", facts.jsx, "The ViewModel contains JSX.", { what: "jsx" });

  const reported = new Set<string>();
  for (const g of facts.globals) {
    if (reported.has(g.name)) continue;
    if (isDomGlobal(g.name)) {
      reported.add(g.name);
      ctx.report("MVVM301", g.range, `The ViewModel uses \`${g.name}\`.`, { api: g.name });
    } else if (isIoGlobal(g.name)) {
      reported.add(g.name);
      ctx.report("MVVM305", g.range, `The ViewModel uses \`${g.name}\` directly.`, { api: g.name });
    }
  }

  const stem = path.posix
    .basename(ctx.file)
    .replace(/\.viewmodel\.ts$/, "")
    .replace(/\.[^.]+$/, "");
  const expected = `${toPascalCase(stem)}ViewModel`;
  const exported = facts.classes.filter((c) => c.exported);
  const isVm = (superClass: string | null) =>
    !!superClass && (superClass === "ViewModel" || superClass.endsWith("ViewModel"));
  const viewModels = exported.filter((c) => isVm(c.superClass));

  for (const cls of exported) {
    if (!isVm(cls.superClass)) {
      ctx.report("MVVM300", cls.range, `The class \`${cls.name ?? "(anonymous)"}\` does not extend ViewModel.`, {
        className: cls.name ?? expected,
      });
    }
  }
  if (exported.length === 0) {
    ctx.report("MVVM300", FILE_START, `This file does not export any ViewModel (expected \`${expected}\`).`, {
      className: expected,
    });
  }
  viewModels.forEach((cls, i) => {
    if (i > 0) {
      ctx.report("MVVM303", cls.range, `\`${cls.name}\` is ViewModel #${i + 1} in this file.`, {});
    } else if (cls.name !== expected) {
      ctx.report(
        "MVVM303",
        cls.range,
        `The file is \`${path.posix.basename(ctx.file)}\` but the class is \`${cls.name}\`.`,
        {
          found: cls.name ?? "",
          expected,
        },
      );
    }
  });

  for (const cls of facts.classes.filter((c) => isVm(c.superClass))) {
    for (const m of cls.members) {
      if (m.static || m.access !== "public") continue;
      if (m.kind === "field") {
        if (m.init === "state") {
          ctx.report("MVVM302", m.range, `\`${m.name}\` is a public State: the View could write to it.`, {
            member: m.name,
            kind: "state",
          });
        } else if (!m.readonly) {
          ctx.report("MVVM302", m.range, `\`${m.name}\` is a public field that can be reassigned.`, {
            member: m.name,
            kind: "mutable",
          });
        }
      } else if (m.kind === "param-property") {
        ctx.report("MVVM302", m.range, `The dependency \`${m.name}\` is public and the View could use it.`, {
          member: m.name,
          kind: "param",
        });
      }
    }
  }

  const dependencyImports = importedLocals(ctx, "model", (imp) => /\.(repository|service)(\.[jt]s)?$/.test(imp.source));
  const modelImports = importedLocals(ctx, "model");
  for (const n of facts.news) {
    if (
      dependencyImports.has(n.name) ||
      (modelImports.has(n.name) && /(Repository|Service|Api|Client|Gateway)$/.test(n.name))
    ) {
      ctx.report("MVVM304", n.range, `The ViewModel creates \`new ${n.name}(…)\` instead of receiving it.`, {
        name: n.name,
      });
    }
  }
}

// ─── Model (MVVM400, 401) ─────────────────────────────────────────────────────

function checkModel(ctx: Ctx): void {
  const reported = new Set<string>();
  for (const g of ctx.facts.globals) {
    if (!isDomGlobal(g.name) || reported.has(g.name)) continue;
    reported.add(g.name);
    ctx.report("MVVM401", g.range, `The Model uses \`${g.name}\`.`, { api: g.name });
  }
}
