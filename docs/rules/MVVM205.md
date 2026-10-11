# MVVM205 · View creates reactive state

> **View** · error · cannot be disabled · ESLint rule: `bull/view-creates-reactive-state`

The View can only import @bull/runtime/react, not the reactive primitives.

## Why

`state`, `computed` and `effect` are ViewModel tools. If the View uses them, it owns state again, just through a different API.

## How to fix

1. Remove `the import` from the View and declare it in the ViewModel.
2. In the View, only import from "@bull/runtime/react" (useViewModel, useBinding).
