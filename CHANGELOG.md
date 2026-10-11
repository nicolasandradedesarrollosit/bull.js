# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-11

### Added

- Bull branding: logo, mono logo, wordmark and favicon in `assets/brand`, the Taurus glyph in the
  CLI banner, an ASCII bull in `--help`, `create` and `doctor`, and the logo in the dev overlay,
  the example app and the `create` template.
- `bull generate` (`g`): scaffolds features (repository + injected ViewModel + test + View,
  registered in the composition root), models, ViewModels and Views.
- `bull fix`: safe codemods for MVVM003, MVVM302 and type-only MVVM100, with a `--dry-run` diff.
- `bull graph`: import graph as a terminal tree, Mermaid, DOT, JSON or a self-contained HTML page.
- `bull doctor` and `bull info`.
- `@bull/core`: `buildImportGraph()`, `isAutoFixable()`, `RuleMeta.fixable`, declarator arguments
  and constructor dependency types in `ModuleFacts`.
- Auto-fixable diagnostics are flagged in the terminal report, `explain`, JSON and the overlay.

### Changed

- `--help` groups commands under Develop, Architecture and Tooling.
- Every package exposes `./package.json` in its `exports`.
- The `create` template ships Vitest and targets ESLint 10 and TypeScript 6.

## [0.1.0] - 2026-10-11

### Added

- `@bull/runtime`: signals (`state`, `computed`, `effect`, `batch`), `ViewModel` base class,
  `Command`, `Container` and React bindings (`useViewModel`, `useChildViewModel`, `useBinding`,
  `createBullApp`).
- `@bull/core`: architecture analyzer with 29 rules (structure, dependency direction, View,
  ViewModel, Model), cycle detection, terminal/JSON/markdown formatters.
- `@bull/cli`: `dev`, `build`, `preview`, `check`, `explain` and `create`, a Vite plugin and a
  browser overlay for architecture violations.
- `@bull/eslint-plugin`: file-level rules as ESLint rules with a recommended flat config.
- `examples/todo-app`, broken fixtures, end-to-end tests and a CI workflow.
