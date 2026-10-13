import { ViewModel } from "@bull-js/runtime";
import type { CounterApi } from "../model/CounterApi";

export class CounterViewModel extends ViewModel {
  count = this.state(0);
  label = "Counter";

  readonly increment = this.command(() => {
    this.count.update((n) => n + 1);
    void this.api.save(this.count.value);
  });

  constructor(readonly api: CounterApi) {
    super();
  }
}
