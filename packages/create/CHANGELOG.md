# @bull-js/create

## 0.3.1

### Patch Changes

- 3293be0: `bull create` makes the first git commit on Windows too: commands no longer go through a shell that
  joined their arguments unquoted, which broke the commit message and printed a DEP0190 warning. New
  projects also ignore `.env` files.
- Updated dependencies [3293be0]
- Updated dependencies [3293be0]
- Updated dependencies [3293be0]
  - @bull-js/cli@0.3.1

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

- Updated dependencies [5dd67f4]
  - @bull-js/cli@0.3.0
