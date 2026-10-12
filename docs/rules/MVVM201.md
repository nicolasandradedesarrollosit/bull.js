# MVVM201 · View owns state

> **View** · error · configurable · ESLint rule: `bull/view-owns-state`

State and effects live in the ViewModel, not in View hooks.

## Why

In MVVM the View has no state: it only reflects the ViewModel's and delegates actions to it. With `useState`/`useEffect` in the View, logic gets scattered across components and can no longer be tested without rendering.

## How to fix

1. Move that state to the ViewModel with `this.state(...)` and expose it with `.readonly`.
2. Read it in the View with `useBinding(vm.x)` and change it with a `command`.
3. If it is purely visual state (an open dropdown), you can allow it with `view.allowHooks` in bull.config.ts.

## Example

❌ Don't:

```tsx
const [count, setCount] = useState(0);
<button onClick={() => setCount(count + 1)}>
```

✅ Do:

```tsx
// viewmodel
readonly #count = this.state(0);
readonly count = this.#count.readonly;
readonly increment = this.command(() => this.#count.update((n) => n + 1));

// view
const count = useBinding(vm.count);
<button onClick={vm.increment.execute}>
```
