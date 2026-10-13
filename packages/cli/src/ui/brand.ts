import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";

/** Reads the version from the CLI's own package.json, from `dist/` (published) or `src/ui/` (development). */
function readVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    const file = path.join(dir, "package.json");
    if (fs.existsSync(file)) {
      const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "@bull-js/cli" && pkg.version) return pkg.version;
    }
    dir = path.dirname(dir);
  }
  return "0.0.0";
}

export const VERSION = readVersion();
export const TAGLINE = "Stubborn about architecture.";

/** Taurus sign with the text variation selector, so terminals draw it single-width. */
export const BULL = "♉︎";

/** A bull's head, front on: horns curving up, a frown, the muzzle with its nostrils and the ring. */
const ART = [
  "▄                      ▄",
  "█▙▖                  ▗▟█",
  "▝▜█▙▄▖            ▗▄▟█▛▘",
  "  ▝▀▜█▄▄▄▄▄▄▄▄▄▄▄▄█▛▀▘",
  "▗▄▄▄▟██████████████▙▄▄▄▖",
  " ▀▀▀▜█▛ ●▜████▛● ▜█▛▀▀▀",
  "     ▜████████████▛",
  "      ▐█▀▀▀▀▀▀▀▀█▌",
  "      ▐▌ ▀▄  ▄▀ ▐▌",
  "       ▀▙▄▄▄▄▄▄▟▀",
  "           ◖◗",
];
const ART_WIDTH = Math.max(...ART.map((line) => line.length));
/** The first rows are only horns: drawn in the horn color, the rest of the head in the bull's. */
const HORN_ROWS = 3;

/** The bull in ASCII art, with the name and tagline on its right. */
export function bullArt(subtitle?: string): string {
  const side: Record<number, string> = {
    4: `${pc.bold("bull")} ${pc.dim(`v${VERSION}`)}`,
    5: pc.dim(TAGLINE),
    6: subtitle ? pc.cyan(subtitle) : "",
  };
  return ART.map((line, i) => {
    const art = i < HORN_ROWS ? pc.yellow(line) : pc.magenta(line);
    const text = side[i] ? `${" ".repeat(ART_WIDTH - line.length + 4)}${side[i]}` : "";
    return `  ${art}${text}`;
  }).join("\n");
}

export function banner(command: string): void {
  console.log(`\n  ${pc.bold(pc.magenta(`${BULL} bull`))} ${pc.dim(`v${VERSION}`)}  ${pc.dim("·")} ${command}\n`);
}
