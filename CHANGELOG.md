# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-11

### Added

- `@triad/runtime`: signals (`state`, `computed`, `effect`, `batch`), `ViewModel` base class,
  `Command`, `Container` and React bindings (`useViewModel`, `useChildViewModel`, `useBinding`,
  `createTriadApp`).
- `@triad/core`: architecture analyzer with 29 rules (structure, dependency direction, View,
  ViewModel, Model), cycle detection, terminal/JSON/markdown formatters.
- `@triad/cli`: `dev`, `build`, `preview`, `check`, `explain` and `create`, a Vite plugin and a
  browser overlay for architecture violations.
- `@triad/eslint-plugin`: file-level rules as ESLint rules with a recommended flat config.
- `examples/todo-app`, broken fixtures, end-to-end tests and a CI workflow.

[0.1.0]: https://github.com/triad-mvvm/triad/releases/tag/v0.1.0
