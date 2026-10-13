# @bull-js/runtime

The MVVM runtime of [Bull](https://github.com/nicolasandradedesarrollosit/bull.js): observable state,
ViewModels, commands, a dependency-injection container and the React bindings.

```bash
npm install @bull-js/runtime react react-dom
```

```ts
import { ViewModel } from "@bull-js/runtime";

export class CounterViewModel extends ViewModel {
  readonly #count = this.state(0);
  readonly count = this.#count.readonly;
  readonly double = this.computed(() => this.#count.value * 2);
  readonly increment = this.command(() => this.#count.update((n) => n + 1));
}
```

```tsx
import { useBinding, useViewModel } from "@bull-js/runtime/react";

export function CounterView() {
  const vm = useViewModel(CounterViewModel);
  const count = useBinding(vm.count);
  return <button onClick={vm.increment.execute}>{count}</button>;
}
```

| Entry | Exports |
|---|---|
| `@bull-js/runtime` | `ViewModel`, `Command`, `Container`, `Token`, `state`, `computed`, `effect`, `batch`, `untracked` |
| `@bull-js/runtime/react` | `createBullApp`, `BullProvider`, `useViewModel`, `useChildViewModel`, `useBinding` |

The runtime works on its own, but Bull is meant to be used with [`@bull-js/cli`](https://www.npmjs.com/package/@bull-js/cli),
which refuses to build when the code breaks MVVM.

## License

MIT
