# MVVM003 · Wrong file name

> **Structure** · error · cannot be disabled · ESLint rule: `bull/file-naming`

Each layer has its convention: *.model.ts, *.viewmodel.ts, *.view.tsx.

## Why

The file name says what role it plays, and Bull uses it to verify the architecture. The Model and the ViewModel are plain TypeScript (.ts): if a file needs .tsx it is because it has JSX, and JSX can only live in the View.

## How to fix

1. Rename the file to `<name>`.
2. Valid suffixes in this layer: see the table below.

## Example

❌ Don't:

```tsx
src/viewmodel/TodoList.tsx
src/model/api.ts
src/view/Header.tsx
```

✅ Do:

```tsx
src/viewmodel/todo-list.viewmodel.ts
src/model/todo.repository.ts
src/view/header.view.tsx
```
