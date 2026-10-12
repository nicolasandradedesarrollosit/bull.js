---
"@bull/core": patch
---

The View rules follow members destructured from the ViewModel: after `const { count } = useViewModel(X)`,
`count.set(1)` is reported as MVVM202 and `count.value` as MVVM206, as `vm.count.set(1)` and
`vm.count.value` already were. Aliases, nested patterns, rest elements and destructuring in steps
(`const { pay } = vm`) are followed too, and `bull info` counts a destructured `useViewModel` as a binding.
