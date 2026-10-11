# MVVM002 · File outside the layers

> **Structure** · error · cannot be disabled · ESLint rule: `triad/file-outside-layers`

All code in src/ must belong to a layer (or be the composition root).

## Why

A loose `utils/`, `hooks/` or `services/` folder is a back door: any layer can import it and skip the View → ViewModel → Model direction. In Triad every piece of code has an owner: domain logic goes to the Model, presentation logic to the ViewModel and components to the View.

## How to fix

1. Decide which layer `the file` belongs to:
   - · data, business rules or API access    →  src/model/
   - · state or actions of a screen          →  src/viewmodel/
   - · components that render                →  src/view/
2. If they are static resources (images, styles), add their folder to `allowDirs` in triad.config.ts.
