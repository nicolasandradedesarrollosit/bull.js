# MVVM301 · ViewModel touches the DOM

> **ViewModel** · error · cannot be disabled · ESLint rule: `bull/viewmodel-touches-dom`

The ViewModel does not access document, window, elements or DOM events.

## Why

The ViewModel describes the screen abstractly (what data exists and what actions are available). The DOM is a View detail. If the ViewModel touches it, it cannot be tested outside a browser or reused with another View.

## How to fix

1. Remove the use of `the DOM API`.
2. If it receives an event, have the View pass only the value (`e.target.value`).
3. If it needs to show something (alert, focus, scroll), expose a `state` that the View observes and acts on.
