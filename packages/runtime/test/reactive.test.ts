import { describe, expect, it, vi } from "vitest";
import { batch, computed, effect, state } from "../src/reactive";

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
