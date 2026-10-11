import { describe, expect, it } from "vitest";
import { formatExplain, formatReport, RULES, ruleToMarkdown, serializeResult } from "../src/index";
import { analyze } from "./helpers";

/** Strip timings so the snapshot is stable. */
function stable(text: string): string {
  return text.replace(/\d+ms/g, "Xms");
}

describe("format", () => {
  const broken = () =>
    analyze({
      "src/view/label.view.tsx": `import { useState } from "react";
import { CounterRepository } from "../model/counter.repository";

export function LabelView(props: { text: string }) {
  const [open, setOpen] = useState(false);
  return <span>{props.text}</span>;
}
`,
    });

  it("terminal report", () => {
    expect(stable(formatReport(broken(), { colors: false, width: 88 }))).toMatchSnapshot();
  });

  it("ok report", () => {
    expect(stable(formatReport(analyze(), { colors: false }))).toContain("✓ MVVM architecture ok · 6 files");
  });

  it("stable JSON for CI", () => {
    const json = serializeResult(broken());
    expect(json.ok).toBe(false);
    expect(json.diagnostics[0]).toMatchObject({
      code: "MVVM100",
      slug: "view-imports-model",
      file: "src/view/label.view.tsx",
      line: 2,
      column: 1,
      explain: "triad explain MVVM100",
    });
    expect(json.diagnostics[0]!.frame?.find((l) => l.highlight)?.line).toBe(2);
  });

  it("explain and markdown", () => {
    expect(formatExplain(RULES.MVVM201, { colors: false })).toMatchSnapshot();
    expect(ruleToMarkdown(RULES.MVVM100)).toContain("ESLint rule: `triad/view-imports-model`");
  });
});
