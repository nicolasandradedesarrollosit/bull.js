import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { bullArt, VERSION } from "../ui/brand";
import { fail } from "./shared";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
const PACKAGE_MANAGERS: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

/** The package manager that launched us (`npm create`, `pnpm create`…), read from `npm_config_user_agent`. */
export function detectPackageManager(userAgent = process.env.npm_config_user_agent): PackageManager {
  const name = userAgent?.split(" ")[0]?.split("/")[0];
  return PACKAGE_MANAGERS.includes(name as PackageManager) ? (name as PackageManager) : "npm";
}

/** `npm run dev` for npm, `pnpm dev` / `yarn dev` / `bun dev` for the rest. */
export function runScript(pm: PackageManager, script: string): string {
  return pm === "npm" ? `npm run ${script}` : `${pm} ${script}`;
}

/** `templates/` sits next to `dist/` (published) or `src/` (development). */
function templatesDir(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, "templates");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error("Bull templates were not found.");
}

function copyTemplate(from: string, to: string, vars: Record<string, string>): string[] {
  const written: string[] = [];
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const name = entry.name === "_gitignore" ? ".gitignore" : entry.name;
    const src = path.join(from, entry.name);
    const dest = path.join(to, name);
    if (entry.isDirectory()) {
      written.push(...copyTemplate(src, dest, vars));
    } else {
      const content = fs.readFileSync(src, "utf8").replace(/\{\{(\w+)\}\}/g, (m, key: string) => vars[key] ?? m);
      fs.writeFileSync(dest, content);
      written.push(dest);
    }
  }
  return written;
}

export interface ScaffoldOptions {
  /** Folder to create, relative to the current one. */
  name: string;
  template?: string;
}

/** Copies a template into a new folder. Throws if the folder is not empty or the template does not exist. */
export function scaffoldProject({ name, template = "default" }: ScaffoldOptions): { target: string; files: string[] } {
  const target = path.resolve(name);
  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
    throw new Error(`The folder ${pc.bold(name)} already exists and is not empty.`);
  }
  const from = path.join(templatesDir(), template);
  if (!fs.existsSync(from)) throw new Error(`The template "${template}" does not exist.`);

  const pkgName = path
    .basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, "-");
  return { target, files: copyTemplate(from, target, { name: pkgName, bullVersion: VERSION }) };
}

/** Quotes an argument for a Windows command line when it needs it. */
function quote(arg: string): string {
  return /^[\w@./:=+-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`;
}

/** The command line a shell runs: a shell joins an argument list without quoting it (DEP0190). */
export function commandLine(command: string, args: string[]): string {
  return [command, ...args.map(quote)].join(" ");
}

/**
 * Runs a command and reports whether it succeeded. Package managers are .cmd shims on Windows that
 * only run through a shell, so `viaShell` builds a quoted command line there. Everything else, git
 * included, runs directly with its arguments untouched.
 */
function run(
  command: string,
  args: string[],
  cwd: string,
  stdio: "inherit" | "ignore" = "ignore",
  viaShell = false,
): boolean {
  const result =
    viaShell && process.platform === "win32"
      ? spawnSync(commandLine(command, args), { cwd, stdio, shell: true })
      : spawnSync(command, args, { cwd, stdio });
  return result.status === 0;
}

function initGit(target: string): boolean {
  if (!run("git", ["--version"], target)) return false;
  // Inside an existing repository (a monorepo, for example) a nested one would get in the way.
  if (run("git", ["rev-parse", "--is-inside-work-tree"], target)) return false;
  if (!run("git", ["init", "-q"], target)) return false;
  run("git", ["add", "-A"], target);
  // The commit fails without a configured git identity: the repository is still initialized.
  run("git", ["commit", "-q", "-m", "Initial commit from bull create"], target);
  return true;
}

export interface CreateOptions {
  template?: string;
  install?: boolean;
  git?: boolean;
  pm?: string;
}

export async function createCommand(nameArg: string | undefined, options: CreateOptions): Promise<void> {
  console.log(`\n${bullArt("create")}\n`);

  let name = nameArg;
  let install = options.install ?? true;
  let git = options.git ?? true;
  // Without a name in an interactive terminal, ask for everything; with one, use the flags.
  if (!name) {
    if (!process.stdin.isTTY || p.isCI()) {
      fail("Missing the project name.", "Usage: bull create <name> [--no-install] [--no-git] [--pm npm|pnpm|yarn|bun]");
      return;
    }
    const answers = await p.group(
      {
        name: () =>
          p.text({
            message: "Project name",
            placeholder: "my-app",
            defaultValue: "my-app",
            validate: (value) => (value && /[<>:"|?*]/.test(value) ? "Use letters, numbers and dashes." : undefined),
          }),
        install: () => p.confirm({ message: "Install dependencies?", initialValue: install }),
        git: () => p.confirm({ message: "Initialize a git repository?", initialValue: git }),
      },
      { onCancel: () => p.cancel("Cancelled.") },
    );
    if (p.isCancel(answers.name) || answers.name === undefined) return;
    name = answers.name;
    install = answers.install === true;
    git = answers.git === true;
  }

  if (options.pm && !PACKAGE_MANAGERS.includes(options.pm as PackageManager)) {
    fail(`Unknown package manager "${options.pm}".`, `Use one of: ${PACKAGE_MANAGERS.join(", ")}.`);
    return;
  }
  const pm = (options.pm as PackageManager | undefined) ?? detectPackageManager();

  let scaffolded: { target: string; files: string[] };
  try {
    scaffolded = scaffoldProject({ name, template: options.template });
  } catch (error) {
    fail((error as Error).message);
    return;
  }
  const { target, files } = scaffolded;
  const rel = (f: string) => path.relative(target, f).replace(/\\/g, "/");

  console.log(`  ${pc.green("✓")} Project created in ${pc.bold(path.relative(process.cwd(), target) || ".")}\n`);
  const tree = files
    .map(rel)
    .filter((f) => f.startsWith("src/"))
    .sort();
  for (const f of tree) {
    const layer = f.split("/")[1];
    const color =
      layer === "model" ? pc.blue : layer === "viewmodel" ? pc.magenta : layer === "view" ? pc.green : pc.dim;
    console.log(`    ${color(f)}`);
  }

  let installed = false;
  if (install) {
    console.log(`\n  ${pc.dim(`Installing dependencies with ${pm}…`)}\n`);
    installed = run(pm, ["install"], target, "inherit", true);
    if (!installed) console.log(`\n  ${pc.yellow("!")} ${pm} install failed. Run it yourself inside the folder.`);
  }
  if (git && initGit(target)) console.log(`\n  ${pc.green("✓")} Initialized a git repository`);

  const steps = [`cd ${name}`, ...(installed ? [] : [`${pm} install`]), runScript(pm, "dev")];
  console.log(`
  Next steps:
${steps.map((s) => `    ${pc.cyan(s)}`).join("\n")}

  House rules: ${pc.dim("View ──▶ ViewModel ──▶ Model")}. Break them and it will not build.
  See every rule with ${pc.cyan("npx bull explain")}.
`);
}
