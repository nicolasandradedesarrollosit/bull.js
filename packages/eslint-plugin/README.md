# @bull/eslint-plugin

[Bull](https://github.com/nicolasandradedesarrollosit/bull)'s file-level MVVM rules, underlined in
your editor as you type. Same code and same messages as `bull build`.

```bash
npm install -D @bull/eslint-plugin eslint
```

```js
// eslint.config.js
import bull from "@bull/eslint-plugin";

export default [...bull.configs.recommended];
```

Project-wide rules (missing layers, cycles, the composition root, the config itself) need the whole
project, so they run in `bull check` and `bull build` instead.

## License

MIT
