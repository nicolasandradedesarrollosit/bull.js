import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { completionScript } from "../src/commands/completion";
import { detectPackageManager, runScript } from "../src/commands/create";
import { planInit } from "../src/tooling/init";
import { VERSION } from "../src/ui/brand";
import { templateProject } from "./helpers";

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) fs.rmSync(d, { recursive: true, force: true });
});

function project(pkg: Record<string, unknown> | null): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bull-init-"));
  temps.push(root);
  if (pkg) fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(pkg));
  return root;
}

describe("package manager", () => {
  it("is detected from the user agent of the command that launched us", () => {
    expect(detectPackageManager("pnpm/9.12.0 npm/? node/v22.11.0 win32 x64")).toBe("pnpm");
    expect(detectPackageManager("yarn/4.5.0 npm/? node/v22.11.0 linux x64")).toBe("yarn");
    expect(detectPackageManager("bun/1.1.30 npm/? node/v22.6.0 darwin arm64")).toBe("bun");
    expect(detectPackageManager("npm/11.0.0 node/v22.11.0 linux x64 workspaces/false")).toBe("npm");
  });

  it("falls back to npm when it is unknown or missing", () => {
    expect(detectPackageManager(undefined)).toBe("npm");
    expect(detectPackageManager("cnpm/9.0.0")).toBe("npm");
  });

  it("names scripts the way each one runs them", () => {
    expect(runScript("npm", "dev")).toBe("npm run dev");
    expect(runScript("pnpm", "dev")).toBe("pnpm dev");
  });
});

describe("bull init", () => {
  it("adds the config, the layers, the scripts and the dependencies", () => {
    const root = project({ name: "app", scripts: { dev: "vite" }, dependencies: { react: "^19.0.0" } });
    const plan = planInit(root);
    expect(plan.changes.filter((c) => c.action === "create").map((c) => c.path)).toEqual([
      "bull.config.ts",
      "src/model/",
      "src/viewmodel/",
      "src/view/",
    ]);
    expect(plan.pkg?.scripts).toEqual({
      dev: "vite",
      build: "bull build",
      preview: "bull preview",
      check: "bull check",
    });
    expect(plan.pkg?.dependencies?.["@bull-js/runtime"]).toBe(`^${VERSION}`);
    expect(plan.pkg?.devDependencies?.["@bull-js/cli"]).toBe(`^${VERSION}`);
    expect(plan.changes.find((c) => c.action === "skip" && c.path === "package.json")?.detail).toContain(
      'scripts.dev ("vite")',
    );
  });

  it("changes nothing in a project that already uses Bull", () => {
    const plan = planInit(templateProject());
    expect(plan.pkg).toBeUndefined();
    expect(plan.changes.every((c) => c.action === "skip")).toBe(true);
  });

  it("needs a package.json", () => {
    expect(() => planInit(project(null))).toThrow(/bull create/);
  });
});

describe("bull completion", () => {
  const commands = [
    { name: "build", aliases: [], description: "Builds", flags: ["--out-dir", "--mode"] },
    { name: "generate", aliases: ["g"], description: "Scaffolds 'code'", flags: ["--dry-run"] },
  ];

  it("completes commands, aliases and flags in bash and zsh", () => {
    const script = completionScript("bash", commands);
    expect(script).toContain('compgen -W "build generate g --help --version"');
    expect(script).toContain('generate|g) flags="--dry-run --help" ;;');
    expect(script).toContain("complete -o default -F _bull_completions bull");
    expect(completionScript("zsh", commands)).toContain("bashcompinit");
  });

  it("escapes descriptions in fish", () => {
    expect(completionScript("fish", commands)).toContain("-a g -d 'Scaffolds \\'code\\''");
  });

  it("registers a native completer in PowerShell", () => {
    const script = completionScript("powershell", commands);
    expect(script).toContain("Register-ArgumentCompleter -Native -CommandName bull");
    expect(script).toContain("'build' = @('--out-dir', '--mode', '--help')");
  });
});
