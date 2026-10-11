# Triad architecture rules

| Code | Rule | Severity | Can be disabled |
|---|---|---|---|
| [MVVM001](./MVVM001.md) | The project must have the src/model, src/viewmodel and src/view folders. | error | no |
| [MVVM002](./MVVM002.md) | All code in src/ must belong to a layer (or be the composition root). | error | no |
| [MVVM003](./MVVM003.md) | Each layer has its convention: *.model.ts, *.viewmodel.ts, *.view.tsx. | error | no |
| [MVVM004](./MVVM004.md) | One of the layers has no files. | warning | yes |
| [MVVM005](./MVVM005.md) | The composition root must exist (src/main.tsx by default). | error | no |
| [MVVM100](./MVVM100.md) | The View can only depend on the ViewModel, never on the Model. | error | no |
| [MVVM101](./MVVM101.md) | The ViewModel cannot know about the View. | error | no |
| [MVVM102](./MVVM102.md) | The Model is the foundation: it cannot import ViewModels or Views. | error | no |
| [MVVM103](./MVVM103.md) | The ViewModel is plain TypeScript: no React, JSX or hooks. | error | no |
| [MVVM104](./MVVM104.md) | The Model cannot depend on React. | error | no |
| [MVVM105](./MVVM105.md) | Some modules import each other in a circle. | error | no |
| [MVVM106](./MVVM106.md) | Nothing can import the composition root. | error | no |
| [MVVM200](./MVVM200.md) | The View does not access the network or storage. | error | no |
| [MVVM201](./MVVM201.md) | State and effects live in the ViewModel, not in View hooks. | error | yes |
| [MVVM202](./MVVM202.md) | The View never writes state: it asks the ViewModel to do it through commands. | error | no |
| [MVVM203](./MVVM203.md) | Filtering, sorting or aggregating data is the job of a ViewModel computed. | warning | yes |
| [MVVM204](./MVVM204.md) | ViewModels are obtained with useViewModel(), not with new. | error | no |
| [MVVM205](./MVVM205.md) | The View can only import @triad/runtime/react, not the reactive primitives. | error | no |
| [MVVM206](./MVVM206.md) | Reading `vm.x.value` in the View is not reactive: use useBinding(). | warning | yes |
| [MVVM300](./MVVM300.md) | Every file in viewmodel/ exports a class that extends ViewModel. | error | no |
| [MVVM301](./MVVM301.md) | The ViewModel does not access document, window, elements or DOM events. | error | no |
| [MVVM302](./MVVM302.md) | The ViewModel's public surface is read-only: readonly state, computeds and commands. | error | no |
| [MVVM303](./MVVM303.md) | One ViewModel per file, and the class is named after the file. | error | no |
| [MVVM304](./MVVM304.md) | Repositories and services are injected through the constructor, not created with new. | error | no |
| [MVVM305](./MVVM305.md) | Network and storage access belong in the Model. | error | yes |
| [MVVM400](./MVVM400.md) | The Model does not use @triad/runtime: observable state is the ViewModel's business. | error | no |
| [MVVM401](./MVVM401.md) | The Model does not know about the DOM. | error | no |
| [MVVM900](./MVVM900.md) | triad.config.ts has an invalid value. | error | no |
| [MVVM901](./MVVM901.md) | The file has a syntax error. | error | no |
