import { describe, expect, it } from "vitest";
import { analyzeProject } from "../src/index";
import { analyze, codes, makeProject } from "./helpers";

const VM = "src/viewmodel/counter.viewmodel.ts";
const VIEW = "src/view/counter.view.tsx";
const MODEL = "src/model/counter.repository.ts";

describe("valid app", () => {
  it("has no diagnostics", () => {
    const result = analyze();
    expect(result.diagnostics).toEqual([]);
    expect(result.stats).toMatchObject({ model: 2, viewmodel: 1, view: 2, root: 1, allowed: 1, ignored: 1 });
  });
});

describe("structure", () => {
  it("MVVM001: missing layer (and shows the tree)", () => {
    const root = makeProject({
      "src/main.tsx": "export {};",
      "src/model/a.model.ts": "export const a = 1;",
      "src/view/a.view.tsx": "export const A = () => null;",
    });
    const result = analyzeProject(root);
    const missing = result.diagnostics.filter((d) => d.code === "MVVM001");
    expect(missing).toHaveLength(1);
    expect(missing[0]!.data.missing).toBe("viewmodel");
    expect(missing[0]!.notes?.join("\n")).toContain("viewmodel/   ✗ missing");
  });

  it("MVVM001: without src/ all three are missing", () => {
    expect(
      analyzeProject(makeProject({ "README.md": "" })).diagnostics.filter((d) => d.code === "MVVM001"),
    ).toHaveLength(3);
  });

  it("MVVM002: code outside the layers", () => {
    expect(codes({ "src/utils/format.ts": "export const f = 1;" })).toEqual(["MVVM002"]);
  });

  it("MVVM003: file names", () => {
    expect(codes({ "src/model/api.ts": "export {}" })).toEqual(["MVVM003"]);
    expect(codes({ "src/view/Header.tsx": "export const H = () => null;" })).toEqual(["MVVM003"]);
    const d = analyze({ "src/viewmodel/TodoList.tsx": "export {}" }).diagnostics.find((x) => x.code === "MVVM003")!;
    expect(d.message).toContain("there can be no JSX");
    expect(d.data.suggested).toBe("todo-list.viewmodel.ts");
  });

  it("MVVM004: empty layer (warning)", () => {
    const result = analyze({
      "src/model/counter.model.ts": null,
      "src/model/counter.repository.ts": null,
      "src/model/": "",
    });
    expect(result.diagnostics.find((d) => d.code === "MVVM004")?.severity).toBe("warning");
  });

  it("MVVM005: missing composition root", () => {
    expect(codes({ "src/main.tsx": null })).toEqual(["MVVM005"]);
  });
});

describe("dependency direction", () => {
  it("MVVM100: the View imports the Model", () => {
    const result = analyze({
      "src/view/label.view.tsx": `import { CounterRepository } from "../model/counter.repository";\nexport const L = () => null;`,
    });
    const d = result.diagnostics.find((x) => x.code === "MVVM100")!;
    expect(d.range?.start.line).toBe(1);
    expect(d.data.viewModel).toBe("LabelViewModel");
    expect(d.data.typeOnly).toBe("false");
  });

  it("MVVM100: also for type-only imports (suggests re-exporting)", () => {
    const result = analyze({
      "src/view/label.view.tsx": `import type { Count } from "../model/counter.model";\nexport const L = (p: { c: Count }) => null;`,
    });
    expect(result.diagnostics.map((d) => d.code)).toEqual(["MVVM100"]);
    expect(result.diagnostics[0]!.data.typeOnly).toBe("true");
  });

  it("MVVM101: the ViewModel imports the View", () => {
    expect(
      codes({
        [VM]: `import { ViewModel } from "@bull/runtime";\nimport { LabelView } from "../view/label.view";\nexport class CounterViewModel extends ViewModel {}`,
      }),
    ).toEqual(["MVVM101"]);
  });

  it("MVVM102: the Model imports an upper layer", () => {
    expect(
      codes({
        "src/model/counter.model.ts": `import { CounterViewModel } from "../viewmodel/counter.viewmodel";\nexport {}`,
      }),
    ).toContain("MVVM102");
  });

  it("MVVM103: the ViewModel uses React or JSX", () => {
    expect(
      codes({
        [VM]: `import { useState } from "react";\nimport { ViewModel } from "@bull/runtime";\nexport class CounterViewModel extends ViewModel {}`,
      }),
    ).toEqual(["MVVM103"]);
  });

  it("MVVM104 / MVVM400: the Model uses React or the runtime", () => {
    expect(
      codes({
        "src/model/counter.model.ts": `import { useState } from "react";\nimport { state } from "@bull/runtime";\nexport {}`,
      }),
    ).toEqual(["MVVM104", "MVVM400"]);
  });

  it("MVVM105: import cycle", () => {
    const result = analyze({
      "src/model/a.model.ts": `import { b } from "./b.model";\nexport const a = () => b;`,
      "src/model/b.model.ts": `import { a } from "./a.model";\nexport const b = () => a;`,
    });
    const d = result.diagnostics.find((x) => x.code === "MVVM105")!;
    expect(d.data.cycle).toBe("src/model/a.model.ts → src/model/b.model.ts → src/model/a.model.ts");
    expect(d.range?.start.line).toBe(1);
  });

  it("MVVM105: type-only imports do not form cycles", () => {
    expect(
      codes({
        "src/model/a.model.ts": `import type { B } from "./b.model";\nexport type A = { b?: B };`,
        "src/model/b.model.ts": `import type { A } from "./a.model";\nexport type B = { a?: A };`,
      }),
    ).toEqual([]);
  });

  it("MVVM106: importing the composition root (which also forms a cycle)", () => {
    expect(codes({ "src/view/label.view.tsx": `import "../main";\nexport const L = () => null;` })).toEqual([
      "MVVM105",
      "MVVM106",
    ]);
  });
});

