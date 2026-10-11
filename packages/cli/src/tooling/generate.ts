import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { formatReport, ProjectAnalyzer, toKebab, toPascalCase } from "@bull/core";
import pc from "picocolors";
import { loadBullConfig } from "../config";
import { banner, fail } from "../commands/shared";

export type GenerateType = "model" | "viewmodel" | "view" | "feature";
export type ModelKind = "model" | "entity" | "repository" | "service";

export interface GeneratedFile {
  /** Absolute path. */
  path: string;
  content: string;
  action: "create" | "update" | "skip";
  note?: string;
}

export interface GeneratePlan {
  files: GeneratedFile[];
  hints: string[];
}

export interface GenerateOptions {
  root: string;
  srcDir: string;
  compositionRoot: string;
  kind?: ModelKind;
  /** Also generate a `*.viewmodel.test.ts` (defaults to whether vitest is installed). */
  test?: boolean;
}

/** `TodoList`, `todo-list`, `todo list` or `TodoListViewModel` → `{ kebab: "todo-list", pascal: "TodoList" }`. */
export function normalizeName(raw: string): { kebab: string; pascal: string } {
  // Drop a layer suffix only at a word boundary: `todo-list.view` and `TodoListView`, but not `overview`.
  const stem = raw
    .trim()
    .replace(/\.(tsx?|jsx?)$/, "")
    .replace(/[.\-_\s](viewmodel|view|model|repository|service|entity)$/i, "")
    .replace(/(?<=[a-z0-9])(ViewModel|View|Model|Repository|Service|Entity)$/, "");
  const kebab = toKebab(stem.replace(/\s+/g, "-")).replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!kebab) throw new Error(`"${raw}" is not a valid name. Use something like "todo-list" or "TodoList".`);
  return { kebab, pascal: toPascalCase(kebab) };
}

// ─── templates ────────────────────────────────────────────────────────────────

const templates = {
  model: (n: Names) => `// Model: plain domain types and functions. No React, no reactive state.
export interface ${n.pascal} {
  readonly id: string;
}

export function create${n.pascal}(id: string): ${n.pascal} {
  return { id };
}
`,
  entity: (n: Names) => `export interface ${n.pascal} {
  readonly id: string;
  readonly createdAt: number;
}

export function create${n.pascal}(id: string, now = Date.now()): ${n.pascal} {
  return { id, createdAt: now };
}
`,
  repository: (n: Names) => `// Model: the only layer that does I/O. Swap the in-memory list for fetch, storage or an API.
export class ${n.pascal}Repository {
  #items: string[] = [];

  async list(): Promise<string[]> {
    return [...this.#items];
  }

  async add(item: string): Promise<void> {
    this.#items.push(item);
  }
}
`,
  service: (n: Names) => `// Model: a domain service. Inject it into ViewModels through their constructor.
export class ${n.pascal}Service {
  run(input: string): string {
    return input;
  }
}
`,
  viewmodel: (n: Names) => `import { ViewModel } from "@bull/runtime";

export class ${n.pascal}ViewModel extends ViewModel {
  readonly #items = this.state<string[]>([]);

  readonly items = this.#items.readonly;
  readonly isEmpty = this.computed(() => this.#items.value.length === 0);

  readonly add = this.command((item: string) => this.#items.update((items) => [...items, item]));
}
`,
  viewmodelWithRepository: (n: Names) => `import { ViewModel } from "@bull/runtime";
import type { ${n.pascal}Repository } from "../model/${n.kebab}.repository";

export class ${n.pascal}ViewModel extends ViewModel {
  readonly #items = this.state<string[]>([]);

  readonly items = this.#items.readonly;
  readonly isEmpty = this.computed(() => this.#items.value.length === 0);

  readonly load = this.command(async () => this.#items.set(await this.repo.list()));
  readonly add = this.command(async (item: string) => {
    await this.repo.add(item);
    this.#items.update((items) => [...items, item]);
  });

  constructor(private readonly repo: ${n.pascal}Repository) {
    super();
  }

  protected override onActivate() {
    void this.load.execute();
  }
}
`,
  viewmodelTest: (n: Names, withRepository: boolean) => `// ViewModels are plain classes: test them without React or a DOM.
import { describe, expect, it } from "vitest";
${withRepository ? `import { ${n.pascal}Repository } from "../model/${n.kebab}.repository";\n` : ""}import { ${n.pascal}ViewModel } from "./${n.kebab}.viewmodel";

describe("${n.pascal}ViewModel", () => {
  it("adds items", async () => {
    const vm = new ${n.pascal}ViewModel(${withRepository ? `new ${n.pascal}Repository()` : ""});
    ${withRepository ? "await " : ""}vm.add.execute("first");
    expect(vm.items.value).toEqual(["first"]);
    expect(vm.isEmpty.value).toBe(false);
  });
});
`,
  boundView: (n: Names) => `import { useBinding, useViewModel } from "@bull/runtime/react";
import { ${n.pascal}ViewModel } from "../viewmodel/${n.kebab}.viewmodel";

export function ${n.pascal}View() {
  const vm = useViewModel(${n.pascal}ViewModel);
  const items = useBinding(vm.items);
  const isEmpty = useBinding(vm.isEmpty);

  return (
    <section>
      <h2>${n.pascal}</h2>
      {isEmpty ? (
        <p>Nothing here yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <button onClick={() => vm.add.execute(\`Item \${items.length + 1}\`)}>Add</button>
    </section>
  );
}
`,
  existingViewModelView: (n: Names) => `import { useViewModel } from "@bull/runtime/react";
import { ${n.pascal}ViewModel } from "../viewmodel/${n.kebab}.viewmodel";

export function ${n.pascal}View() {
  const vm = useViewModel(${n.pascal}ViewModel);
  // Read with useBinding(vm.something) and act with vm.someCommand.execute().
  return <section data-viewmodel={vm.constructor.name}>${n.pascal}</section>;
}
`,
  presentationalView: (n: Names) => `/** Presentational View: receives data and callbacks through props, owns no state. */
export function ${n.pascal}View(props: { title: string }) {
  return (
    <section>
      <h2>{props.title}</h2>
    </section>
  );
}
`,
};

