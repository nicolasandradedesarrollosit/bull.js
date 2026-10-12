import path from "node:path";
import { RULES } from "./rules/meta";
import { normalizePath } from "./paths";
import type { Diagnostic, RuleCode, Severity, SeveritySetting } from "./types";

/** What the user writes in `bull.config.ts`. */
export interface BullArchitectureConfig {
  /** Source folder, relative to the root. Defaults to `src`. */
  srcDir?: string;
  /** The composition root, the only file that sees all three layers. Defaults to `src/main.tsx`. */
  compositionRoot?: string;
  /** Folders inside `src/` allowed besides the layers. Defaults to `assets` and `styles`. */
  allowDirs?: string[];
  /** Import aliases, for example `{ "@/": "src/" }`. */
  alias?: Record<string, string>;
  /**
   * Severity of the configurable rules. Structure and dependency-direction
   * rules are the core of MVVM and cannot be turned off.
   */
  rules?: Partial<Record<RuleCode, SeveritySetting>>;
  view?: {
    /** React hooks the View may use besides the ones allowed by default (for example `["useState"]`). */
    allowHooks?: string[];
  };
}

export interface ResolvedConfig {
  root: string;
  srcDir: string;
  compositionRoot: string;
  allowDirs: string[];
  alias: Array<[prefix: string, target: string]>;
  rules: Map<RuleCode, Severity | "off">;
  view: { allowHooks: Set<string> };
}

export function defineConfig<T extends BullArchitectureConfig>(config: T): T {
  return config;
}

/** Validates and completes the config. Errors are returned as MVVM900 diagnostics. */
export function resolveConfig(
  root: string,
  user: BullArchitectureConfig = {},
): { config: ResolvedConfig; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const configError = (message: string, data: Record<string, string> = {}) =>
    diagnostics.push({ code: "MVVM900", severity: "error", message, data });

  const absRoot = normalizePath(root);
  const srcDir = normalizePath(path.resolve(absRoot, user.srcDir ?? "src"));
  const compositionRoot = normalizePath(path.resolve(absRoot, user.compositionRoot ?? "src/main.tsx"));

  const rel = path.posix.relative(srcDir, compositionRoot);
  const firstSegment = rel.split("/")[0];
  if (firstSegment === "model" || firstSegment === "viewmodel" || firstSegment === "view") {
    configError(`The composition root (${rel}) cannot live inside the "${firstSegment}" layer.`, {
      setting: "compositionRoot",
    });
  }

  const rules = new Map<RuleCode, Severity | "off">();
  for (const [code, setting] of Object.entries(user.rules ?? {}) as Array<[string, SeveritySetting]>) {
    const meta = RULES[code as RuleCode];
    if (!meta) {
      configError(`"${code}" is not a Bull rule. See the list with \`bull explain\`.`, { setting: "rules" });
      continue;
    }
    if (!meta.configurable) {
      configError(
        `${code} (${meta.title.toLowerCase()}) is part of the MVVM core and cannot be configured.`,
        { setting: "rules", rule: code },
      );
      continue;
    }
    if (!["off", "warn", "warning", "error"].includes(setting)) {
      configError(`The severity of ${code} must be "off", "warn" or "error" (got "${setting}").`, {
        setting: "rules",
      });
      continue;
    }
    rules.set(meta.code, setting === "warn" ? "warning" : (setting as Severity | "off"));
  }

  const alias = Object.entries(user.alias ?? {}).map(
    ([prefix, target]) => [prefix, normalizePath(path.resolve(absRoot, target))] as [string, string],
  );

  return {
    config: {
      root: absRoot,
      srcDir,
      compositionRoot,
      allowDirs: (user.allowDirs ?? ["assets", "styles"]).map((dir) => normalizePath(path.resolve(srcDir, dir))),
      alias,
      rules,
      view: { allowHooks: new Set(user.view?.allowHooks ?? []) },
    },
    diagnostics,
  };
}
