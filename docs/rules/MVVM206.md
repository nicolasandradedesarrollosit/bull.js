# MVVM206 · View reads .value without binding

> **View** · warning · configurable · ESLint rule: `bull/view-reads-value`

Reading `vm.x.value` in the View is not reactive: use useBinding().

## Why

`.value` returns the value at that moment, but the View is not notified when it changes. `useBinding` subscribes the component and re-renders it on every change. The same applies to members destructured from the ViewModel: `const { count } = useViewModel(X)` still needs `useBinding(count)`.

## How to fix

1. Replace `vm.x.value` with `useBinding(vm.x)` at the top of the component.