describe("View", () => {
  const view = (body: string, imports = "") => ({
    [VIEW]: `import { useBinding, useViewModel } from "@bull/runtime/react";
import { CounterViewModel } from "../viewmodel/counter.viewmodel";
${imports}
export function CounterView() {
  const vm = useViewModel(CounterViewModel);
  const count = useBinding(vm.count);
  ${body}
  return <div>{count}</div>;
}`,
  });

  it("MVVM200: I/O in the View", () => {
    expect(codes(view(`fetch("/api");`))).toEqual(["MVVM200"]);
    expect(codes(view(``, `import axios from "axios";`))).toEqual(["MVVM200"]);
  });

  it("MVVM201: state and effect hooks", () => {
    expect(
      codes(
        view(
          `const [a] = useState(0); useEffect(() => {}, []); const r = useRef(null);`,
          `import { useState, useEffect, useRef } from "react";`,
        ),
      ),
    ).toEqual(["MVVM201", "MVVM201"]);
    expect(codes(view(`const [a] = React.useState(0);`, `import React from "react";`))).toEqual(["MVVM201"]);
  });

  it("MVVM201: a hook can be allowed through config", () => {
    expect(
      codes(view(`const [open] = useState(false);`, `import { useState } from "react";`), {
        view: { allowHooks: ["useState"] },
      }),
    ).toEqual([]);
  });

  it("MVVM202: the View mutates the ViewModel", () => {
    expect(codes(view(`vm.count.value = 3;`))).toEqual(["MVVM202"]);
    expect(codes(view(`vm.count.set(3);`))).toEqual(["MVVM202"]);
  });

  it("MVVM203: business logic on bound data (warning)", () => {
    const result = analyze(view(`const list = useBinding(vm.items); const done = list.filter((x) => x);`));
    expect(result.diagnostics.map((d) => [d.code, d.severity])).toEqual([["MVVM203", "warning"]]);
  });

  it("MVVM204: new on a ViewModel", () => {
    expect(codes(view(`const other = new CounterViewModel(null as never);`))).toEqual(["MVVM204"]);
  });

  it("MVVM205: the View imports reactive primitives", () => {
    expect(codes(view(``, `import { state } from "@bull/runtime";`))).toEqual(["MVVM205"]);
    expect(codes(view(``, `import type { ReadonlyState } from "@bull/runtime";`))).toEqual([]);
  });

  it("MVVM206: reading .value without binding", () => {
    expect(codes(view(`const n = vm.count.value;`))).toEqual(["MVVM206"]);
  });

  describe("with the ViewModel destructured", () => {
    const destructured = (declare: string, body: string) => ({
      [VIEW]: `import { useBinding, useViewModel } from "@bull/runtime/react";
import { CounterViewModel } from "../viewmodel/counter.viewmodel";
export function CounterView() {
  ${declare}
  ${body}
  return <div />;
}`,
    });
    const fromHook = (body: string) =>
      destructured(`const { count, increment } = useViewModel(CounterViewModel);`, body);

    it("is valid when it binds and executes", () => {
      expect(
        codes(
          fromHook(`const n = useBinding(count); const busy = useBinding(increment.isRunning); increment.execute();`),
        ),
      ).toEqual([]);
    });

    it("MVVM202: mutating a destructured member", () => {
      expect(codes(fromHook(`count.set(3);`))).toEqual(["MVVM202"]);
      expect(codes(fromHook(`count.update((n) => n + 1);`))).toEqual(["MVVM202"]);
      expect(codes(fromHook(`count.value = 3;`))).toEqual(["MVVM202"]);
    });

    it("MVVM206: reading .value of a destructured member", () => {
      expect(codes(fromHook(`const n = count.value;`))).toEqual(["MVVM206"]);
      expect(codes(fromHook(`const busy = increment.isRunning.value;`))).toEqual(["MVVM206"]);
    });

    it("follows aliases, nesting, rest and destructuring in steps", () => {
      const alias = destructured(`const { count: total } = useViewModel(CounterViewModel);`, `total.set(1);`);
      expect(codes(alias)).toEqual(["MVVM202"]);
      const nested = destructured(
        `const { increment: { isRunning } } = useViewModel(CounterViewModel);`,
        `const busy = isRunning.value;`,
      );
      expect(codes(nested)).toEqual(["MVVM206"]);
      const rest = destructured(`const { ...all } = useViewModel(CounterViewModel);`, `all.count.set(1);`);
      expect(codes(rest)).toEqual(["MVVM202"]);
      const steps = destructured(
        `const vm = useViewModel(CounterViewModel); const { increment } = vm; const { isRunning } = increment;`,
        `const busy = isRunning.value;`,
      );
      expect(codes(steps)).toEqual(["MVVM206"]);
    });

    it("MVVM203: logic on destructured bound data (warning)", () => {
      const view = destructured(
        `const vm = useViewModel(CounterViewModel); const { items } = useBinding(vm.page);`,
        `const done = items.filter((x) => x);`,
      );
      expect(codes(view)).toEqual(["MVVM203"]);
    });
  });
});

