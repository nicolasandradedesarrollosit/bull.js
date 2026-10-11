import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "@bull/core";
import { afterAll, describe, expect, it } from "vitest";
import { applyFixPlan, miniDiff, planFixes } from "../src/tooling/fix";
import { read, templateProject } from "./helpers";

const fixture = fileURLToPath(new URL("../../../fixtures/fixable", import.meta.url));
const temps: string[] = [];
afterAll(() => temps.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function fixableCopy(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bull-fix-"));
  temps.push(root);
  fs.cpSync(fixture, root, { recursive: true });
  return root;
}

describe("bull fix", () => {
  it("repairs every auto-fixable diagnostic and leaves a clean project", () => {
    const root = fixableCopy();
    const before = analyzeProject(root);
    expect(before.diagnostics.map((d) => d.code)).toEqual(["MVVM003", "MVVM100", "MVVM302", "MVVM302", "MVVM302"]);

    const plan = planFixes(before);
    expect(plan.outcomes.every((o) => o.applied)).toBe(true);
    applyFixPlan(plan);

    expect(analyzeProject(root).diagnostics).toEqual([]);

    const vm = read(root, "src/viewmodel/counter.viewmodel.ts");
    expect(vm).toContain("readonly #count = this.state(0);\n  readonly count = this.#count.readonly;");
    expect(vm).toContain("this.#count.update((n) => n + 1)");
    expect(vm).toContain('readonly label = "Counter";');
    expect(vm).toContain("constructor(private readonly api: CounterApi)");
    expect(vm).toContain('import type { CounterApi } from "../model/counter-api.model";');
    expect(vm).toContain('export type { Count } from "../model/counter.model";');

    expect(read(root, "src/view/counter.view.tsx")).toContain('import type { Count } from "../viewmodel/counter.viewmodel";');
    expect(read(root, "src/main.tsx")).toContain('import { CounterApi } from "./model/counter-api.model";');
    expect(fs.existsSync(path.join(root, "src/model/CounterApi.ts"))).toBe(false);
  });

  it("does nothing on a clean project", () => {
    const plan = planFixes(analyzeProject(templateProject()));
    expect(plan.outcomes).toEqual([]);
    expect(plan.contents.size).toBe(0);
  });

  it("does not touch value imports from the Model (they need a human)", () => {
    const root = templateProject({
      "src/view/bull-logo.view.tsx": `import { CounterRepository } from "../model/counter.repository";\nexport function BullLogoView() { return <i>{String(CounterRepository)}</i>; }`,
    });
    expect(planFixes(analyzeProject(root)).outcomes).toEqual([]);
  });

  it("miniDiff shows the changed block", () => {
    expect(miniDiff("a\nb\nc", "a\nB\nc", false)).toBe("      @@ line 2 @@\n      - b\n      + B");
  });
});
