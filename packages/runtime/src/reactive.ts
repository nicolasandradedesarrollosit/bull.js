/**
 * Minimal signals-based reactivity.
 *
 * - `State`    mutable source of truth (only the ViewModel writes it).
 * - `Computed` derived value, lazy and cached.
 * - `effect`   reaction that re-runs when its dependencies change.
 *
 * Push-pull propagation: sources mark their observers as "dirty" and values
 * are only recomputed when someone reads them. Reactions (effects and
 * subscribers) are queued and run at the end of the batch, so they never see
 * an intermediate state.
 */

/** Something that can be read and observed. It is all the View ever sees. */
export interface Readable<T> {
  /** Reads the value and tracks the dependency if there is an active observer. */
  readonly value: T;
  /** Reads the value without tracking. */
  peek(): T;
  /** Subscribes to changes. Returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** Read-only view of a `State`. It is what a ViewModel exposes. */
export type ReadonlyState<T> = Readable<T>;

interface Source {
  observers: Set<Observer>;
}

interface Observer {
  sources: Set<Source>;
  /** Called by a source when it changes. */
  invalidate(): void;
}

let activeObserver: Observer | null = null;
let batchDepth = 0;
const pendingReactions = new Set<() => void>();

function track(source: Source): void {
  if (!activeObserver) return;
  source.observers.add(activeObserver);
  activeObserver.sources.add(source);
}

function untrackAll(observer: Observer): void {
  for (const source of observer.sources) source.observers.delete(observer);
  observer.sources.clear();
}

function runTracked<T>(observer: Observer, fn: () => T): T {
  untrackAll(observer);
  const previous = activeObserver;
  activeObserver = observer;
  try {
    return fn();
  } finally {
    activeObserver = previous;
  }
}

function invalidateObservers(source: Source): void {
  // Copy: an observer may re-subscribe while we iterate.
  for (const observer of [...source.observers]) observer.invalidate();
}

function flush(): void {
  while (pendingReactions.size > 0) {
    const reactions = [...pendingReactions];
    pendingReactions.clear();
    for (const reaction of reactions) reaction();
  }
}

/** Groups several writes: reactions run only once, at the end. */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) flush();
  }
}

/** Runs `fn` without tracking dependencies. */
export function untracked<T>(fn: () => T): T {
  const previous = activeObserver;
  activeObserver = null;
  try {
    return fn();
  } finally {
    activeObserver = previous;
  }
}

function subscribeTo(source: Source & { peek(): unknown }, listener: () => void): () => void {
  // An observed Computed stays "hot": it is recomputed before notifying the
  // listener, so it propagates invalidations again on the next change.
  const reaction = () => {
    source.peek();
    listener();
  };
  const observer: Observer = {
    sources: new Set(),
    invalidate: () => {
      pendingReactions.add(reaction);
      if (batchDepth === 0) flush();
    },
  };
  // Reading once builds the dependency graph of a lazy Computed.
  runTracked(observer, () => {
    track(source);
    source.peek();
  });
  return () => {
    untrackAll(observer);
    pendingReactions.delete(reaction);
  };
}

export class State<T> implements Readable<T>, Source {
  readonly observers = new Set<Observer>();
  #value: T;
  #readonly: ReadonlyState<T> | undefined;

  constructor(initial: T) {
    this.#value = initial;
  }

  get value(): T {
    track(this);
    return this.#value;
  }

  peek(): T {
    return this.#value;
  }

  set(next: T): void {
    if (Object.is(next, this.#value)) return;
    this.#value = next;
    batch(() => invalidateObservers(this));
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.#value));
  }

  readonly subscribe = (listener: () => void): (() => void) => subscribeTo(this, listener);

  /** Read-only view: what the ViewModel should expose to the View. */
  get readonly(): ReadonlyState<T> {
    if (!this.#readonly) {
      const self = this;
      this.#readonly = Object.freeze({
        get value() {
          return self.value;
        },
        peek: () => self.peek(),
        subscribe: self.subscribe,
      });
    }
    return this.#readonly;
  }
}

export class Computed<T> implements Readable<T>, Source, Observer {
  readonly observers = new Set<Observer>();
  readonly sources = new Set<Source>();
  #dirty = true;
  #value: T | undefined;
  readonly #fn: () => T;

  constructor(fn: () => T) {
    this.#fn = fn;
  }

  invalidate(): void {
    if (this.#dirty) return;
    this.#dirty = true;
    invalidateObservers(this);
  }

  get value(): T {
    track(this);
    return this.peek();
  }

  peek(): T {
    if (this.#dirty) {
      this.#value = runTracked(this, this.#fn);
      this.#dirty = false;
    }
    return this.#value as T;
  }

  readonly subscribe = (listener: () => void): (() => void) => subscribeTo(this, listener);
}

/**
 * Runs `fn` now and every time something it reads changes.
 * `fn` may return a cleanup function. Returns the function that stops the effect.
 */
export function effect(fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  let disposed = false;
  const observer: Observer = {
    sources: new Set(),
    invalidate: () => {
      if (disposed) return;
      pendingReactions.add(run);
      if (batchDepth === 0) flush();
    },
  };
  function run(): void {
    if (disposed) return;
    if (typeof cleanup === "function") cleanup();
    cleanup = runTracked(observer, fn);
  }
  run();
  return () => {
    disposed = true;
    untrackAll(observer);
    pendingReactions.delete(run);
    if (typeof cleanup === "function") cleanup();
  };
}

export function state<T>(initial: T): State<T> {
  return new State(initial);
}

export function computed<T>(fn: () => T): Computed<T> {
  return new Computed(fn);
}
