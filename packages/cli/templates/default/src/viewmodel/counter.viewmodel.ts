// ViewModel: screen state and actions. Does not know how it is drawn.
import { ViewModel } from "@triad/runtime";
import type { CounterRepository } from "../model/counter.repository";

export class CounterViewModel extends ViewModel {
  readonly #count = this.state(0);

  readonly count = this.#count.readonly;
  readonly isZero = this.computed(() => this.#count.value === 0);

  readonly increment = this.command(() => this.#set(this.#count.value + 1));
  readonly reset = this.command(() => this.#set(0), { canExecute: () => !this.isZero.value });

  constructor(private readonly repo: CounterRepository) {
    super();
  }

  protected override onActivate() {
    this.#count.set(this.repo.load());
  }

  #set(value: number): void {
    this.#count.set(value);
    this.repo.save(value);
  }
}