describe("ViewModel", () => {
  const vm = (body: string, extra = "") => ({
    [VM]: `import { ViewModel } from "@bull/runtime";
import { CounterRepository } from "../model/counter.repository";
${extra}
export class CounterViewModel extends ViewModel {
  ${body}
}`,
  });

  it("MVVM300: does not extend ViewModel", () => {
    expect(codes({ [VM]: `export class CounterViewModel {}` })).toEqual(["MVVM300"]);
    expect(codes({ [VM]: `export const x = 1;` })).toEqual(["MVVM300"]);
  });

  it("MVVM301: touches the DOM", () => {
    expect(codes(vm(`readonly focus = this.command(() => document.querySelector("input"));`))).toEqual(["MVVM301"]);
    expect(codes(vm(`readonly onClick = this.command((e: MouseEvent) => e);`))).toEqual(["MVVM301"]);
  });

  it("MVVM302: public mutable state", () => {
    const result = analyze(
      vm(`count = this.state(0);\n  name = "x";\n  constructor(readonly repo: CounterRepository) { super(); }`),
    );
    expect(result.diagnostics.map((d) => [d.code, d.data.kind])).toEqual([
      ["MVVM302", "state"],
      ["MVVM302", "mutable"],
      ["MVVM302", "param"],
    ]);
  });

  it("MVVM303: ViewModel name or count", () => {
    expect(
      codes({ [VM]: `import { ViewModel } from "@bull/runtime";\nexport class Counter extends ViewModel {}` }),
    ).toEqual(["MVVM303"]);
    expect(
      codes({
        [VM]: `import { ViewModel } from "@bull/runtime";\nexport class CounterViewModel extends ViewModel {}\nexport class OtherViewModel extends ViewModel {}`,
      }),
    ).toEqual(["MVVM303"]);
  });

  it("MVVM304: instantiates its dependencies", () => {
    expect(codes(vm(`readonly #repo = new CounterRepository();`))).toEqual(["MVVM304"]);
  });

  it("MVVM305: direct I/O", () => {
    expect(codes(vm(`readonly load = this.command(() => fetch("/api"));`))).toEqual(["MVVM305"]);
  });

  it("local variables shadowing globals do not count", () => {
    expect(codes(vm(`readonly x = this.command((document: string) => document);`))).toEqual([]);
  });
});

describe("Model", () => {
  it("MVVM401: the Model touches the DOM (but may do I/O)", () => {
    expect(
      codes({
        [MODEL]: `export class CounterRepository { a() { return document.title; } b() { return fetch("/x"); } }`,
      }),
    ).toEqual(["MVVM401"]);
  });
});

describe("config", () => {
  it("core rules cannot be turned off", () => {
    const result = analyze({}, { rules: { MVVM100: "off" } });
    expect(result.diagnostics.map((d) => d.code)).toEqual(["MVVM900"]);
    expect(result.diagnostics[0]!.message).toContain("cannot be configured");
  });

  it("configurable rules can be turned off or raised", () => {
    const listFilter = {
      [VIEW]: `import { useBinding, useViewModel } from "@bull/runtime/react";
import { CounterViewModel } from "../viewmodel/counter.viewmodel";
export function CounterView() { const vm = useViewModel(CounterViewModel); const l = useBinding(vm.count); return <i>{[l].filter(Boolean).length}{l.toString()}</i>; }`,
    };
    expect(codes(listFilter)).toEqual([]);
    const result = analyze(
      {
        [VIEW]: `import { useBinding, useViewModel } from "@bull/runtime/react";\nimport { CounterViewModel } from "../viewmodel/counter.viewmodel";\nexport function CounterView() { const vm = useViewModel(CounterViewModel); const l = useBinding(vm.count); l.filter(); return null; }`,
      },
      { rules: { MVVM203: "error" } },
    );
    expect(result.diagnostics.map((d) => d.severity)).toEqual(["error"]);
  });

  it("import aliases", () => {
    expect(
      codes(
        {
          "src/view/label.view.tsx": `import { CounterRepository } from "@/model/counter.repository";\nexport const L = () => null;`,
        },
        { alias: { "@/": "src/" } },
      ),
    ).toEqual(["MVVM100"]);
  });

  it("MVVM901: syntax error", () => {
    const result = analyze({ "src/view/label.view.tsx": `export const L = () => <div>;` });
    expect(result.diagnostics.map((d) => d.code)).toEqual(["MVVM901"]);
  });
});
