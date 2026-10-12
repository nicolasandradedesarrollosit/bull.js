import fs from "node:fs";
import path from "node:path";
import { type AnalysisResult, LAYER_LABEL, type MemberFact, ProjectAnalyzer } from "@bull/core";
import pc from "picocolors";
import { banner } from "../commands/shared";
import { loadBullConfig } from "../config";

export interface ViewModelInfo {
  name: string;
  file: string;
  state: string[];
  computed: string[];
  commands: string[];
  values: string[];
  methods: string[];
  injects: string[];
  usedBy: string[];
}

export interface ProjectInfo {
  name: string;
  root: string;
  configFile?: string;
  counts: Record<"model" | "viewmodel" | "view", number>;
  viewModels: ViewModelInfo[];
  views: Array<{ name: string; file: string; binds: string[] }>;
  overrides: string[];
  errors: number;
  warnings: number;
}

function isPublic(m: MemberFact): boolean {
  return m.access === "public" && !m.static;
}

/** Summarizes the project: files per layer, each ViewModel's public API and which Views bind it. */
export function collectInfo(result: AnalysisResult, configFile?: string): ProjectInfo {
  const { config } = result;
  const rel = (f: string) => path.posix.relative(config.root, f);
  const views = result.files
    .filter((f) => f.kind === "view" && f.facts)
    .map((f) => ({
      file: rel(f.file),
      name: path.posix.basename(f.file).replace(/\.view\.tsx$/, ""),
      binds: [
        ...f.facts!.declarators.filter((d) => d.callee === "useViewModel" && d.arg).map((d) => d.arg!),
        // `const { pay } = useViewModel(CartViewModel)` binds it too.
        ...f.facts!.destructurings.flatMap((d) =>
          "callee" in d.init && d.init.callee === "useViewModel" && d.init.arg ? [d.init.arg] : [],
        ),
      ],
    }));

  const viewModels: ViewModelInfo[] = [];
  for (const f of result.files.filter((x) => x.kind === "viewmodel" && x.facts)) {
    for (const cls of f.facts!.classes.filter((c) => c.exported && c.name && c.superClass?.endsWith("ViewModel"))) {
      const members = cls.members.filter(isPublic);
      const pick = (test: (m: MemberFact) => boolean) => members.filter(test).map((m) => m.name);
      viewModels.push({
        name: cls.name!,
        file: rel(f.file),
        state: pick((m) => m.kind === "field" && (m.init === "readonly-view" || m.init === "state")),
        computed: pick((m) => m.kind === "field" && m.init === "computed"),
        commands: pick((m) => m.kind === "field" && m.init === "command"),
        values: pick((m) => m.kind === "field" && (m.init === "other" || m.init === "none")),
        methods: pick((m) => m.kind === "method" || m.kind === "getter"),
        injects: cls.members.filter((m) => m.kind === "param-property").map((m) => m.type ?? m.name),
        usedBy: views.filter((v) => v.binds.includes(cls.name!)).map((v) => v.file),
      });
    }
  }

  let name = path.basename(config.root);
  try {
    name =
      (JSON.parse(fs.readFileSync(path.join(config.root, "package.json"), "utf8")) as { name?: string }).name ?? name;
  } catch {
    /* no package.json */
  }

  const overrides = [
    ...[...config.rules].map(([code, severity]) => `${code}: ${severity}`),
    ...[...config.view.allowHooks].map((hook) => `view.allowHooks: ${hook}`),
    ...config.alias.map(([prefix, target]) => `alias ${prefix} → ${path.posix.relative(config.root, target) || "."}`),
  ];

  return {
    name,
    root: config.root,
    configFile,
    counts: { model: result.stats.model, viewmodel: result.stats.viewmodel, view: result.stats.view },
    viewModels,
    views,
    overrides,
    errors: result.errorCount,
    warnings: result.warningCount,
  };
}

export function formatInfo(info: ProjectInfo, colors = pc.isColorSupported): string {
  const c = pc.createColors(colors);
  const out: string[] = [];
  const row = (label: string, items: string[], color = (s: string) => s) =>
    items.length && out.push(`      ${c.dim(label.padEnd(9))} ${items.map(color).join(c.dim(", "))}`);

  out.push(`  ${c.bold(info.name)} ${c.dim(info.root)}`);
  out.push(`  ${c.dim("config")}   ${info.configFile ? path.basename(info.configFile) : "defaults"}`);
  out.push("");
  out.push(`  ${c.bold("Layers")}`);
  for (const layer of ["view", "viewmodel", "model"] as const) {
    out.push(`    ${LAYER_LABEL[layer].padEnd(10)} ${String(info.counts[layer]).padStart(3)} file(s)`);
  }

  out.push("");
  out.push(`  ${c.bold("ViewModels")} ${c.dim("(public API)")}`);
  if (!info.viewModels.length) out.push(`    ${c.dim("none yet — try `bull g feature <name>`")}`);
  for (const vm of info.viewModels) {
    out.push(`    ${c.magenta(vm.name)} ${c.dim(vm.file)}`);
    row("state", vm.state, c.cyan);
    row("computed", vm.computed, c.cyan);
    row("commands", vm.commands, c.green);
    row("values", vm.values);
    row("methods", vm.methods);
    row("injects", vm.injects, c.blue);
    row("used by", vm.usedBy);
    if (!vm.usedBy.length) out.push(`      ${c.dim("used by".padEnd(9))} ${c.yellow("no View binds it yet")}`);
  }

  out.push("");
  out.push(`  ${c.bold("Views")}`);
  for (const v of info.views) {
    out.push(`    ${v.file.padEnd(40)} ${v.binds.length ? c.magenta(v.binds.join(", ")) : c.dim("presentational")}`);
  }

  if (info.overrides.length) {
    out.push("");
    out.push(`  ${c.bold("Config overrides")}`);
    for (const o of info.overrides) out.push(`    ${o}`);
  }

  out.push("");
  out.push(
    info.errors || info.warnings
      ? `  ${c.red("✗")} ${info.errors} error(s), ${info.warnings} warning(s) — run ${c.cyan("bull check")}`
      : `  ${c.green("✓")} MVVM architecture ok`,
  );
  return `${out.join("\n")}\n`;
}

export async function infoCommand(rootArg: string | undefined, options: { json?: boolean }): Promise<void> {
  const root = path.resolve(rootArg ?? ".");
  const { config, file } = await loadBullConfig(root, "serve");
  const info = collectInfo(new ProjectAnalyzer(root, config).analyze(), file);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
    return;
  }
  banner("info");
  process.stdout.write(formatInfo(info));
}
