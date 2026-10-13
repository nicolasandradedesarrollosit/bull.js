import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProjectAnalyzer } from "@bull-js/core";
import pc from "picocolors";
import { type BullConfig, loadBullConfig } from "../config";
import { bullArt } from "../ui/brand";

export type CheckStatus = "ok" | "warn" | "fail";

export interface Check {
  status: CheckStatus;
  title: string;
  detail?: string;
  hint?: string;
}

/** Finds an installed package by walking up node_modules folders (works for ESM-only packages). */
function packageDir(from: string, name: string): string | undefined {
  let dir = path.resolve(from);
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return fs.realpathSync.native(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function versionOf(root: string, pkg: string): string | undefined {
  const dir = packageDir(root, pkg);
  return dir
    ? (JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as { version: string }).version
    : undefined;
}

/** Parses tsconfig-style JSON (comments and trailing commas allowed). */
function readJsonc(file: string): Record<string, unknown> | undefined {
  try {
    const text = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'])\/\/.*$/gm, "$1")
      .replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

const minor = (v: string) => v.split(".").slice(0, 2).join(".");

/** Runs every environment and project check. Pure: it only reads. */
export async function runDoctor(root: string, nodeVersion = process.versions.node): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // Node: the versions Vite supports, ^20.19 or >=22.12.
  const [nodeMajor = 0, nodeMinor = 0] = nodeVersion.split(".").map(Number);
  const supported = (nodeMajor === 20 && nodeMinor >= 19) || (nodeMajor === 22 && nodeMinor >= 12) || nodeMajor > 22;
  add(
    supported
      ? { status: "ok", title: `Node.js ${nodeVersion}` }
      : { status: "fail", title: `Node.js ${nodeVersion}`, hint: "Bull needs Node.js 20.19+ or 22.12+." },
  );

  // package.json
  if (!fs.existsSync(path.join(root, "package.json"))) {
    add({
      status: "fail",
      title: "package.json not found",
      hint: "Run `bull doctor` from your project root, or pass the path.",
    });
    return checks;
  }

  // React
  const react = versionOf(root, "react");
  const reactDom = versionOf(root, "react-dom");
  if (!react || !reactDom) {
    add({ status: "fail", title: "React is not installed", hint: "npm install react react-dom" });
  } else if (minor(react) !== minor(reactDom)) {
    add({
      status: "fail",
      title: `react ${react} and react-dom ${reactDom} do not match`,
      hint: "Install the same version of both.",
    });
  } else {
    add({ status: "ok", title: `React ${react}` });
  }

  // Runtime and a single copy of React
  const runtimeDir = packageDir(root, "@bull-js/runtime");
  if (!runtimeDir) {
    add({ status: "fail", title: "@bull-js/runtime is not installed", hint: "npm install @bull-js/runtime" });
  } else {
    add({ status: "ok", title: `@bull-js/runtime ${versionOf(root, "@bull-js/runtime") ?? ""}`.trim() });
    const fromApp = packageDir(root, "react");
    const fromRuntime = packageDir(runtimeDir, "react");
    if (fromApp && fromRuntime && fromApp !== fromRuntime) {
      add({
        status: "fail",
        title: "Two copies of React are installed",
        detail: `${path.relative(root, fromApp)} and ${path.relative(root, fromRuntime)}`,
        hint: "Remove the nested copy (npm dedupe) so hooks share one React.",
      });
    } else if (fromApp) {
      add({ status: "ok", title: "A single copy of React" });
    }
  }

  // The bundler Bull drives
  const vite = versionOf(path.dirname(fileURLToPath(import.meta.url)), "vite");
  add(
    vite
      ? { status: "ok", title: `Vite ${vite}` }
      : { status: "warn", title: "Vite could not be resolved", hint: "Reinstall @bull-js/cli." },
  );

  // bull.config
  let config: BullConfig = {};
  try {
    const loaded = await loadBullConfig(root, "serve");
    config = loaded.config;
    add({
      status: "ok",
      title: loaded.file ? `${path.basename(loaded.file)} loads` : "No bull.config.ts (defaults are used)",
    });
  } catch (error) {
    add({ status: "fail", title: "bull.config could not be loaded", detail: (error as Error).message.split("\n")[0] });
  }

  const analyzer = new ProjectAnalyzer(root, config);
  const result = analyzer.analyze();
  const configErrors = result.diagnostics.filter((d) => d.code === "MVVM900");
  for (const d of configErrors) add({ status: "fail", title: "Invalid configuration", detail: d.message });

  // index.html
  const indexHtml = path.join(root, "index.html");
  const entry = `/${path.posix.relative(analyzer.config.root, analyzer.config.compositionRoot)}`;
  if (!fs.existsSync(indexHtml)) {
    add({
      status: "fail",
      title: "index.html not found",
      hint: `Add one with <script type="module" src="${entry}"></script>.`,
    });
  } else if (!fs.readFileSync(indexHtml, "utf8").includes(entry)) {
    add({
      status: "warn",
      title: `index.html does not load ${entry}`,
      hint: `Point its module script at the composition root (${entry}).`,
    });
  } else {
    add({ status: "ok", title: `index.html loads ${entry}` });
  }

  // tsconfig
  const tsconfig = readJsonc(path.join(root, "tsconfig.json"));
  if (!tsconfig) {
    add({
      status: "warn",
      title: "tsconfig.json not found or unreadable",
      hint: 'Use "jsx": "react-jsx" and "strict": true.',
    });
  } else {
    const options = (tsconfig.compilerOptions ?? {}) as Record<string, unknown>;
    const problems = [
      options.jsx !== "react-jsx" && options.jsx !== "react-jsxdev" ? '"jsx": "react-jsx"' : "",
      options.strict !== true ? '"strict": true' : "",
    ].filter(Boolean);
    add(
      problems.length
        ? { status: "warn", title: "tsconfig.json could be stricter", hint: `Set ${problems.join(" and ")}.` }
        : { status: "ok", title: "tsconfig.json uses react-jsx and strict mode" },
    );
  }

  // Layers and composition root
  const missing = result.diagnostics.filter((d) => d.code === "MVVM001").map((d) => d.data.dir);
  add(
    missing.length
      ? {
          status: "fail",
          title: `Missing layer folders: ${missing.join(", ")}`,
          hint: "Create them, or run `bull g feature <name>`.",
        }
      : { status: "ok", title: "src/model, src/viewmodel and src/view exist" },
  );
  if (result.diagnostics.some((d) => d.code === "MVVM005")) {
    add({
      status: "fail",
      title: "The composition root is missing",
      hint: `Create ${entry.slice(1)} with createBullApp().`,
    });
  }

  // ESLint
  const eslintConfig = ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts"]
    .map((f) => path.join(root, f))
    .find((f) => fs.existsSync(f));
  if (!eslintConfig) {
    add({
      status: "warn",
      title: "No ESLint flat config",
      hint: "Add @bull-js/eslint-plugin to see violations in your editor.",
    });
  } else if (!fs.readFileSync(eslintConfig, "utf8").includes("@bull-js/eslint-plugin")) {
    add({
      status: "warn",
      title: `${path.basename(eslintConfig)} does not use @bull-js/eslint-plugin`,
      hint: "Spread bull.configs.recommended into it.",
    });
  } else {
    add({ status: "ok", title: "ESLint uses @bull-js/eslint-plugin" });
  }

  // Architecture
  const architecture = result.diagnostics.filter((d) => d.code !== "MVVM900");
  const errors = architecture.filter((d) => d.severity === "error").length;
  add(
    errors
      ? {
          status: "fail",
          title: `Architecture: ${errors} error(s)`,
          hint: "Run `bull check` for details, or `bull fix` for the automatic ones.",
        }
      : architecture.length
        ? {
            status: "warn",
            title: `Architecture: ${architecture.length} warning(s)`,
            hint: "Run `bull check` for details.",
          }
        : { status: "ok", title: "Architecture respects MVVM" },
  );
  return checks;
}

export async function doctorCommand(rootArg: string | undefined): Promise<void> {
  console.log(`\n${bullArt("doctor")}\n`);
  const root = path.resolve(rootArg ?? ".");
  const checks = await runDoctor(root);
  const icon: Record<CheckStatus, string> = { ok: pc.green("✓"), warn: pc.yellow("!"), fail: pc.red("✗") };
  for (const c of checks) {
    console.log(`  ${icon[c.status]} ${c.title}${c.detail ? pc.dim(`  ${c.detail}`) : ""}`);
    if (c.hint && c.status !== "ok") console.log(`    ${pc.dim(c.hint.replace(/`/g, ""))}`);
  }
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  console.log(
    `\n  ${fails ? pc.red(`${fails} problem(s)`) : pc.green("Healthy")}${warns ? pc.yellow(` · ${warns} suggestion(s)`) : ""}\n`,
  );
  if (fails) process.exitCode = 1;
}
