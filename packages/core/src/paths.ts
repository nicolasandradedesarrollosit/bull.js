import path from "node:path";

/** Absolute path with `/` and an upper-case drive letter, so comparisons behave on Windows. */
export function normalizePath(p: string): string {
  const resolved = path.resolve(p).replace(/\\/g, "/");
  return /^[a-z]:/.test(resolved) ? resolved[0]!.toUpperCase() + resolved.slice(1) : resolved;
}

export function relativePath(from: string, to: string): string {
  return path.posix.relative(normalizePath(from), normalizePath(to));
}

export function stripExtension(p: string): string {
  return p.replace(/\.(tsx?|jsx?|mts|cts|mjs|cjs)$/, "");
}

export const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

export function isCodeFile(p: string): boolean {
  return CODE_EXTENSIONS.some((ext) => p.endsWith(ext)) && !p.endsWith(".d.ts");
}

export function isTestFile(p: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) || /\/__tests__\//.test(p);
}

/** `todo-list` / `todoList` / `todo_list` → `TodoList`. */
export function toPascalCase(name: string): string {
  return name
    .split(/[-_.\s]+|(?=[A-Z])/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
}
