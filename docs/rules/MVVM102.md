# MVVM102 · Model imports an upper layer

> **Dependency direction** · error · cannot be disabled · ESLint rule: `triad/model-imports-upper-layer`

The Model is the foundation: it cannot import ViewModels or Views.

## Why

The Model is the core of the app: entities, business rules and data access. It must be usable from any screen, or even without screens (in a test or a script). If it knows about upper layers, responsibilities become circularly coupled.

## How to fix

1. Remove the import of `the upper layer`.
2. If the Model needs to notify changes, return the data or expose a callback/event the ViewModel listens to.
