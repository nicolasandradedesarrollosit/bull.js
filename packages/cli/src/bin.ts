#!/usr/bin/env node
import { cac } from "cac";
import pc from "picocolors";
import { buildCommand } from "./commands/build";
import { checkCommand } from "./commands/check";
import { createCommand } from "./commands/create";
import { devCommand, previewCommand } from "./commands/dev";
import { explainCommand } from "./commands/explain";
import { generateCommand } from "./tooling/generate";
import { graphCommand } from "./tooling/graph";
import { bullArt, VERSION } from "./ui/brand";

const cli = cac("bull");

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

cli
  .command("generate <type> [name]", "Scaffolds a feature, model, viewmodel or view with the right names")
  .alias("g")
  .option("--kind <kind>", "Model kind: model | entity | repository | service")
  .option("--dry-run", "Show what would be written without writing it")
  .option("--no-test", "Do not generate a ViewModel test")
  .option("--root <dir>", "Project root (defaults to the current folder)")
  .example("bull g feature todo-list")
  .example("bull g model user --kind repository")
  .action((type: string, name: string | undefined, options) =>
    generateCommand(type, name, { ...options, test: options.test === false ? false : undefined }),
  );

cli
  .command("graph [root]", "Shows the import graph between layers and the edges that break MVVM")
  .option("--format <format>", "tree | mermaid | dot | html | json", { default: "tree" })
  .option("--out <file>", "Write the output to a file (html defaults to bull-graph.html)")
  .option("--open", "Open the HTML graph in the browser")
  .example("bull graph --format html --open")
  .example("bull graph --format mermaid > docs/architecture.mmd")
  .action((root: string | undefined, options) => graphCommand(root, options));

cli.help((sections) => {
  // cac's first section is "bull/<version>": the bull replaces it.
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
