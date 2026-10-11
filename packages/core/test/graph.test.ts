import { describe, expect, it } from "vitest";
import { buildImportGraph, isAutoFixable, serializeResult } from "../src/index";
import { analyze } from "./helpers";

describe("buildImportGraph", () => {
  it("returns every layer file and the edges between them", () => {
    const graph = buildImportGraph(analyze());
    const rels = graph.nodes.map((n) => `${n.kind}:${n.rel}`).sort();
    expect(rels).toContain("viewmodel:src/viewmodel/counter.viewmodel.ts");
    expect(rels).not.toContain("ignored:src/view/counter.view.test.tsx");
    const edge = graph.edges.find((e) => e.from.endsWith("counter.view.tsx") && e.to.endsWith("counter.viewmodel.ts"));
    expect(edge).toMatchObject({ typeOnly: false, inCycle: false });
    expect(edge?.violation).toBeUndefined();
    expect(graph.edges.every((e) => !e.violation)).toBe(true);
  });

  it("marks edges that break the dependency direction", () => {
    const graph = buildImportGraph(
      analyze({ "src/view/label.view.tsx": `import { CounterRepository } from "../model/counter.repository";\nexport const L = () => null;` }),
    );
    const bad = graph.edges.filter((e) => e.violation);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatchObject({ violation: "MVVM100" });
    expect(bad[0]!.to.endsWith("counter.repository.ts")).toBe(true);
  });

  it("marks edges that belong to a cycle", () => {
    const graph = buildImportGraph(
      analyze({
        "src/model/a.model.ts": `import { b } from "./b.model";\nexport const a = () => b;`,
        "src/model/b.model.ts": `import { a } from "./a.model";\nexport const b = () => a;`,
      }),
    );
    expect(graph.cycles).toHaveLength(1);
    expect(graph.edges.filter((e) => e.inCycle)).toHaveLength(2);
  });
});

describe("auto-fixable diagnostics", () => {
  it("flags only the cases triad fix can repair", () => {
    const result = analyze({
      "src/view/label.view.tsx": `import type { Count } from "../model/counter.model";\nimport { CounterRepository } from "../model/counter.repository";\nexport const L = (p: { c: Count }) => null;`,
    });
    expect(result.diagnostics.map((d) => [d.code, isAutoFixable(d)])).toEqual([
      ["MVVM100", true],
      ["MVVM100", false],
    ]);
    expect(serializeResult(result).diagnostics.map((d) => d.fixable)).toEqual([true, false]);
  });
});
