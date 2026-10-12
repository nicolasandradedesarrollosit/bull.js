import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "@bull/core";
import { describe, expect, it } from "vitest";
import { runDoctor } from "../src/tooling/doctor";
import { collectInfo, formatInfo } from "../src/tooling/info";
import { templateProject } from "./helpers";

const example = fileURLToPath(new URL("../../../examples/todo-app", import.meta.url));

describe("bull doctor", () => {
  it("reports a healthy example app", async () => {
    const checks = await runDoctor(example);
    expect(checks.filter((c) => c.status !== "ok")).toEqual([]);
    expect(checks.map((c) => c.title)).toContain("A single copy of React");
  });

  it("explains what is missing in a project without dependencies", async () => {
    const checks = await runDoctor(templateProject({ "eslint.config.js": null }), "18.20.0");
    const byTitle = Object.fromEntries(checks.map((c) => [c.title, c]));
    expect(byTitle["Node.js 18.20.0"]?.status).toBe("fail");
    expect(byTitle["React is not installed"]?.hint).toBe("npm install react react-dom");
    expect(byTitle["No ESLint flat config"]?.status).toBe("warn");
  });

  it("flags missing layers and architecture errors", async () => {
    const root = templateProject({
      "src/view/bull-logo.view.tsx": `import { useState } from "react";\nexport function BullLogoView() { const [a] = useState(0); return <i>{a}</i>; }`,
    });
    const checks = await runDoctor(root);
    expect(checks.find((c) => c.title.startsWith("Architecture"))).toMatchObject({
      status: "fail",
      title: "Architecture: 1 error(s)",
    });
  });
});

describe("bull info", () => {
  it("lists the public API of each ViewModel and the Views that bind it", () => {
    const info = collectInfo(
      analyzeProject(example, { rules: { MVVM203: "error" } }),
      path.join(example, "bull.config.ts"),
    );
    expect(info.counts).toEqual({ model: 2, viewmodel: 1, view: 4 });
    const vm = info.viewModels[0]!;
    expect(vm).toMatchObject({
      name: "TodoListViewModel",
      state: ["draft", "filter"],
      injects: ["TodoRepository"],
      usedBy: ["src/view/todo-list.view.tsx"],
    });
    expect(vm.commands).toContain("clearCompleted");
    expect(vm.computed).toContain("visible");
    expect(info.overrides).toEqual(["MVVM203: error"]);
    expect(formatInfo(info, false)).toContain("injects   TodoRepository");
  });
});
