// The ViewModel is tested as a plain class: no React, no DOM, with an in-memory repository.
import { describe, expect, it } from "vitest";
import type { CounterRepository } from "../model/counter.repository";
import { CounterViewModel } from "./counter.viewmodel";

function memoryRepository(initial = 0): CounterRepository & { stored: number } {
  return {
    stored: initial,
    load() {
      return this.stored;
    },
    save(value: number) {
      this.stored = value;
    },
  };
}

describe("CounterViewModel", () => {
  it("increments and saves the count", () => {
    const repo = memoryRepository();
    const vm = new CounterViewModel(repo);
    vm.increment.execute();
    vm.increment.execute();
    expect(vm.count.value).toBe(2);
    expect(repo.stored).toBe(2);
  });

  it("can only reset when the count is not zero", () => {
    const vm = new CounterViewModel(memoryRepository());
    expect(vm.reset.canExecute.value).toBe(false);
    vm.increment.execute();
    expect(vm.reset.canExecute.value).toBe(true);
    vm.reset.execute();
    expect(vm.count.value).toBe(0);
  });
});
