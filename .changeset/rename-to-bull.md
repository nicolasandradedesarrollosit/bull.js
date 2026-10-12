---
"@bull/runtime": minor
"@bull/core": minor
"@bull/eslint-plugin": minor
"@bull/cli": minor
---

Triad is now Bull. Packages move from `@triad/*` to `@bull/*`, the binary from `triad` to `bull` and the
config file from `triad.config.ts` to `bull.config.ts`. `createTriadApp`, `TriadProvider` and
`triadPlugin` are now `createBullApp`, `BullProvider` and `bullPlugin`, and ESLint rules use the
`bull/` prefix.
