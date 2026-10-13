# Changesets

Every pull request that changes a published package adds a changeset:

```bash
npm run changeset
```

Pick the packages and the bump (`patch`, `minor`, `major`) and write one line for the changelog.
The `@bull-js/*` packages are versioned together, so they always share the same version.

When changesets reach `main`, the release workflow opens a "Version packages" pull request that bumps
the versions and updates each package's `CHANGELOG.md`. Merging it publishes to npm.
