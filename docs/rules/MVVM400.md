# MVVM400 · Model uses the presentation runtime

> **Model** · error · cannot be disabled · ESLint rule: `bull/model-uses-runtime`

The Model does not use @bull-js/runtime: observable state is the ViewModel's business.

## Why

Reactive primitives exist so the View can observe the ViewModel. The Model is pure domain (functions, classes and promises), so it can be used from anywhere.

## How to fix

1. Remove the import of `@bull-js/runtime`.
2. Return data (or promises) and let the ViewModel store it in its `state`.
