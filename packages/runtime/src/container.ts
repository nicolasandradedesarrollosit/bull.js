import type { ViewModel } from "./ViewModel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Token<T> = abstract new (...args: any[]) => T;
type Factory<T> = (container: Container) => T;

/**
 * Dependency registry of the composition root (`src/main.tsx`).
 *
 * - Models are singletons: created once and shared.
 * - ViewModels are created once per View that uses them.
 */
export class Container {
  readonly #models = new Map<Token<unknown>, { factory: Factory<unknown>; instance?: unknown }>();
  readonly #viewModels = new Map<Token<unknown>, Factory<unknown>>();

  /** Registers a Model (repository, service or shared entity). */
  model<T>(token: Token<T>, factory: Factory<T>): this {
    this.#models.set(token, { factory });
    return this;
  }

  /** Registers how to build a ViewModel and inject its dependencies. */
  viewModel<T extends ViewModel>(token: Token<T>, factory: Factory<T>): this {
    this.#viewModels.set(token, factory);
    return this;
  }

  /** Gets a registered Model. */
  get<T>(token: Token<T>): T {
    const entry = this.#models.get(token);
    if (!entry) {
      if (this.#viewModels.has(token)) {
        throw new Error(
          `[triad] ${token.name} is a ViewModel. ViewModels are not requested from the container: ` +
            `the View creates them with useViewModel(${token.name}).`,
        );
      }
      throw new Error(
        `[triad] No Model is registered as ${token.name}.\n` +
          `Register it in the composition root (src/main.tsx):\n` +
          `  c.model(${token.name}, () => new ${token.name}())`,
      );
    }
    if (!("instance" in entry)) entry.instance = entry.factory(this);
    return entry.instance as T;
  }

  /** Creates a new ViewModel instance. Used by `useViewModel`. */
  createViewModel<T extends ViewModel>(token: Token<T>): T {
    const factory = this.#viewModels.get(token);
    if (factory) return factory(this) as T;
    if (token.length === 0) return new (token as unknown as new () => T)();
    throw new Error(
      `[triad] ${token.name} needs dependencies, but no factory is registered.\n` +
        `Register it in the composition root (src/main.tsx):\n` +
        `  c.viewModel(${token.name}, (c) => new ${token.name}(c.get(MyRepository)))`,
    );
  }
}
