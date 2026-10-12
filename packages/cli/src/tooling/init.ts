import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { detectPackageManager, runScript } from "../commands/create";
import { banner, fail, VERSION } from "../commands/shared";

const CONFIG = `import { defineConfig } from "@bull/cli";

export default defineConfig({});
`;

const SCRIPTS: Record<string, string> = {
  dev: "bull",
  build: "bull build",
  preview: "bull preview",
  check: "bull check",
};

const DEPENDENCIES = ["@bull/runtime"];
const DEV_DEPENDENCIES = ["@bull/cli", "@bull/eslint-plugin"];
const LAYERS = ["model", "viewmodel", "view"];

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface InitChange {
  /** Path relative to the project root. */
  path: string;
  action: "create" | "update" | "skip";
  detail: string;
}

export interface InitPlan {
  changes: InitChange[];
  /** The updated package.json, or `undefined` when nothing in it changes. */
  pkg?: PackageJson;
}

/** Works out what `bull init` adds to an existing project. Never overwrites: what exists is skipped. */
export function planInit(root: string): InitPlan {
  const pkgFile = path.join(root, "package.json");
  if (!fs.existsSync(pkgFile)) {
    throw new Error("There is no package.json here. To start from scratch use `bull create <name>`.");
  }
  const original = fs.readFileSync(pkgFile, "utf8");
  const pkg = JSON.parse(original) as PackageJson;
  const changes: InitChange[] = [];

  const config = ["bull.config.ts", "bull.config.mts", "bull.config.js", "bull.config.mjs"].find((f) =>
    fs.existsSync(path.join(root, f)),
  );
  changes.push(
    config
      ? { path: config, action: "skip", detail: "already exists" }
      : { path: "bull.config.ts", action: "create", detail: "empty config, ready to extend" },
  );

  for (const layer of LAYERS) {
    const dir = `src/${layer}`;
    changes.push(
      fs.existsSync(path.join(root, dir))
        ? { path: `${dir}/`, action: "skip", detail: "already exists" }
        : { path: `${dir}/`, action: "create", detail: `${layer} layer` },
    );
  }

  const added: string[] = [];
  const kept: string[] = [];
  pkg.scripts ??= {};
  for (const [name, command] of Object.entries(SCRIPTS)) {
    const current = pkg.scripts[name];
    if (current === undefined) {
      pkg.scripts[name] = command;
      added.push(`scripts.${name}`);
    } else if (current !== command) {
      kept.push(`scripts.${name} ("${current}")`);
    }
  }
  const range = `^${VERSION}`;
  const addDeps = (field: "dependencies" | "devDependencies", names: string[]) => {
    for (const name of names) {
      if (pkg.dependencies?.[name] || pkg.devDependencies?.[name]) continue;
      pkg[field] = { ...pkg[field], [name]: range };
      added.push(name);
    }
  };
  addDeps("dependencies", DEPENDENCIES);
  addDeps("devDependencies", DEV_DEPENDENCIES);

  if (added.length) changes.push({ path: "package.json", action: "update", detail: `adds ${added.join(", ")}` });
  if (kept.length) changes.push({ path: "package.json", action: "skip", detail: `keeps ${kept.join(", ")}` });

  return { changes, pkg: added.length ? pkg : undefined };
}

export function initCommand(rootArg: string | undefined, options: { dryRun?: boolean }): void {
  banner(options.dryRun ? "init (dry run)" : "init");
  const root = path.resolve(rootArg ?? ".");

  let plan: InitPlan;
  try {
    plan = planInit(root);
  } catch (error) {
    fail((error as Error).message);
    return;
  }

  for (const change of plan.changes) {
    if (change.action === "skip") {
      console.log(`  ${pc.yellow("·")} ${change.path} ${pc.dim(`(${change.detail}, left untouched)`)}`);
      continue;
    }
    const mark = change.action === "create" ? pc.green("+") : pc.cyan("~");
    const verb = options.dryRun ? (change.action === "create" ? "would create: " : "would update: ") : "";
    console.log(`  ${mark} ${change.path}  ${pc.dim(`${verb}${change.detail}`)}`);
    if (options.dryRun) continue;

    const abs = path.join(root, change.path);
    if (change.path.endsWith("/")) fs.mkdirSync(abs, { recursive: true });
    else if (change.path === "bull.config.ts") fs.writeFileSync(abs, CONFIG);
  }
  if (!options.dryRun && plan.pkg) {
    fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify(plan.pkg, null, 2)}\n`);
  }

  const pm = detectPackageManager();
  console.log(`
  Next steps:
    ${pc.cyan(`${pm} install`)}
    ${pc.cyan("npx bull g feature home")}   ${pc.dim("a first Model, ViewModel and View")}
    ${pc.cyan("npx bull doctor")}           ${pc.dim("checks the rest of the setup")}
    ${pc.cyan(runScript(pm, "dev"))}
`);
}
