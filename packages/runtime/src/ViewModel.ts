import { Command, type CommandOptions } from "./command";
import { ACTIVATE, DEACTIVATE } from "./lifecycle";
import { Computed, State, effect } from "./reactive";

type EffectFn = () => void | (() => void);

/**
 * Base class of every ViewModel.
 *
 * A ViewModel:
 *  - receives its Model dependencies through the constructor,
 *  - keeps state with `this.state()` and exposes it with `.readonly`,
 *  - derives data with `this.computed()`,
 *  - exposes actions with `this.command()`,
 *  - knows nothing about React, the DOM or how it is drawn.
 *
 * @example
 * export class CounterViewModel extends ViewModel {
 *   readonly #count = this.state(0);
 *   readonly count = this.#count.readonly;
 *   readonly increment = this.command(() => this.#count.update((n) => n + 1));
 * }
 */
export abstract class ViewModel {
  readonly #effects: EffectFn[] = [];
  #running: (() => void)[] = [];
  #activations = 0;

  protected state<T>(initial: T): State<T> {
    return new State(initial);
  }

  protected computed<T>(fn: () => T): Computed<T> {
    return new Computed(fn);
  }

  protected command<A extends unknown[] = [], R = void>(
    fn: (...args: A) => R,
    options?: CommandOptions,
  ): Command<A, R> {
    return new Command(fn, options);
  }

  /** Registers a reaction that runs while the associated View is mounted. */
  protected effect(fn: EffectFn): void {
    this.#effects.push(fn);
    if (this.#activations > 0) this.#running.push(effect(fn));
  }

  /**
   * Called when the View that uses this ViewModel mounts. It is the place to
   * load initial data. It may return a cleanup function.
   */
  protected onActivate(): void | (() => void) {}

  get isActive(): boolean {
    return this.#activations > 0;
  }

  [ACTIVATE](): void {
    if (this.#activations++ > 0) return;
    this.#running = this.#effects.map((fn) => effect(fn));
    const cleanup = this.onActivate();
    if (typeof cleanup === "function") this.#running.push(cleanup);
  }

  [DEACTIVATE](): void {
    if (this.#activations === 0 || --this.#activations > 0) return;
    for (const stop of this.#running.splice(0)) stop();
  }
}
