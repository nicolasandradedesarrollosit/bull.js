# @bull/core

The architecture analysis engine of [Bull](https://github.com/nicolasandradedesarrollosit/bull.js): it
scans a project, extracts facts from every module, builds the import graph and checks the MVVM rules.

You rarely install it directly: [`@bull/cli`](https://www.npmjs.com/package/@bull/cli) runs it before
every build, in the dev server and in `bull check`, and
[`@bull/eslint-plugin`](https://www.npmjs.com/package/@bull/eslint-plugin) runs it in your editor.

```ts
import { formatReport, ProjectAnalyzer } from "@bull/core";

const result = new ProjectAnalyzer(process.cwd(), {}).analyze();
console.log(formatReport(result));
process.exitCode = result.errorCount > 0 ? 1 : 0;
```

It has no dependency on Vite or ESLint. Every rule is documented in the
[rule reference](https://github.com/nicolasandradedesarrollosit/bull.js/tree/main/docs/rules).

## License

MIT
