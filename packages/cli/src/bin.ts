#!/usr/bin/env node
import { cac } from "cac";
import pc from "picocolors";
import { buildCommand } from "./commands/build";
import { checkCommand } from "./commands/check";
import { createCommand } from "./commands/create";
import { devCommand, previewCommand } from "./commands/dev";
import { explainCommand } from "./commands/explain";
import { bullArt, VERSION } from "./ui/brand";

const cli = cac("triad");

cli
  .command("[root]", "Dev server with live architecture checks")
  .alias("dev")
  .option("--port <port>", "Port")
  .option("--open", "Open the browser")
  .option("--host [host]", "Expose on the network")
  .action((root: string | undefined, options) => devCommand(root, options));

cli
  .command("build [root]", "Checks the architecture and, if it holds, builds for production")
  .option("--out-dir <dir>", "Output folder (defaults to dist)")
  .action((root: string | undefined, options) => buildCommand(root, options));

cli
  .command("preview [root]", "Serves the production build")
  .option("--port <port>", "Port")
  .action((root: string | undefined, options) => previewCommand(root, options));

cli
  .command("check [root]", "Only checks the architecture (great for CI)")
  .option("--format <format>", "pretty | json", { default: "pretty" })
  .action((root: string | undefined, options) => checkCommand(root, options));

cli
  .command("explain [code]", "Explains a rule (MVVM100, 100 or view-imports-model). Without a code, lists them all")
  .option("--all", "All rules")
  .option("--format <format>", "text | md")
  .option("--out <dir>", "With --all --format md: folder where the docs are written")
  .action((code: string | undefined, options) => explainCommand(code, options));

cli
  .command("create <name>", "Creates a new project with the MVVM structure")
  .option("--template <template>", "Template", { default: "default" })
  .action((name: string, options) => createCommand(name, options));

cli.help((sections) => {
  // cac's first section is "triad/<version>": the bull replaces it.
  sections[0] = { body: `\n${bullArt()}\n` };
  return sections;
});
cli.version(VERSION);

try {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
} catch (error) {
  console.error(`\n  ${pc.red("✗")} ${(error as Error).message}\n`);
  process.exitCode = 1;
}
