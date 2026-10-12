# MVVM300 · ViewModel does not extend ViewModel

> **ViewModel** · error · cannot be disabled · ESLint rule: `bull/viewmodel-base-class`

Every file in viewmodel/ exports a class that extends ViewModel.

## Why

The base class provides the primitives (`state`, `computed`, `command`, `effect`) and the lifecycle `useViewModel` relies on. Without it, the View has no uniform contract to bind to.

## How to fix

1. Import the base class: `import { ViewModel } from "@bull/runtime";`.
2. Declare it as `export class XViewModel extends ViewModel { … }`.
