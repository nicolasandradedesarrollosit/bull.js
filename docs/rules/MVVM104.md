# MVVM104 · Model uses React

> **Dependency direction** · error · cannot be disabled · ESLint rule: `bull/model-uses-react`

The Model cannot depend on React.

## Why

The Model does not know there is a user interface. Depending on React ties it to a UI technology.

## How to fix

1. Remove the import of `react`. If you need observable state, it belongs in the ViewModel.
