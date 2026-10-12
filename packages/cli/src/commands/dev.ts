import fs from "node:fs";
import path from "node:path";
import { createServer, preview } from "vite";
import { banner, ensureIndexHtml, fail, loadProject, viteConfig } from "./shared";

export async function devCommand(
  rootArg: string | undefined,
  options: { port?: number; open?: boolean; host?: string | boolean; mode?: string; config?: string },
): Promise<void> {
  banner("dev");
  const project = await loadProject(rootArg, "serve", { mode: options.mode, configFile: options.config });
  if (!ensureIndexHtml(project.root)) return;

  const server = await createServer(
    viteConfig(project, {
      server: {
        port: options.port ?? project.config.dev?.port,
        open: options.open ?? project.config.dev?.open,
        host: options.host,
      },
    }),
  );
  await server.listen();
  server.printUrls();
  server.bindCLIShortcuts({ print: true });
}

export async function previewCommand(
  rootArg: string | undefined,
  options: { port?: number; open?: boolean; host?: string | boolean; outDir?: string; config?: string },
): Promise<void> {
  banner("preview");
  const project = await loadProject(rootArg, "build", { configFile: options.config });
  const outDir = options.outDir ?? project.config.vite?.build?.outDir ?? "dist";
  if (!fs.existsSync(path.resolve(project.root, outDir, "index.html"))) {
    fail(`There is no build in ${outDir}/ to preview.`, "Run `bull build` first.");
    return;
  }
  const server = await preview(
    viteConfig(project, {
      build: { outDir },
      preview: { port: options.port, open: options.open, host: options.host },
    }),
  );
  server.printUrls();
}
