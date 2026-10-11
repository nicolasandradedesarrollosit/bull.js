# MVVM305 · ViewModel does direct I/O

> **ViewModel** · error · configurable · ESLint rule: `triad/viewmodel-does-io`

Network and storage access belong in the Model.

## Why

The ViewModel orchestrates, but where the data comes from is the Model's concern. That way you can change the API, add caching or use fake data in a test without touching the screen's logic.

## How to fix

1. Move the use of `the API` to a repository in src/model/.
2. Inject it into the ViewModel through the constructor.
