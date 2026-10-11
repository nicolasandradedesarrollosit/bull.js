import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";
import { analyzeProject, type BullArchitectureConfig } from "../src/index";

const created: string[] = [];
afterAll(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/** A minimal valid app. Tests override it file by file. */
export const VALID_APP: Record<string, string> = {
  "src/main.tsx": `
import { createBullApp } from "@bull/runtime/react";
import { CounterRepository } from "./model/counter.repository";
import { CounterViewModel } from "./viewmodel/counter.viewmodel";
import { CounterView } from "./view/counter.view";
createBullApp({ root: CounterView, register: (c) => {
  c.model(CounterRepository, () => new CounterRepository());
  c.viewModel(CounterViewModel, (c) => new CounterViewModel(c.get(CounterRepository)));
}});
`,
  "src/model/counter.repository.ts": `
export class CounterRepository {
  load(): number { return Number(localStorage.getItem("count") ?? 0); }
  save(n: number) { localStorage.setItem("count", String(n)); }
}
`,
  "src/model/counter.model.ts": `export interface Count { value: number }\n`,
  "src/viewmodel/counter.viewmodel.ts": `
import { ViewModel } from "@bull/runtime";
import type { CounterRepository } from "../model/counter.repository";
export type { Count } from "../model/counter.model";

export class CounterViewModel extends ViewModel {
  readonly #count = this.state(0);
  readonly count = this.#count.readonly;
  readonly double = this.computed(() => this.#count.value * 2);
  readonly increment = this.command(() => {
    this.#count.update((n) => n + 1);
    this.repo.save(this.#count.value);
  });
  constructor(private readonly repo: CounterRepository) { super(); }
  protected override onActivate() { this.#count.set(this.repo.load()); }
}
`,
  "src/view/counter.view.tsx": `
import { useBinding, useViewModel } from "@bull/runtime/react";
import { CounterViewModel, type Count } from "../viewmodel/counter.viewmodel";
import { LabelView } from "./label.view";

export function CounterView() {
  const vm = useViewModel(CounterViewModel);
  const count = useBinding(vm.count);
  const items = useBinding(vm.double);
  return <button onClick={vm.increment.execute}><LabelView text={String(count + items)} /></button>;
}
`,
  "src/view/label.view.tsx": `export function LabelView(props: { text: string }) { return <span>{props.text}</span>; }\n`,
  "src/view/counter.view.test.tsx": `import { useState } from "react"; // tests are not analyzed\n`,
  "src/assets/logo.ts": `export const logo = "x";\n`,
};

export function makeProject(files: Record<string, string | null>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bull-test-"));
  created.push(root);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    const full = path.join(root, rel);
    fs.mkdirSync(rel.endsWith("/") ? full : path.dirname(full), { recursive: true });
    if (rel.endsWith("/")) continue;
    fs.writeFileSync(full, content);
  }
  return root;
}

/** Analyzes the valid app with files replaced (`null` deletes a file). */
export function analyze(overrides: Record<string, string | null> = {}, config?: BullArchitectureConfig) {
  const root = makeProject({ ...VALID_APP, ...overrides });
  return analyzeProject(root, config);
}

export function codes(overrides: Record<string, string | null> = {}, config?: BullArchitectureConfig): string[] {
  return analyze(overrides, config).diagnostics.map((d) => d.code);
}
