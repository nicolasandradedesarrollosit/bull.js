import fs from "node:fs";
import path from "node:path";
import type { BullArchitectureConfig } from "@bull/core";
import { loadConfigFromFile, type UserConfig } from "vite";

export interface BullConfig extends BullArchitectureConfig {
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

/** Type helper for `bull.config.ts`. */
export function defineConfig(config: BullConfig): BullConfig {
  return config;
}

const CONFIG_FILES = ["bull.config.ts", "bull.config.mts", "bull.config.js", "bull.config.mjs"];

export async function loadBullConfig(
  root: string,
  command: "serve" | "build",
): Promise<{ config: BullConfig; file?: string }> {
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
    return { config: (loaded?.config ?? {}) as BullConfig, file };
  } catch (error) {
    const message = (error as Error).message.split("\n")[0];
    const hint = /Cannot find (package|module) '@bull\//.test(message ?? "")
      ? "Did you run `npm install`? The config imports from @bull/cli."
      : "Make sure it default-exports `defineConfig({ ... })`.";
    throw new Error(`Could not load ${path.basename(file)}: ${message}\n    ${hint}`);
  }
}