type Names = { kebab: string; pascal: string };

// ─── planning ─────────────────────────────────────────────────────────────────

function file(target: string, content: string): GeneratedFile {
  return fs.existsSync(target)
    ? { path: target, content, action: "skip", note: "already exists" }
    : { path: target, content, action: "create" };
}

/** Computes what `bull generate` would write, without touching the disk. */
export function planGenerate(type: GenerateType, rawName: string, options: GenerateOptions): GeneratePlan {
  const n = normalizeName(rawName);
  const dir = (layer: string) => path.join(options.srcDir, layer);
  const files: GeneratedFile[] = [];
  const hints: string[] = [];
  const wantTest = options.test ?? hasVitest(options.root);

  if (type === "model") {
    const kind = options.kind ?? "model";
    if (!(kind in templates)) throw new Error(`Unknown model kind "${kind}". Use model, entity, repository or service.`);
    files.push(file(path.join(dir("model"), `${n.kebab}.${kind}.ts`), templates[kind](n)));
    if (kind === "repository" || kind === "service") {
      const cls = `${n.pascal}${kind === "repository" ? "Repository" : "Service"}`;
      hints.push(`Inject \`${cls}\` into a ViewModel constructor and register it: \`c.model(${cls}, () => new ${cls}())\`.`);
    }
  }

  if (type === "viewmodel" || type === "feature") {
    const withRepository = type === "feature";
    if (withRepository) files.push(file(path.join(dir("model"), `${n.kebab}.repository.ts`), templates.repository(n)));
    files.push(
      file(
        path.join(dir("viewmodel"), `${n.kebab}.viewmodel.ts`),
        withRepository ? templates.viewmodelWithRepository(n) : templates.viewmodel(n),
      ),
    );
    if (wantTest) {
      files.push(file(path.join(dir("viewmodel"), `${n.kebab}.viewmodel.test.ts`), templates.viewmodelTest(n, withRepository)));
    }
  }

  if (type === "view" || type === "feature") {
    const vmFile = path.join(dir("viewmodel"), `${n.kebab}.viewmodel.ts`);
    const content =
      type === "feature"
        ? templates.boundView(n)
        : fs.existsSync(vmFile)
          ? templates.existingViewModelView(n)
          : templates.presentationalView(n);
    files.push(file(path.join(dir("view"), `${n.kebab}.view.tsx`), content));
    hints.push(`Render \`<${n.pascal}View />\` from another View (for example your root View).`);
  }

  if (type === "feature") {
    const registration = registerInCompositionRoot(options, n);
    if (registration) files.push(registration);
    else {
      hints.push(
        `Register the feature in your composition root:\n` +
          `      c.model(${n.pascal}Repository, () => new ${n.pascal}Repository());\n` +
          `      c.viewModel(${n.pascal}ViewModel, (c) => new ${n.pascal}ViewModel(c.get(${n.pascal}Repository)));`,
      );
    }
  }

  return { files, hints };
}

function hasVitest(root: string): boolean {
  try {
    createRequire(path.join(root, "package.json")).resolve("vitest/package.json");
    return true;
  } catch {
    return false;
  }
}

