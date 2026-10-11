import fs from "node:fs";
import path from "node:path";
import { formatExplain, formatRuleList, RULE_LIST, ruleBySlug, RULES, ruleToMarkdown, type RuleCode } from "@bull/core";
import pc from "picocolors";
import { fail } from "./shared";

export function explainCommand(code: string | undefined, options: { all?: boolean; format?: string; out?: string }): void {
  if (options.all && options.format === "md") {
    const outDir = path.resolve(options.out ?? "docs/rules");
    fs.mkdirSync(outDir, { recursive: true });
    const index = ["# Bull architecture rules", "", "| Code | Rule | Severity | Can be disabled |", "|---|---|---|---|"];
    for (const meta of RULE_LIST) {
      fs.writeFileSync(path.join(outDir, `${meta.code}.md`), ruleToMarkdown(meta));
      index.push(
        `| [${meta.code}](./${meta.code}.md) | ${meta.summary} | ${meta.severity === "error" ? "error" : "warning"} | ${meta.configurable ? "yes" : "no"} |`,
      );
    }
    fs.writeFileSync(path.join(outDir, "README.md"), index.join("\n") + "\n");
    console.log(`  ${pc.green("✓")} ${RULE_LIST.length} rules documented in ${path.relative(process.cwd(), outDir)}/`);
    return;
  }

  if (!code || options.all) {
    process.stdout.write(formatRuleList());
    return;
  }

  const normalized = /^\d+$/.test(code) ? `MVVM${code.padStart(3, "0")}` : code.toUpperCase();
  const meta = RULES[normalized as RuleCode] ?? ruleBySlug(code);
  if (!meta) {
    fail(`There is no rule "${code}".`, "See the full list with `bull explain`.");
    return;
  }
  process.stdout.write(options.format === "md" ? ruleToMarkdown(meta) : formatExplain(meta));
}
