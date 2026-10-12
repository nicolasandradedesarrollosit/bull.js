import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll } from "vitest";

const template = fileURLToPath(new URL("../templates/default", import.meta.url));
const created: string[] = [];
afterAll(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/** A fresh copy of the `create` template in a temp folder. */
export function templateProject(overrides: Record<string, string | null> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bull-cli-"));
  created.push(root);
  fs.cpSync(template, root, { recursive: true });
  for (const [rel, content] of Object.entries(overrides)) {
    const full = path.join(root, rel);
    if (content === null) fs.rmSync(full, { force: true });
    else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
  }
  return root;
}

export function read(root: string, rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