/** Adds the imports and `c.model(...)` / `c.viewModel(...)` lines to the composition root. */
function registerInCompositionRoot(options: GenerateOptions, n: Names): GeneratedFile | undefined {
  const rootFile = options.compositionRoot;
  if (!fs.existsSync(rootFile)) return undefined;
  const source = fs.readFileSync(rootFile, "utf8");
  if (source.includes(`${n.pascal}ViewModel`)) return undefined;

  const register = /register\s*:\s*\(?\s*(\w+)\s*\)?\s*=>\s*\{\r?\n?/.exec(source);
  if (!register) return undefined;
  const param = register[1]!;
  const after = source.slice(register.index + register[0].length);
  const indent = /^([ \t]*)\S/.exec(after)?.[1] || "    ";

  const rel = (layer: string, fileName: string) =>
    "./" + path.posix.relative(path.posix.dirname(toPosix(rootFile)), toPosix(path.join(options.srcDir, layer, fileName))).replace(/\.tsx?$/, "");
  const imports =
    `import { ${n.pascal}Repository } from "${rel("model", `${n.kebab}.repository.ts`)}";\n` +
    `import { ${n.pascal}ViewModel } from "${rel("viewmodel", `${n.kebab}.viewmodel.ts`)}";\n`;
  const lines =
    `${indent}${param}.model(${n.pascal}Repository, () => new ${n.pascal}Repository());\n` +
    `${indent}${param}.viewModel(${n.pascal}ViewModel, (${param}) => new ${n.pascal}ViewModel(${param}.get(${n.pascal}Repository)));\n`;

  // Append at the end of the register block: find the brace that closes it.
  const open = source.indexOf("{", register.index + register[0].trimEnd().length - 1);
  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close < 0) return undefined;
  const insertAt = source.lastIndexOf("\n", close) + 1;
  let updated = source.slice(0, insertAt) + lines + source.slice(insertAt);

  const lastImport = [...updated.matchAll(/^import[^;]*;[ \t]*$/gm)].at(-1);
  const importAt = lastImport ? lastImport.index! + lastImport[0].length + 1 : 0;
  updated = updated.slice(0, importAt) + imports + updated.slice(importAt);
  return { path: rootFile, content: updated, action: "update", note: "registered the Model and ViewModel" };
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

// ─── command ──────────────────────────────────────────────────────────────────

const TYPES: Record<string, GenerateType> = {
  model: "model",
  m: "model",
  viewmodel: "viewmodel",
  vm: "viewmodel",
  view: "view",
  v: "view",
  feature: "feature",
  f: "feature",
};

export async function generateCommand(
  typeArg: string,
  name: string | undefined,
  options: { root?: string; kind?: ModelKind; dryRun?: boolean; test?: boolean },
): Promise<void> {
  banner(options.dryRun ? "generate (dry run)" : "generate");
  const type = TYPES[typeArg?.toLowerCase()];
  if (!type || !name) {
    fail(
      "Usage: bull generate <feature|model|viewmodel|view> <name>",
      "Example: `bull g feature todo-list` creates a repository, a ViewModel, its test and a View.",
    );
    return;
  }

  const root = path.resolve(options.root ?? ".");
  const { config } = await loadBullConfig(root, "serve");
  const analyzer = new ProjectAnalyzer(root, config);
  let plan: GeneratePlan;
  try {
    plan = planGenerate(type, name, {
      root,
      srcDir: analyzer.config.srcDir,
      compositionRoot: analyzer.config.compositionRoot,
      kind: options.kind,
      test: options.test,
    });
  } catch (error) {
    fail((error as Error).message);
    return;
  }

  for (const f of plan.files) {
    const rel = path.relative(root, f.path).replace(/\\/g, "/");
    if (f.action === "skip") {
      console.log(`  ${pc.yellow("·")} ${rel} ${pc.dim(`(${f.note}, left untouched)`)}`);
      continue;
    }
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(f.path), { recursive: true });
      fs.writeFileSync(f.path, f.content);
    }
    const mark = f.action === "create" ? pc.green("+") : pc.cyan("~");
    const verb = options.dryRun ? (f.action === "create" ? "would create" : "would update") : f.action === "create" ? "" : f.note ?? "updated";
    console.log(`  ${mark} ${rel}${verb ? pc.dim(`  ${verb}`) : ""}`);
  }
  for (const hint of plan.hints) console.log(`\n  ${pc.cyan("→")} ${hint.replace(/`([^`]+)`/g, (_, c: string) => pc.cyan(c))}`);

  if (options.dryRun) return;
  const result = analyzer.analyze();
  console.log("\n" + formatReport(result, { width: Math.min(process.stdout.columns || 88, 100) }));
  if (result.errorCount > 0) process.exitCode = 1;
}
