#!/usr/bin/env node
import { cac } from "cac";
import pc from "picocolors";
import { buildCommand } from "./commands/build";
import { checkCommand } from "./commands/check";
import { createCommand } from "./commands/create";
import { devCommand, previewCommand } from "./commands/dev";
import { explainCommand } from "./commands/explain";
import { doctorCommand } from "./tooling/doctor";
import { fixCommand } from "./tooling/fix";
import { infoCommand } from "./tooling/info";
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
  .example("  bull g feature todo-list")
  .example("  bull g model user --kind repository")
  .action((type: string, name: string | undefined, options) =>
    generateCommand(type, name, { ...options, test: options.test === false ? false : undefined }),
  );

cli
  .command("graph [root]", "Shows the import graph between layers and the edges that break MVVM")
  .option("--format <format>", "tree | mermaid | dot | html | json", { default: "tree" })
  .option("--out <file>", "Write the output to a file (html defaults to bull-graph.html)")
  .option("--open", "Open the HTML graph in the browser")
  .example("  bull graph --format html --open")
  .example("  bull graph --format mermaid > docs/architecture.mmd")
  .action((root: string | undefined, options) => graphCommand(root, options));

cli
  .command("fix [root]", "Applies the safe automatic fixes (renames, readonly state, type re-exports)")
  .option("--dry-run", "Show a diff of the changes without writing them")
  .action((root: string | undefined, options) => fixCommand(root, options));

cli
  .command("doctor [root]", "Checks the environment and the project setup")
  .action((root: string | undefined) => doctorCommand(root));

cli
  .command("info [root]", "Summarizes the project: layers, ViewModel APIs and which Views bind them")
  .option("--json", "Print the summary as JSON")
  .action((root: string | undefined, options) => infoCommand(root, options));

const GROUPS: Array<[title: string, commands: string[]]> = [
  ["Develop", ["", "build", "preview", "create"]],
  ["Architecture", ["check", "explain", "graph", "fix"]],
  ["Tooling", ["generate", "doctor", "info"]],
];

cli.help((sections) => {
  // cac's first section is "bull/<version>": the bull replaces it.
  sections[0] = { body: `\n${bullArt()}\n` };
  const commands = sections.findIndex((s) => s.title === "Commands");
  // Only the global help lists every command; `bull <cmd> --help` keeps cac's sections.
  if (commands >= 0 && (!cli.matchedCommand || cli.matchedCommand.name === "")) {
    const label = (name: string) => {
      const cmd = cli.commands.find((c) => c.name === name)!;
      const aliases = cmd.aliasNames.filter((a) => a !== "dev");
      const raw = name === "" ? "dev [root]" : cmd.rawName;
      return [`${raw}${aliases.length ? pc.dim(` (${aliases.join(", ")})`) : ""}`, cmd.description] as const;
    };
    const width = Math.max(...GROUPS.flatMap(([, names]) => names.map((n) => cmd(label(n)[0]).length))) + 2;
    const body = GROUPS.map(
      ([title, names]) =>
        `${pc.bold(title)}\n` + names.map((n) => `  ${label(n)[0]}${" ".repeat(width - cmd(label(n)[0]).length)}${label(n)[1]}`).join("\n"),
    ).join("\n\n");
    sections.splice(commands, 1, { body });
    const more = sections.findIndex((s) => s.title?.startsWith("For more info"));
    if (more >= 0) sections.splice(more, 1, { body: pc.dim("Run `bull <command> --help` for the options of each command.") });
  }
  return sections;
});

/** Visible length of a string with ANSI colors. */
function cmd(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
cli.version(VERSION);

try {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
} catch (error) {
  console.error(`\n  ${pc.red("✗")} ${(error as Error).message}\n`);
  process.exitCode = 1;
}
