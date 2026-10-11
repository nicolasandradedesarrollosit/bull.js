import fs from "node:fs";
import path from "node:path";
import type { TriadArchitectureConfig } from "@triad/core";
import { loadConfigFromFile, type UserConfig } from "vite";

export interface TriadConfig extends TriadArchitectureConfig {
  dev?: {
    port?: number;
    open?: boolean;
    /**
     * How the browser overlay behaves when there are architecture violations.
     * - `dismissible` (default): it can be closed to keep trying the app.
     * - `blocking`: it cannot be closed until the code respects MVVM.
     */
    overlay?: "dismissible" | "blocking" | false;
  };
  /** Extra Vite options (aliases, proxy, additional plugins…). */
  vite?: UserConfig;
}

/** Type helper for `triad.config.ts`. */
export function defineConfig(config: TriadConfig): TriadConfig {
  return config;
}

const CONFIG_FILES = ["triad.config.ts", "triad.config.mts", "triad.config.js", "triad.config.mjs"];

export async function loadTriadConfig(
  root: string,
  command: "serve" | "build",
): Promise<{ config: TriadConfig; file?: string }> {
  const file = CONFIG_FILES.map((name) => path.join(root, name)).find((p) => fs.existsSync(p));
  if (!file) return { config: {} };
  try {
    const loaded = await loadConfigFromFile(
      { command, mode: command === "build" ? "production" : "development" },
      file,
      root,
      "silent",
      undefined,
      // "runner" executes the config with Vite's module runner, without bundling it.
      "runner",
    );
    return { config: (loaded?.config ?? {}) as TriadConfig, file };
  } catch (error) {
    const message = (error as Error).message.split("\n")[0];
    const hint = /Cannot find (package|module) '@triad\//.test(message ?? "")
      ? "Did you run `npm install`? The config imports from @triad/cli."
      : "Make sure it default-exports `defineConfig({ ... })`.";
    throw new Error(`Could not load ${path.basename(file)}: ${message}\n    ${hint}`);
  }
}
