# MVVM100 · View imports Model

> **Dependency direction** · error · cannot be disabled · ESLint rule: `triad/view-imports-model` · auto-fixable with `triad fix`

The View can only depend on the ViewModel, never on the Model.

## Why

The View only knows its ViewModel. If it talks to the Model directly, presentation logic gets tied to the UI: it can no longer be tested without React, and changing where the data comes from means touching components. The ViewModel exists precisely to translate between both layers.

## How to fix

1. Move the use of `the import` to this View's ViewModel (inject it through the constructor).
2. Expose the data as `state`/`computed` and the actions as `command`.
3. In the View, use `useViewModel(...)` and `useBinding(...)`.

## Example

❌ Don't:

```tsx
import { TodoRepository } from "../model/todo.repository";

export function TodoListView() {
  const todos = new TodoRepository().list();
  …
}
```

✅ Do:

```tsx
import { TodoListViewModel } from "../viewmodel/todo-list.viewmodel";

export function TodoListView() {
  const vm = useViewModel(TodoListViewModel);
  const todos = useBinding(vm.todos);
  …
}
```
