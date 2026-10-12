import fs from "node:fs";
import path from "node:path";
import { formatReport, ProjectAnalyzer, type AnalysisResult } from "@bull/core";
import react from "@vitejs/plugin-react";
import pc from "picocolors";
import { mergeConfig, type InlineConfig } from "vite";
import { loadBullConfig, type BullConfig } from "../config";
import { bullPlugin } from "../vite/plugin";

export { banner, VERSION } from "../ui/brand";

export function fail(message: string, hint?: string): void {
  console.error(`  ${pc.red("✗")} ${message}`);
  if (hint) console.error(`    ${pc.dim(hint)}`);
  process.exitCode = 1;
}

export interface Project {
  root: string;
  config: BullConfig;
  configFile?: string;
  analyzer: ProjectAnalyzer;
}

export async function loadProject(rootArg: string | undefined, command: "serve" | "build"): Promise<Project> {
  const root = path.resolve(rootArg ?? ".");
  const { config, file } = await loadBullConfig(root, command);
  return { root, config, configFile: file, analyzer: new ProjectAnalyzer(root, config) };
}

/** Runs the analysis and prints it. Returns the result. */
export function runAnalysis(project: Project): AnalysisResult {
  const result = project.analyzer.analyze();
  console.log(formatReport(result, { width: Math.min(process.stdout.columns || 88, 100) }));
  return result;
}

export function ensureIndexHtml(root: string): boolean {
  if (fs.existsSync(path.join(root, "index.html"))) return true;
  fail(
    "index.html was not found at the project root.",
    'Create one with <div id="root"></div> and <script type="module" src="/src/main.tsx"></script>.',
  );
  return false;
}

export function viteConfig(project: Project, extra: InlineConfig = {}): InlineConfig {
  const base: InlineConfig = {
    root: project.root,
    configFile: false,
    clearScreen: false,
    // @bull/runtime/react imports react-dom/client. If Vite discovers it late, it
    // optimizes it separately and the app ends up with two copies of React ("Invalid hook call").
    resolve: { dedupe: ["react", "react-dom"] },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    plugins: [
      react(),
      bullPlugin({
        analyzer: project.analyzer,
        overlay: project.config.dev?.overlay,
        checkOnBuild: false,
      }),
    ],
  };
  return mergeConfig(mergeConfig(base, extra), project.config.vite ?? {});
}
