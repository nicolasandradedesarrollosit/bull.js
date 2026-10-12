# @bull/cli

**Stubborn about architecture.** The CLI of [Bull](https://github.com/nicolasandradedesarrollosit/bull),
the opinionated React framework that refuses to build unless you respect Model–View–ViewModel.
Vite does the bundling; Bull checks the architecture before it runs.

```bash
npm create @bull@latest my-app
cd my-app
npm run dev
```

| Command | What it does |
|---|---|
| `bull dev` | Vite dev server with live architecture checks and a browser overlay |
| `bull build` | Checks the architecture and, only if it holds, builds with Vite |
| `bull preview` | Serves the production build |
| `bull check` | Analysis only, great for CI (`--format json`) |
| `bull explain <rule>` | Explains a rule with "don't / do" examples |
| `bull create <name>` / `bull init` | New project, or add Bull to an existing one |
| `bull generate` (`g`) | Scaffolds features, models, ViewModels and Views |
| `bull fix` | Safe automatic fixes, with `--dry-run` |
| `bull graph` | Import graph between layers (tree, Mermaid, DOT, HTML, JSON) |
| `bull doctor` / `bull info` | Setup checklist and project summary |
| `bull completion <shell>` | Shell completions for bash, zsh, fish and PowerShell |

Configure it in `bull.config.ts`:

```ts
import { defineConfig } from "@bull/cli";

export default defineConfig({
  dev: { overlay: "blocking" },
  vite: { server: { proxy: { "/api": "http://localhost:3000" } } },
});
```

## License

MIT
