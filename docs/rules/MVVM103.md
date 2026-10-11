# MVVM103 · ViewModel uses React

> **Dependency direction** · error · cannot be disabled · ESLint rule: `triad/viewmodel-uses-react`

The ViewModel is plain TypeScript: no React, JSX or hooks.

## Why

The ViewModel models the screen without knowing what draws it. If it uses React (hooks, JSX, React event types) it gets tied to the framework and can no longer be tested as a regular class.

## How to fix

1. Remove the import of `react`.
2. Use `this.state()`, `this.computed()` and `this.command()` instead of hooks.
3. If you were receiving React events, have the View pass only the value to the command (`e.target.value`).
