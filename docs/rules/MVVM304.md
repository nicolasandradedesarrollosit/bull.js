# MVVM304 · ViewModel creates its dependencies

> **ViewModel** · error · cannot be disabled · ESLint rule: `bull/viewmodel-instantiates-dependency`

Repositories and services are injected through the constructor, not created with new.

## Why

If the ViewModel creates its own repository, you cannot pass a fake one in a test or share the same instance across screens. Constructor injection makes dependencies visible and lets the composition root swap them.

## How to fix

1. Take the dependency through the constructor: `constructor(private readonly repo: Repo) { super(); }`.
2. Register it in the composition root: `c.model(Repo, () => new Repo())`.
