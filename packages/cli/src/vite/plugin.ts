import {
  type AnalysisResult,
  type BullArchitectureConfig,
  formatReport,
  normalizePath,
  ProjectAnalyzer,
  serializeResult,
} from "@bull-js/core";
import pc from "picocolors";
import type { Plugin, ViteDevServer } from "vite";
import { OVERLAY_PUBLIC_PATH, type OverlayPayload, overlayModuleCode } from "./overlay-client";

export interface BullPluginOptions {
  /** Project root. Defaults to Vite's `root`. */
  root?: string;
  config?: BullArchitectureConfig;
  /** An existing analyzer (the CLI shares it to avoid analyzing twice). */
  analyzer?: ProjectAnalyzer;
  /** Browser overlay in dev. Defaults to `dismissible`. */
  overlay?: "dismissible" | "blocking" | false;
  /** Check the architecture in `buildStart`. The CLI turns it off because it checks before calling Vite. */
  checkOnBuild?: boolean;
}

const VIRTUAL_OVERLAY = "\0bull-overlay";

/**
 * Vite plugin that enforces the MVVM architecture.
 * - On build: fails if there are architecture errors.
 * - On dev: re-analyzes on every change and shows the report in the
 *   terminal and in a browser overlay.
 *
 * It can also be used on its own in a `vite.config.ts`.
 */
export function bullPlugin(options: BullPluginOptions = {}): Plugin {
  let analyzer = options.analyzer;
  let isBuild = false;
  let last: AnalysisResult | undefined;
  let lastKey = "";
  const overlayMode = options.overlay ?? "dismissible";

  const payload = (): OverlayPayload => {
    const s = serializeResult(last!);
    return {
      errorCount: s.errorCount,
      warningCount: s.warningCount,
      diagnostics: s.diagnostics,
      mode: overlayMode || "dismissible",
    };
  };

  function runDev(server: ViteDevServer, initial = false): void {
    const previous = last;
    last = analyzer!.analyze();
    const key = JSON.stringify(last.diagnostics);
    if (key === lastKey && !initial) return;
    lastKey = key;

    if (last.diagnostics.length > 0) {
      console.log(`\n${formatReport(last, { width: Math.min(process.stdout.columns || 88, 100) })}`);
    } else if (previous && previous.diagnostics.length > 0) {
      console.log(`\n  ${pc.green("✓")} ${pc.bold("MVVM architecture ok")} ${pc.dim("· every violation was fixed")}\n`);
    }
    if (overlayMode) server.ws.send("bull:diagnostics", payload());
  }

  return {
    name: "bull:mvvm",
    enforce: "pre",

    configResolved(config) {
      isBuild = config.command === "build";
      analyzer ??= new ProjectAnalyzer(options.root ?? config.root, options.config);
    },

    buildStart() {
      if (!isBuild || options.checkOnBuild === false) return;
      const result = analyzer!.analyze();
      if (result.diagnostics.length) console.log(`\n${formatReport(result)}`);
      if (result.errorCount > 0) {
        this.error(`The MVVM architecture has ${result.errorCount} error(s). Fix them to be able to build.`);
      }
    },

    configureServer(server) {
      const { srcDir, compositionRoot } = analyzer!.config;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => runDev(server), 40);
      };

      server.watcher.on("all", (event, file) => {
        const abs = normalizePath(file);
        if (!abs.startsWith(`${srcDir}/`) && abs !== srcDir && abs !== compositionRoot) return;
        if (event === "change" || event === "unlink") analyzer!.invalidate(abs);
        schedule();
      });

      if (overlayMode) {
        server.ws.on("bull:request", (_data: unknown, client: { send(event: string, payload?: unknown): void }) => {
          if (last) client.send("bull:diagnostics", payload());
        });
      }
      runDev(server, true);
    },

    resolveId(id) {
      if (id === OVERLAY_PUBLIC_PATH) return VIRTUAL_OVERLAY;
    },

    load(id) {
      if (id === VIRTUAL_OVERLAY) return overlayModuleCode();
    },

    transformIndexHtml: {
      order: "pre",
      handler(_html, ctx) {
        if (!ctx.server || !overlayMode) return;
        return [{ tag: "script", attrs: { type: "module", src: OVERLAY_PUBLIC_PATH }, injectTo: "head" }];
      },
    },
  };
}
