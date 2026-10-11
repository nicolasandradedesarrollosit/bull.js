import { Linter, RuleTester } from "eslint";
import { describe, expect, it } from "vitest";
import plugin from "../src/index";

const cwd = "/project";

function lint(file: string, code: string) {
  const linter = new Linter({ cwd });
  return linter.verify(code, plugin.configs.recommended, { filename: `${cwd}/${file}` });
}

describe("@triad/eslint-plugin", () => {
  it("exposes one rule per file-level code", () => {
    expect(Object.keys(plugin.rules)).toContain("view-imports-model");
    expect(Object.keys(plugin.rules)).not.toContain("required-layers"); // project-level rule
  });

  it("reports the same as the build, with the same code", () => {
    const messages = lint(
      "src/view/todo.view.tsx",
      `import { useState } from "react";
import { TodoRepository } from "../model/todo.repository";
export function TodoView() { const [a] = useState(0); return <p>{a}</p>; }`,
    );
    expect(messages.map((m) => [m.ruleId, m.line])).toEqual([
      ["triad/view-imports-model", 2],
      ["triad/view-owns-state", 3],
    ]);
    expect(messages[0]!.message).toContain("MVVM100");
    expect(messages[0]!.message).toContain("TodoViewModel");
  });

  it("a correct app has no errors", () => {
    expect(
      lint(
        "src/viewmodel/todo.viewmodel.ts",
        `import { ViewModel } from "@triad/runtime";
export class TodoViewModel extends ViewModel { readonly #n = this.state(0); readonly n = this.#n.readonly; }`,
      ),
    ).toEqual([]);
  });

  it("files outside src/ are ignored", () => {
    // The recommended config only applies to src/: ESLint does not even run Triad's rules.
    expect(lint("vite.config.ts", `import React from "react";`).filter((m) => m.ruleId?.startsWith("triad/"))).toEqual([]);
  });
});

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: plugin.configs.recommended[0]!.languageOptions });

tester.run("viewmodel-touches-dom", plugin.rules["viewmodel-touches-dom"]!, {
  valid: [
    {
      filename: `${process.cwd()}/src/viewmodel/a.viewmodel.ts`,
      code: `import { ViewModel } from "@triad/runtime";\nexport class AViewModel extends ViewModel {}`,
    },
  ],
  invalid: [
    {
      filename: `${process.cwd()}/src/viewmodel/a.viewmodel.ts`,
      code: `import { ViewModel } from "@triad/runtime";\nexport class AViewModel extends ViewModel { readonly t = this.computed(() => document.title); }`,
      errors: [{ messageId: "violation" }],
    },
  ],
});
