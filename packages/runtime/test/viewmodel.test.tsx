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

  it("clears the error on the next execution and catches synchronous errors too", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    class Flaky extends ViewModel {
      fail = true;
      readonly run = this.command(() => {
        if (this.fail) throw new Error("sync boom");
        return "ok";
      });
    }
    const vm = new Flaky();
    expect(vm.run.execute()).toBeUndefined();
    expect((vm.run.error.value as Error).message).toBe("sync boom");
    vm.fail = false;
    expect(vm.run.execute()).toBe("ok");
    expect(vm.run.error.value).toBeUndefined();
  });

  it("canExecute follows its condition reactively and blocks execute", () => {
    class Form extends ViewModel {
      readonly #name = this.state("");
      readonly sent: string[] = [];
      readonly edit = this.command((name: string) => this.#name.set(name));
      readonly send = this.command(() => this.sent.push(this.#name.value), {
        canExecute: () => this.#name.value.trim().length > 0,
      });
    }
    const vm = new Form();
    const changes = vi.fn();
    vm.send.canExecute.subscribe(changes);
    expect(vm.send.canExecute.value).toBe(false);
    expect(vm.send.execute()).toBeUndefined();
    vm.edit.execute("Ada");
    expect(vm.send.canExecute.value).toBe(true);
    expect(changes).toHaveBeenCalled();
    vm.send.execute();
    expect(vm.sent).toEqual(["Ada"]);
  });

  it("works when destructured: execute is bound to its command", () => {
    const vm = new CounterViewModel(new Counter());
    const { increment, count } = vm;
    const { execute } = increment;
    execute();
    expect(count.value).toBe(1);
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
        <button type="button" onClick={() => vm.increment.execute()}>
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

  it("re-renders only the Views that read what changed", () => {
    class PairViewModel extends ViewModel {
      readonly #left = this.state(0);
      readonly #right = this.state(0);
      readonly left = this.#left.readonly;
      readonly right = this.#right.readonly;
      readonly bumpLeft = this.command(() => this.#left.update((n) => n + 1));
    }
    const vm = new PairViewModel();
    const renders = { left: 0, right: 0 };
    function LeftView() {
      renders.left++;
      return <span>{useBinding(vm.left)}</span>;
    }
    function RightView() {
      renders.right++;
      return <span>{useBinding(vm.right)}</span>;
    }
    render(
      <>
        <LeftView />
        <RightView />
      </>,
    );
    const before = { ...renders };
    act(() => {
      vm.bumpLeft.execute();
    });
    expect(renders.left).toBe(before.left + 1);
    expect(renders.right).toBe(before.right);
  });

  it("does not re-render when a computed recomputes to the same value", () => {
    class ParityViewModel extends ViewModel {
      readonly #n = this.state(0);
      readonly even = this.computed(() => this.#n.value % 2 === 0);
      readonly addTwo = this.command(() => this.#n.update((n) => n + 2));
    }
    const vm = new ParityViewModel();
    let renders = 0;
    function ParityView() {
      renders++;
      return <span>{String(useBinding(vm.even))}</span>;
    }
    render(<ParityView />);
    const before = renders;
    act(() => {
      vm.addTwo.execute(); // still even
    });
    expect(renders).toBe(before);
  });

  it("works with a destructured ViewModel", () => {
    const container = new Container()
      .model(Counter, () => new Counter())
      .viewModel(CounterViewModel, (c) => new CounterViewModel(c.get(Counter)));
    function CounterView() {
      const { count, increment } = useViewModel(CounterViewModel);
      return (
        <button type="button" onClick={increment.execute}>
          {useBinding(count)}
        </button>
      );
    }
    render(
      <BullProvider container={container}>
        <CounterView />
      </BullProvider>,
    );
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button").textContent).toBe("1");
  });

  it("explains how to register a ViewModel with dependencies", () => {
    expect(() => new Container().createViewModel(CounterViewModel)).toThrow(/c\.viewModel\(CounterViewModel/);
  });
});
