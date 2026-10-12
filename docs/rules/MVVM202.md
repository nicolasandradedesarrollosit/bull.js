# MVVM202 · View mutates ViewModel

> **View** · error · cannot be disabled · ESLint rule: `bull/view-mutates-viewmodel`

The View never writes state: it asks the ViewModel to do it through commands.

## Why

Communication from the View to the ViewModel only happens through commands. That way every state change has a single place where it happens, with its validation, loading state and errors. Destructuring does not change it: after `const { count } = useViewModel(X)`, `count.set(1)` is the same violation.

## How to fix

1. Instead of `changing the state`, add a command to the ViewModel.
   - readonly rename = this.command((name: string) => this.#name.set(name));
2. From the View: `vm.rename.execute(e.target.value)`.
