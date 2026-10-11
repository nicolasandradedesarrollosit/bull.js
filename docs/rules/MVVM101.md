# MVVM101 · ViewModel imports View

> **Dependency direction** · error · cannot be disabled · ESLint rule: `bull/viewmodel-imports-view`

The ViewModel cannot know about the View.

## Why

The ViewModel does not know how it is drawn: the View observes it, not the other way around. If the ViewModel imports components it can no longer be reused with another View or tested without rendering.

## How to fix

1. Remove the import of `the View`.
2. If the ViewModel needs the View to do something (navigate, open a modal), expose a `state` the View observes.
