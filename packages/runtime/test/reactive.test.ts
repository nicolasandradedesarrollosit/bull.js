import { describe, expect, it, vi } from "vitest";
import { batch, computed, effect, state, untracked } from "../src/reactive";

describe("state", () => {
  it("reads and writes", () => {
    const s = state(1);
    s.set(2);
    expect(s.value).toBe(2);
    s.update((n) => n + 1);
    expect(s.peek()).toBe(3);
  });

  it("the readonly view has no set and reflects changes", () => {
    const s = state("a");
    const ro = s.readonly;
    expect("set" in ro).toBe(false);
    s.set("b");
    expect(ro.value).toBe("b");
    expect(Object.isFrozen(ro)).toBe(true);
  });

  it("notifies subscribers only when the value changes", () => {
    const s = state(1);
    const listener = vi.fn();
    const off = s.subscribe(listener);
    s.set(1);
    s.set(2);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    s.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("computed", () => {
  it("is lazy and cached", () => {
    const s = state(2);
    const fn = vi.fn(() => s.value * 2);
    const double = computed(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(double.value).toBe(4);
    expect(double.value).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
    s.set(5);
    expect(double.value).toBe(10);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("computed subscribers receive every change", () => {
    const s = state(1);
    const c = computed(() => s.value + 1);
    const listener = vi.fn();
    c.subscribe(listener);
    s.set(2);
    s.set(3);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(c.peek()).toBe(4);
  });

  it("has no glitches with diamond dependencies", () => {
    const a = state(1);
    const b = computed(() => a.value * 2);
    const c = computed(() => a.value * 3);
    const seen: number[] = [];
    effect(() => {
      seen.push(b.value + c.value);
    });
    a.set(2);
    expect(seen).toEqual([5, 10]);
  });
});

describe("effect and batch", () => {
  it("re-runs and cleans up", () => {
    const s = state(0);
    const cleanup = vi.fn();
    const runs: number[] = [];
    const stop = effect(() => {
      runs.push(s.value);
      return cleanup;
    });
    s.set(1);
    expect(runs).toEqual([0, 1]);
    expect(cleanup).toHaveBeenCalledTimes(1);
    stop();
    expect(cleanup).toHaveBeenCalledTimes(2);
    s.set(2);
    expect(runs).toEqual([0, 1]);
  });

  it("batch groups writes into a single reaction", () => {
    const a = state(0);
    const b = state(0);
    const runs = vi.fn();
    effect(() => {
      runs(a.value + b.value);
    });
    batch(() => {
      a.set(1);
      b.set(2);
    });
    expect(runs).toHaveBeenCalledTimes(2);
    expect(runs).toHaveBeenLastCalledWith(3);
  });
});

// The guarantees the reactivity docs describe, one test each.
describe("documented behavior", () => {
  it("dependencies are dynamic: a computed follows the branch it last took", () => {
    const useA = state(true);
    const a = state("a");
    const b = state("b");
    const runs = vi.fn();
    const picked = computed(() => {
      runs();
      return useA.value ? a.value : b.value;
    });
    const seen: string[] = [];
    picked.subscribe(() => seen.push(picked.peek()));
    useA.set(false);
    expect(seen).toEqual(["b"]);
    const before = runs.mock.calls.length;
    a.set("A"); // no longer a dependency
    expect(runs.mock.calls.length).toBe(before);
    b.set("B");
    expect(seen).toEqual(["b", "B"]);
  });

  it("peek() and untracked() read without subscribing", () => {
    const s = state(1);
    const peeked = vi.fn();
    const untrackedRuns = vi.fn();
    effect(() => {
      peeked(s.peek());
    });
    effect(() => {
      untrackedRuns(untracked(() => s.value));
    });
    s.set(2);
    expect(peeked).toHaveBeenCalledTimes(1);
    expect(untrackedRuns).toHaveBeenCalledTimes(1);
  });

  it("mutating an array in place notifies nobody; replacing it does", () => {
    const items = state<string[]>([]);
    const listener = vi.fn();
    items.subscribe(listener);
    items.peek().push("lost"); // same array: Object.is says nothing changed
    items.set(items.peek());
    expect(listener).not.toHaveBeenCalled();
    items.update((list) => [...list, "seen"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("nested batches notify once, when the outermost one ends, and return fn's value", () => {
    const a = state(0);
    const runs = vi.fn();
    effect(() => {
      runs(a.value);
    });
    const result = batch(() => {
      a.set(1);
      batch(() => a.set(2));
      expect(runs).toHaveBeenCalledTimes(1); // still inside the outer batch
      return "done";
    });
    expect(result).toBe("done");
    expect(runs).toHaveBeenCalledTimes(2);
    expect(runs).toHaveBeenLastCalledWith(2);
  });

  it("an effect runs right away and synchronously after each change", () => {
    const s = state(0);
    const runs: number[] = [];
    effect(() => {
      runs.push(s.value);
    });
    expect(runs).toEqual([0]);
    s.set(1);
    expect(runs).toEqual([0, 1]); // no microtask needed
  });

  it("a computed that throws rethrows on read and retries on the next read", () => {
    const fail = state(true);
    const c = computed(() => {
      if (fail.value) throw new Error("boom");
      return "ok";
    });
    expect(() => c.value).toThrow("boom");
    expect(() => c.value).toThrow("boom");
    fail.set(false);
    expect(c.value).toBe("ok");
  });

  it("the diamond: a reaction sees first and last change together", () => {
    const first = state("Ada");
    const last = state("Lovelace");
    const full = computed(() => `${first.value} ${last.value}`);
    const initials = computed(() => `${first.value[0]}${last.value[0]}`);
    const seen: string[] = [];
    effect(() => {
      seen.push(`${full.value} (${initials.value})`);
    });
    batch(() => {
      first.set("Grace");
      last.set("Hopper");
    });
    expect(seen).toEqual(["Ada Lovelace (AL)", "Grace Hopper (GH)"]);
  });
});

describe("documented behavior inside a batch", () => {
  it("reads inside a batch see the latest values, computeds included", () => {
    const a = state(1);
    const double = computed(() => a.value * 2);
    double.subscribe(() => {});
    batch(() => {
      a.set(5);
      expect(a.value).toBe(5);
      expect(double.value).toBe(10);
    });
  });
});
