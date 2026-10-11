# MVVM203 · Business logic in the View

> **View** · warning · configurable · ESLint rule: `triad/view-business-logic`

Filtering, sorting or aggregating data is the job of a ViewModel computed.

## Why

Deciding which data is shown (filtering, sorting, counting) is presentation logic and belongs in the ViewModel, where it can be tested and is only recomputed when its dependencies change. The View should only iterate (`.map`) over what it receives ready to show.

## How to fix

1. Create a computed in the ViewModel: `readonly visible = this.computed(() => this.#items.value.filter(...))`.
2. Bind it in the View with `useBinding(vm.visible)`.
