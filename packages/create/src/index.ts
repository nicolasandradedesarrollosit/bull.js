#!/usr/bin/env node
// `npm create @bull@latest my-app` (or pnpm, yarn, bun) runs this binary: it is `bull create`.
import { createCommand } from "@bull/cli/create";
import { cac } from "cac";

const cli = cac("create-bull");

cli
  .command("[name]", "Creates a new Bull project (asks for the details without a name)")
  .option("--template <template>", "Template", { default: "default" })
  .option("--pm <pm>", "Package manager: npm | pnpm | yarn | bun (defaults to the one running the command)")
  .option("--no-install", "Do not install the dependencies")
  .option("--no-git", "Do not initialize a git repository")
  .example("  npm create @bull@latest my-app")
  .example("  pnpm create @bull my-app --no-git")
  .action((name: string | undefined, options) => createCommand(name, options));

cli.help();

try {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
} catch (error) {
  console.error(`\n  ✗ ${(error as Error).message}\n`);
  process.exitCode = 1;
}
