import { createServer, preview } from "vite";
import { banner, ensureIndexHtml, loadProject, viteConfig } from "./shared";

export async function devCommand(
  rootArg: string | undefined,
  options: { port?: number; open?: boolean; host?: string | boolean },
): Promise<void> {
  banner("dev");
  const project = await loadProject(rootArg, "serve");
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

export async function previewCommand(rootArg: string | undefined, options: { port?: number }): Promise<void> {
  banner("preview");
  const project = await loadProject(rootArg, "build");
  const server = await preview(viteConfig(project, { preview: { port: options.port } }));
  server.printUrls();
}
