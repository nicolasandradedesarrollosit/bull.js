# MVVM005 · Missing composition root

> **Structure** · error · cannot be disabled · ESLint rule: `bull/composition-root`

The composition root must exist (src/main.tsx by default).

## Why

The composition root is the only place that knows all three layers: it creates the Models, tells the container how to build each ViewModel and mounts the root View. Keeping it in one place is what lets the rest of the code depend only on the layer below.

## How to fix

1. Create `src/main.tsx` with createBullApp():
   - createBullApp({ root: AppView, register: (c) => { c.model(...); c.viewModel(...); } });
