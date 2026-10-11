# MVVM401 · Model touches the DOM

> **Model** · error · cannot be disabled · ESLint rule: `bull/model-touches-dom`

The Model does not know about the DOM.

## Why

The Model does not know there is a screen. It may do I/O (fetch, storage), but never manipulate the UI.

## How to fix

1. Remove the use of `the DOM API`. If needed, expose the data and let the View draw it.
