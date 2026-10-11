# MVVM001 · Missing layer

> **Structure** · error · cannot be disabled · ESLint rule: `triad/required-layers`

The project must have the src/model, src/viewmodel and src/view folders.

## Why

Triad organizes the app in three layers with separate responsibilities: the Model (data and business rules), the ViewModel (screen state and actions) and the View (what gets drawn). Each layer lives in its own folder so the direction of dependencies is visible and verifiable.

## How to fix

1. Create the `src/<layer>` folder.
2. Move the files that belong to that layer into it (see `triad explain MVVM003` for naming).
