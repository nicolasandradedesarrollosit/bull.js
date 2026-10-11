// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Container, ViewModel } from "../src/index";
import { ACTIVATE, DEACTIVATE } from "../src/lifecycle";
import { BullProvider, useBinding, useViewModel } from "../src/react";

class Counter {
  next(n: number) {
    return n + 1;
  }
}

class CounterViewModel extends ViewModel {
  readonly #count = this.state(0);
  readonly count = this.#count.readonly;
  readonly double = this.computed(() => this.#count.value * 2);
  readonly increment = this.command(() => this.#count.update((n) => this.counter.next(n)));
  activations = 0;

  constructor(private readonly counter: Counter) {
    super();
  }

  protected override onActivate() {
    this.activations++;
  }
}

afterEach(cleanup);

describe("ViewModel", () => {
  it("exposes read-only state and commands", () => {
    const vm = new CounterViewModel(new Counter());
    vm.increment.execute();
    expect(vm.count.value).toBe(1);
    expect(vm.double.value).toBe(2);
    expect("set" in vm.count).toBe(false);
  });

  it("effects only run while active", () => {
    const seen: number[] = [];
    class Logger extends ViewModel {
      readonly #n = this.state(0);
      readonly bump = this.command(() => this.#n.update((n) => n + 1));
      constructor() {
        super();
        this.effect(() => {
          seen.push(this.#n.value);
        });
      }
    }
    const vm = new Logger();
    vm.bump.execute();
    expect(seen).toEqual([]);
    vm[ACTIVATE]();
    vm.bump.execute();
    vm[DEACTIVATE]();
    vm.bump.execute();
    expect(seen).toEqual([1, 2]);
  });
});

describe("Command", () => {
  it("tracks async command state and blocks double execution", async () => {
    let resolve!: () => void;
    class Saver extends ViewModel {
      readonly save = this.command(() => new Promise<void>((r) => (resolve = r)));
    }
    const vm = new Saver();
    const pending = vm.save.execute();
    expect(vm.save.isRunning.value).toBe(true);
    expect(vm.save.canExecute.value).toBe(false);
    expect(vm.save.execute()).toBeUndefined();
    resolve();
    await pending;
    expect(vm.save.isRunning.value).toBe(false);
  });

  it("captures errors in `error`", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    class Failing extends ViewModel {
      readonly run = this.command(async () => {
        throw new Error("boom");
      });
    }
    const vm = new Failing();
    await vm.run.execute();
    expect((vm.run.error.value as Error).message).toBe("boom");
  });
});

describe("React binding", () => {
  it("useViewModel + useBinding render and react", () => {
    const container = new Container()
      .model(Counter, () => new Counter())
      .viewModel(CounterViewModel, (c) => new CounterViewModel(c.get(Counter)));
    let vmRef: CounterViewModel | undefined;

    function CounterView() {
      const vm = useViewModel(CounterViewModel);
      vmRef = vm;
      const count = useBinding(vm.count);
      const double = useBinding(vm.double);
      return (
        <button onClick={() => vm.increment.execute()}>
          {count}/{double}
        </button>
      );
    }

    render(
      <BullProvider container={container}>
        <CounterView />
      </BullProvider>,
    );
    expect(screen.getByRole("button").textContent).toBe("0/0");
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button").textContent).toBe("1/2");
    expect(vmRef?.activations).toBe(1);
  });

  it("explains how to register a ViewModel with dependencies", () => {
    expect(() => new Container().createViewModel(CounterViewModel)).toThrow(/c\.viewModel\(CounterViewModel/);
  });
});
