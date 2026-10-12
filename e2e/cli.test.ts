import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const repo = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const bin = path.join(repo, "packages/cli/dist/bin.js");

function bull(args: string[], cwd = repo) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  return { code: result.status, out: result.stdout + result.stderr };
}

function tempOut(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bull-e2e-"));
}

describe("bull build", () => {
  it("builds an app that respects MVVM", () => {
    const outDir = tempOut();
    const { code, out } = bull(["build", "examples/todo-app", "--out-dir", outDir]);
    expect(out).toContain("MVVM architecture ok");
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(outDir, "index.html"))).toBe(true);
  });

  it("does not build when a layer is missing", () => {
    const outDir = tempOut();
    const { code, out } = bull(["build", "fixtures/missing-viewmodel", "--out-dir", outDir]);
    expect(code).toBe(1);
    expect(out).toContain("MISSING LAYER");
    expect(out).toContain("├── viewmodel/   ✗ missing");
    expect(out).toContain("Build cancelled");
    expect(fs.readdirSync(outDir)).toEqual([]);
  });

  it("does not build when layer communication breaks, and explains each case", () => {
    const outDir = tempOut();
    const { code, out } = bull(["build", "fixtures/view-imports-model", "--out-dir", outDir]);
    expect(code).toBe(1);
    for (const c of ["MVVM100", "MVVM201", "MVVM302", "MVVM304", "MVVM301"]) expect(out).toContain(c);
    expect(out).toContain("How to fix:");
    expect(out).toContain("View ──▶ Model");
    expect(fs.readdirSync(outDir)).toEqual([]);
  });
});

describe("bull check", () => {
  it("--format json for CI", () => {
    const { code, out } = bull(["check", "fixtures/view-imports-model", "--format", "json"]);
    expect(code).toBe(1);
    const json = JSON.parse(out);
    expect(json.version).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.diagnostics.map((d: { code: string }) => d.code)).toContain("MVVM100");
  });
});

describe("bull explain", () => {
  it("explains a rule by code, number or slug", () => {
    for (const arg of ["MVVM100", "100", "view-imports-model"]) {
      const { code, out } = bull(["explain", arg]);
      expect(code).toBe(0);
      expect(out).toContain("VIEW IMPORTS MODEL");
      expect(out).toContain("✓ Do");
    }
  });

  it("lists every rule", () => {
    expect(bull(["explain"]).out).toContain("MVVM305");
  });
});

describe("bull create", () => {
  it("generates a project that passes the check", () => {
    // Inside the repo, so @bull/* resolves from node_modules like in an installed project.
    const dir = fs.mkdtempSync(path.join(repo, ".tmp", "create-"));
    fs.rmSync(dir, { recursive: true });
    const created = bull(["create", dir, "--no-install", "--no-git"]);
    expect(created.code).toBe(0);
    for (const f of ["src/model", "src/viewmodel", "src/view", "src/main.tsx", "index.html", ".gitignore"]) {
      expect(fs.existsSync(path.join(dir, f))).toBe(true);
    }
    expect(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name).toBe(
      path.basename(dir).toLowerCase(),
    );
    const check = bull(["check", dir]);
    expect(check.out).toContain("MVVM architecture ok");
    expect(check.code).toBe(0);
  });
});

fs.mkdirSync(path.join(repo, ".tmp"), { recursive: true });
afterAll(() => fs.rmSync(path.join(repo, ".tmp"), { recursive: true, force: true }));

describe("tooling", () => {
  function tempProject(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(repo, ".tmp", prefix));
    fs.rmSync(dir, { recursive: true });
    return dir;
  }

  it("generate feature keeps the project valid", () => {
    const dir = tempProject("gen-");
    expect(bull(["create", dir, "--no-install", "--no-git"]).code).toBe(0);
    const generated = bull(["g", "feature", "shopping-cart", "--root", dir]);
    expect(generated.code).toBe(0);
    expect(generated.out).toContain("+ src/viewmodel/shopping-cart.viewmodel.ts");
    expect(generated.out).toContain("~ src/main.tsx");
    expect(bull(["check", dir]).code).toBe(0);
  });

  it("fix repairs the fixable fixture", () => {
    const dir = tempProject("fix-");
    fs.cpSync(path.join(repo, "fixtures/fixable"), dir, { recursive: true });
    expect(bull(["check", dir]).code).toBe(1);
    const fixed = bull(["fix", dir]);
    expect(fixed.out).toContain("✔ MVVM003");
    expect(fixed.code).toBe(0);
    expect(bull(["check", dir]).code).toBe(0);
  });

  it("graph prints mermaid with the violating edge and exits 1", () => {
    const { code, out } = bull(["graph", "fixtures/view-imports-model", "--format", "mermaid"]);
    expect(code).toBe(1);
    expect(out).toMatch(/-->\|MVVM100\|/);
  });

  it("doctor and info on the example app", () => {
    const doctor = bull(["doctor", "examples/todo-app"]);
    expect(doctor.out).toContain("Healthy");
    expect(doctor.code).toBe(0);
    const info = JSON.parse(bull(["info", "examples/todo-app", "--json"]).out);
    expect(info.viewModels[0].name).toBe("TodoListViewModel");
  });

  it("init adds Bull to an existing project without overwriting it", () => {
    const dir = tempProject("init-");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "app", scripts: { dev: "vite" } }));

    const dry = bull(["init", dir, "--dry-run"]);
    expect(dry.code).toBe(0);
    expect(dry.out).toContain("+ bull.config.ts  would create");
    expect(fs.existsSync(path.join(dir, "bull.config.ts"))).toBe(false);

    expect(bull(["init", dir]).code).toBe(0);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    expect(pkg.scripts).toMatchObject({ dev: "vite", build: "bull build", check: "bull check" });
    for (const f of ["bull.config.ts", "src/model", "src/viewmodel", "src/view"]) {
      expect(fs.existsSync(path.join(dir, f))).toBe(true);
    }
  });

  it("npm create @bull runs the same create", () => {
    const dir = tempProject("npm-create-");
    const createBin = path.join(repo, "packages/create/dist/index.js");
    // Windows environment keys are case-insensitive: drop the inherited user agent in any casing.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_config_user_agent$/i.test(k)));
    const result = spawnSync(process.execPath, [createBin, dir, "--no-install", "--no-git"], {
      cwd: repo,
      encoding: "utf8",
      env: { ...env, NO_COLOR: "1", npm_config_user_agent: "pnpm/9.12.0 npm/? node/v22.11.0" },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("pnpm install");
    expect(result.stdout).toContain("pnpm dev");
    expect(fs.existsSync(path.join(dir, "bull.config.ts"))).toBe(true);
  });

  it("preview explains that there is no build yet", () => {
    const dir = tempProject("preview-");
    expect(bull(["create", dir, "--no-install", "--no-git"]).code).toBe(0);
    const { code, out } = bull(["preview", dir]);
    expect(code).toBe(1);
    expect(out).toContain("There is no build in dist/ to preview.");
  });

  it("completion prints a script for each shell", () => {
    expect(bull(["completion", "bash"]).out).toContain("complete -o default -F _bull_completions bull");
    expect(bull(["completion", "powershell"]).out).toContain("Register-ArgumentCompleter");
    const unknown = bull(["completion", "tcsh"]);
    expect(unknown.code).toBe(1);
    expect(unknown.out).toContain("Usage: bull completion");
  });
});
