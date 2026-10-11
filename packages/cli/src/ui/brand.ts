import pc from "picocolors";

export const VERSION = "0.1.0";
export const TAGLINE = "Stubborn about architecture.";

/** Taurus sign with the text variation selector, so terminals draw it single-width. */
export const BULL = "♉︎";

const ART = [
  "▄▄             ▄▄",
  " ▀█▄▄       ▄▄█▀",
  "    ▀█▄▄▄▄▄▄▄█▀",
  "     █ o   o █",
  "      █  ▄  █",
  "       ▀▄▄▄▀",
];

/** The bull in ASCII art, with the name and tagline on its right. */
export function bullArt(subtitle?: string): string {
  const side = [
    "",
    "",
    `${pc.bold("triad")} ${pc.dim(`v${VERSION}`)}`,
    pc.dim(TAGLINE),
    subtitle ? pc.cyan(subtitle) : "",
    "",
  ];
  return ART.map((line, i) => {
    const text = side[i] ? `${" ".repeat(21 - line.length)}${side[i]}` : "";
    return `  ${pc.magenta(line)}${text}`;
  }).join("\n");
}

export function banner(command: string): void {
  console.log(`\n  ${pc.bold(pc.magenta(`${BULL} triad`))} ${pc.dim(`v${VERSION}`)}  ${pc.dim("·")} ${command}\n`);
}
