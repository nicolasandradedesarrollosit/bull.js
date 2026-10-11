import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { banner, fail } from "./shared";

/** `templates/` sits next to `dist/` (published) or `src/` (development). */
function templatesDir(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, "templates");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error("Triad templates were not found.");
}

function copyTemplate(from: string, to: string, vars: Record<string, string>): string[] {
  const written: string[] = [];
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const name = entry.name === "_gitignore" ? ".gitignore" : entry.name;
    const src = path.join(from, entry.name);
    const dest = path.join(to, name);
    if (entry.isDirectory()) {
      written.push(...copyTemplate(src, dest, vars));
    } else {
      const content = fs.readFileSync(src, "utf8").replace(/\{\{(\w+)\}\}/g, (m, key: string) => vars[key] ?? m);
      fs.writeFileSync(dest, content);
      written.push(dest);
    }
  }
  return written;
}

export function createCommand(name: string, options: { template?: string }): void {
  banner("create");
  const target = path.resolve(name);
  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
    fail(`The folder ${pc.bold(name)} already exists and is not empty.`);
    return;
  }
  const template = path.join(templatesDir(), options.template ?? "default");
  if (!fs.existsSync(template)) {
    fail(`The template "${options.template}" does not exist.`);
    return;
  }

  const pkgName = path.basename(target).toLowerCase().replace(/[^a-z0-9-_.]/g, "-");
  const files = copyTemplate(template, target, { name: pkgName });
  const rel = (p: string) => path.relative(target, p).replace(/\\/g, "/");

  console.log(`  ${pc.green("✓")} Project created in ${pc.bold(path.relative(process.cwd(), target) || ".")}\n`);
  const tree = files.map(rel).filter((f) => f.startsWith("src/")).sort();
  for (const f of tree) {
    const layer = f.split("/")[1];
    const color = layer === "model" ? pc.blue : layer === "viewmodel" ? pc.magenta : layer === "view" ? pc.green : pc.dim;
    console.log(`    ${color(f)}`);
  }
  console.log(`
  Next steps:
    ${pc.cyan(`cd ${name}`)}
    ${pc.cyan("npm install")}
    ${pc.cyan("npm run dev")}

  House rules: ${pc.dim("View ──▶ ViewModel ──▶ Model")}. Break them and it will not build.
  See every rule with ${pc.cyan("npx triad explain")}.
`);
}
