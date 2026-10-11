import path from "node:path";
import type { ResolvedConfig } from "./config";
import { CODE_EXTENSIONS, isCodeFile, isTestFile, normalizePath, stripExtension } from "./paths";
import type { FileKind, Layer } from "./types";

export const LAYERS: readonly Layer[] = ["model", "viewmodel", "view"];

export const LAYER_LABEL: Record<FileKind, string> = {
  model: "Model",
  viewmodel: "ViewModel",
  view: "View",
  root: "composition root",
  allowed: "resource",
  outside: "outside the layers",
  ignored: "ignored",
};

function isInside(dir: string, file: string): boolean {
  return file === dir || file.startsWith(dir + "/");
}

/** Classifies a file by where it lives. The file does not need to exist. */
export function classifyFile(file: string, config: ResolvedConfig): FileKind {
  const abs = normalizePath(file);
  if (stripExtension(abs) === stripExtension(config.compositionRoot)) return "root";
  if (!isInside(config.srcDir, abs)) return "outside";
  if (abs.endsWith(".d.ts") || isTestFile(abs)) return "ignored";
  const first = path.posix.relative(config.srcDir, abs).split("/")[0];
  if (first === "model" || first === "viewmodel" || first === "view") return first;
  if (config.allowDirs.some((dir) => isInside(dir, abs))) return "allowed";
  return "outside";
}

export type ImportTarget =
  | { type: "package"; name: string }
  | { type: "file"; kind: FileKind; path: string; resolved?: string };

/**
 * Resolves the target of an import. `exists` (optional) lets it find the real
 * file extension, which the cycle graph needs.
 */
export function resolveImport(
  fromFile: string,
  source: string,
  config: ResolvedConfig,
  exists?: (file: string) => boolean,
): ImportTarget {
  let abs: string | undefined;
  if (source.startsWith("./") || source.startsWith("../") || source === "." || source === "..") {
    abs = path.posix.join(path.posix.dirname(normalizePath(fromFile)), source);
  } else if (source.startsWith("/")) {
    // Root-relative imports, as Vite understands them (`/src/...`).
    abs = path.posix.join(config.root, source);
  } else {
    const alias = config.alias.find(([prefix]) => source === prefix || source.startsWith(prefix));
    if (alias) abs = path.posix.join(alias[1], source.slice(alias[0].length));
  }

  if (abs === undefined) {
    const parts = source.split("/");
    const name = source.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
    return { type: "package", name };
  }

  const resolved = exists ? findFile(abs, exists) : undefined;
  return { type: "file", kind: classifyFile(resolved ?? abs, config), path: abs, resolved };
}

function findFile(base: string, exists: (file: string) => boolean): string | undefined {
  if (isCodeFile(base) && exists(base)) return base;
  for (const ext of CODE_EXTENSIONS) if (exists(base + ext)) return base + ext;
  for (const ext of CODE_EXTENSIONS) if (exists(`${base}/index${ext}`)) return `${base}/index${ext}`;
  // `import "./x.js"` that is actually `x.ts` (NodeNext style).
  const stripped = stripExtension(base);
  if (stripped !== base) for (const ext of CODE_EXTENSIONS) if (exists(stripped + ext)) return stripped + ext;
  return undefined;
}

/** File name suffixes accepted by each layer. */
export const NAMING: Record<Layer, { suffixes: string[]; extension: string }> = {
  model: { suffixes: [".model", ".repository", ".service", ".entity", ".types"], extension: ".ts" },
  viewmodel: { suffixes: [".viewmodel"], extension: ".ts" },
  view: { suffixes: [".view"], extension: ".tsx" },
};
