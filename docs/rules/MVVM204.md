# MVVM204 · View creates its ViewModel with new

> **View** · error · cannot be disabled · ESLint rule: `bull/view-instantiates-viewmodel`

ViewModels are obtained with useViewModel(), not with new.

## Why

`useViewModel` creates the ViewModel once per component, injects its dependencies from the composition root and activates/deactivates it with the View's lifecycle. With `new` a new one is created on every render and injection is lost.

## How to fix

1. Use `const vm = useViewModel(XViewModel);`.
