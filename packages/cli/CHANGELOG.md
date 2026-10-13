# @bull-js/cli

## 0.3.0

### Minor Changes

- 5dd67f4: New tooling in the CLI:
  
  - `npm create @bull-js@latest` (new `@bull-js/create` package) and an interactive `bull create` that installs
    the dependencies with the package manager that ran it and initializes git (`--pm`, `--no-install`,
    `--no-git`).
  - `bull init` adds Bull to an existing project without overwriting anything (`--dry-run`).
  - `bull completion <bash|zsh|fish|powershell>` prints shell completions.
  - `bull dev` and `bull build` take `--mode` and `--config`; `bull preview` takes `--open`, `--host` and
    `--out-dir`, and explains when there is no build yet.
  - `bull --version` reads the installed version, and new projects depend on the Bull version that
    created them.

### Patch Changes

- Updated dependencies [53a0cf7]
  - @bull-js/core@0.3.0
