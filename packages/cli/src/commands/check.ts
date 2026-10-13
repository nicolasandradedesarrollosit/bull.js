import { serializeResult } from "@bull-js/core";
import { banner, loadProject, runAnalysis } from "./shared";

export async function checkCommand(rootArg: string | undefined, options: { format?: string }): Promise<void> {
  const json = options.format === "json";
  if (!json) banner("check");
  const project = await loadProject(rootArg, "build");

  if (json) {
    const result = project.analyzer.analyze();
    process.stdout.write(`${JSON.stringify(serializeResult(result, { frames: false }), null, 2)}\n`);
    if (result.errorCount > 0) process.exitCode = 1;
    return;
  }

  const result = runAnalysis(project);
  if (result.errorCount > 0) process.exitCode = 1;
}
