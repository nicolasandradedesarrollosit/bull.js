import { analyzeProject, buildImportGraph } from "@bull/core";
import { describe, expect, it } from "vitest";
import { renderDot, renderHtml, renderMermaid, renderTree } from "../src/tooling/graph";
import { templateProject } from "./helpers";

const broken = () =>
  buildImportGraph(
    analyzeProject(
      templateProject({
        "src/view/bull-logo.view.tsx": `import { CounterRepository } from "../model/counter.repository";\nexport function BullLogoView() { return <i>{String(CounterRepository)}</i>; }`,
      }),
    ),
  );

describe("graph renderers", () => {
  it("tree marks the violating edge and summarizes layer edges", () => {
    const tree = renderTree(broken(), false);
    expect(tree).toContain("✗ → src/model/counter.repository.ts  MVVM100");
    expect(tree).toMatch(/View → Model\s+1 {2}✗ MVVM100/);
    expect(tree).toContain("1 edge(s) break the dependency direction");
  });

  it("tree reports a clean project", () => {
    expect(renderTree(buildImportGraph(analyzeProject(templateProject())), false)).toContain(
      "✓ Every edge follows View ──▶ ViewModel ──▶ Model",
    );
  });

  it("mermaid labels and styles the violating edge", () => {
    const mermaid = renderMermaid(broken());
    expect(mermaid).toMatch(/^flowchart LR/);
    expect(mermaid).toContain('subgraph layer_view["View"]');
    expect(mermaid).toMatch(/n\d+ -->\|MVVM100\| n\d+/);
    expect(mermaid).toMatch(/linkStyle \d+ stroke:#e2456f/);
  });

  it("dot clusters files by layer", () => {
    const dot = renderDot(broken());
    expect(dot).toContain("subgraph cluster_viewmodel");
    expect(dot).toContain('label="MVVM100"');
  });

  it("html is a self-contained page with an SVG graph", () => {
    const html = renderHtml(broken(), "demo");
    expect(html).toContain('<svg id="graph"');
    expect(html).toContain('class="edge bad"');
    expect(html).not.toMatch(/<script src=|<link /);
  });
});
