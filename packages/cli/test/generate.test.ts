import fs from "node:fs";
import path from "node:path";
import { analyzeProject } from "@bull-js/core";
import { describe, expect, it } from "vitest";
import { type GenerateOptions, normalizeName, planGenerate } from "../src/tooling/generate";
import { read, templateProject } from "./helpers";

function options(root: string, extra: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    root,
    srcDir: path.join(root, "src"),
    compositionRoot: path.join(root, "src/main.tsx"),
    test: true,
    ...extra,
  };
}

function apply(_root: string, plan: ReturnType<typeof planGenerate>): void {
  for (const f of plan.files) if (f.action !== "skip") fs.writeFileSync(f.path, f.content);
}

describe("normalizeName", () => {
  it.each([
    ["todo-list", "todo-list", "TodoList"],
    ["TodoList", "todo-list", "TodoList"],
    ["TodoListViewModel", "todo-list", "TodoList"],
    ["todo list", "todo-list", "TodoList"],
    ["todo-list.view", "todo-list", "TodoList"],
    ["overview", "overview", "Overview"],
    ["OverviewView", "overview", "Overview"],
  ])("%s → %s / %s", (raw, kebab, pascal) => {
    expect(normalizeName(raw)).toEqual({ kebab, pascal });
  });

  it("rejects empty names", () => {
    expect(() => normalizeName("--")).toThrow(/not a valid name/);
    expect(() => normalizeName("todo.view")).not.toThrow();
  });
});

describe("planGenerate", () => {
  it("feature: repository, ViewModel, test, View and registration — and the project stays valid", () => {
    const root = templateProject();
    const plan = planGenerate("feature", "TodoList", options(root));
    const rels = plan.files.map((f) => `${f.action} ${path.relative(root, f.path).replace(/\\/g, "/")}`);
    expect(rels).toEqual([
      "create src/model/todo-list.repository.ts",
      "create src/viewmodel/todo-list.viewmodel.ts",
      "create src/viewmodel/todo-list.viewmodel.test.ts",
      "create src/view/todo-list.view.tsx",
      "update src/main.tsx",
    ]);
    apply(root, plan);

    const main = read(root, "src/main.tsx");
    expect(main).toContain(`import { TodoListRepository } from "./model/todo-list.repository";`);
    expect(main).toContain(`c.model(TodoListRepository, () => new TodoListRepository());`);
    expect(main).toContain(`c.viewModel(TodoListViewModel, (c) => new TodoListViewModel(c.get(TodoListRepository)));`);

    expect(analyzeProject(root).diagnostics).toEqual([]);
  });

  it("never overwrites existing files", () => {
    const root = templateProject();
    const plan = planGenerate("viewmodel", "counter", options(root));
    expect(plan.files[0]).toMatchObject({ action: "skip" });
  });

  it("model kinds", () => {
    const root = templateProject();
    const plan = planGenerate("model", "user", options(root, { kind: "repository" }));
    expect(path.basename(plan.files[0]!.path)).toBe("user.repository.ts");
    expect(plan.hints[0]).toContain("c.model(UserRepository");
  });

  it("view: bound to an existing ViewModel, presentational otherwise", () => {
    const root = templateProject();
    expect(planGenerate("view", "counter-panel", options(root)).files[0]!.content).toContain(
      "props: { title: string }",
    );
    const bound = planGenerate("view", "counter", options(root, {})).files[0]!;
    expect(bound.action).toBe("skip");
    fs.rmSync(path.join(root, "src/view/counter.view.tsx"));
    expect(planGenerate("view", "counter", options(root)).files[0]!.content).toContain(
      "useViewModel(CounterViewModel)",
    );
  });

  it("skips the test when asked to", () => {
    const root = templateProject();
    const plan = planGenerate("viewmodel", "cart", options(root, { test: false }));
    expect(plan.files.map((f) => path.basename(f.path))).toEqual(["cart.viewmodel.ts"]);
  });
});
