# MVVM302 · ViewModel exposes mutable state

> **ViewModel** · error · cannot be disabled · ESLint rule: `triad/viewmodel-exposes-mutable-state` · auto-fixable with `triad fix`

The ViewModel's public surface is read-only: readonly state, computeds and commands.

## Why

If the View can write state directly, commands lose their meaning and any component can change the screen without going through the ViewModel's logic.

## How to fix

1. Mark `the field` as `readonly` or make it private (`#x`).

## Example

❌ Don't:

```tsx
count = this.state(0);
```

✅ Do:

```tsx
readonly #count = this.state(0);
readonly count = this.#count.readonly;
```
