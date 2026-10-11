# MVVM105 · Import cycle

> **Dependency direction** · error · cannot be disabled · ESLint rule: `triad/import-cycle`

Some modules import each other in a circle.

## Why

Dependencies in MVVM form a straight line, from View to ViewModel and from ViewModel to Model. A cycle means two pieces cannot be understood, tested or replaced independently.

## How to fix

1. Cycle: (see above)
2. Extract what they share into a new module both depend on, or invert the dependency with a constructor parameter.
