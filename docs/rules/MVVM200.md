# MVVM200 · View does I/O

> **View** · error · cannot be disabled · ESLint rule: `bull/view-does-io`

The View does not access the network or storage.

## Why

Fetching or saving data is the Model's job. When the View does I/O it mixes how the screen looks with where the data comes from, and every API change forces you to touch components.

## How to fix

1. Move the use of `the API` to a repository in src/model/ (for example `*.repository.ts`).
2. Inject the repository into the ViewModel and expose a `command` that uses it.
3. The View only calls `vm.load.execute()` and shows `vm.load.isRunning`.

## Example

❌ Don't:

```tsx
useEffect(() => {
  fetch("/api/todos").then((r) => r.json()).then(setTodos);
}, []);
```

✅ Do:

```tsx
// model/todo.repository.ts
async list() { return (await fetch("/api/todos")).json(); }

// viewmodel/todo-list.viewmodel.ts
protected override onActivate() { this.load.execute(); }
```
