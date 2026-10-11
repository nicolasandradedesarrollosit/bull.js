import { build as viteBuild } from "vite";
import pc from "picocolors";
import { banner, ensureIndexHtml, fail, loadProject, runAnalysis, viteConfig } from "./shared";

export async function buildCommand(rootArg: string | undefined, options: { outDir?: string }): Promise<void> {
  banner("build");
  const project = await loadProject(rootArg, "build");

  // The architecture is checked BEFORE calling Vite: if it does not respect MVVM, it does not build.
  const result = runAnalysis(project);
  if (result.errorCount > 0) {
    console.log();
    fail(
      `Build cancelled: ${result.errorCount} MVVM architecture ${result.errorCount === 1 ? "violation" : "violations"}.`,
      "Fix them and run `triad build` again.",
    );
    return;
  }
  if (!ensureIndexHtml(project.root)) return;

  console.log();
  await viteBuild(viteConfig(project, { build: { outDir: options.outDir } }));
  console.log(`\n  ${pc.green("✓")} ${pc.bold("Build ready")} ${pc.dim(`→ ${options.outDir ?? "dist"}/`)}\n`);
}
