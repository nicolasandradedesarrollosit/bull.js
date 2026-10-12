import { Computed, type ReadonlyState, State } from "./reactive";

export interface CommandOptions {
  /** Extra condition to be able to execute (for example, a valid form). It is reactive. */
  canExecute?: () => boolean;
}

/** What `execute` returns: `undefined` if the command could not run or failed. */
export type CommandResult<R> = R extends PromiseLike<infer U> ? Promise<U | undefined> : R | undefined;

/**
 * An action the ViewModel exposes to the View.
 *
 * The View never changes state: it calls `vm.something.execute(...)`. The
 * command publishes its own observable state (`isRunning`, `error`,
 * `canExecute`) so the View can disable buttons or show errors without logic.
 */
export class Command<A extends unknown[] = [], R = void> {
  readonly #running = new State(false);
  readonly #error = new State<unknown>(undefined);
  readonly #fn: (...args: A) => R;

  /** `true` while an async command is running. */
  readonly isRunning: ReadonlyState<boolean> = this.#running.readonly;
  /** The last error, or `undefined`. Cleared on the next execution. */
  readonly error: ReadonlyState<unknown> = this.#error.readonly;
  /** `false` while running or when `options.canExecute` returns `false`. */
  readonly canExecute: ReadonlyState<boolean>;

  constructor(fn: (...args: A) => R, options: CommandOptions = {}) {
    this.#fn = fn;
    const extra = options.canExecute;
    this.canExecute = new Computed(() => !this.#running.value && (extra ? extra() : true));
  }

  /** Runs the action. It is bound, so it can be passed straight to an `onClick`. */
  readonly execute = (...args: A): CommandResult<R> => {
    if (!this.canExecute.peek()) return undefined as CommandResult<R>;
    this.#error.set(undefined);
    let result: R;
    try {
      result = this.#fn(...args);
    } catch (error) {
      this.#fail(error);
      return undefined as CommandResult<R>;
    }
    if (!isThenable(result)) return result as CommandResult<R>;
    this.#running.set(true);
    return Promise.resolve(result).then(
      (value) => {
        this.#running.set(false);
        return value;
      },
      (error: unknown) => {
        this.#running.set(false);
        this.#fail(error);
        return undefined;
      },
    ) as CommandResult<R>;
  };

  #fail(error: unknown): void {
    this.#error.set(error);
    console.error("[bull] A command failed:", error);
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === "function";
}
