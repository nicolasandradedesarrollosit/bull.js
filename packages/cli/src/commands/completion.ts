import { fail } from "./shared";

export const SHELLS = ["bash", "zsh", "fish", "powershell"] as const;
export type Shell = (typeof SHELLS)[number];

export interface CompletionCommand {
  name: string;
  aliases: string[];
  description: string;
  /** Long flags, such as `--format`. */
  flags: string[];
}

const GLOBAL_FLAGS = ["--help", "--version"];

function bash(commands: CompletionCommand[], zsh: boolean): string {
  const names = commands.flatMap((c) => [c.name, ...c.aliases]).join(" ");
  const cases = commands
    .map((c) => `    ${[c.name, ...c.aliases].join("|")}) flags="${[...c.flags, "--help"].join(" ")}" ;;`)
    .join("\n");
  return `# bull completions for ${zsh ? "zsh" : "bash"}. Add this line to your ~/.${zsh ? "zshrc" : "bashrc"}:
#   eval "$(bull completion ${zsh ? "zsh" : "bash"})"
${zsh ? "autoload -U +X bashcompinit && bashcompinit\n" : ""}_bull_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${names} ${GLOBAL_FLAGS.join(" ")}" -- "$cur") )
    return
  fi
  local flags=""
  case "\${COMP_WORDS[1]}" in
${cases}
  esac
  if [[ "$cur" == -* ]]; then
    COMPREPLY=( $(compgen -W "$flags" -- "$cur") )
  fi
}
complete -o default -F _bull_completions bull
`;
}

function fish(commands: CompletionCommand[]): string {
  const quote = (text: string) => text.replace(/'/g, "\\'");
  const lines = commands.flatMap((c) => {
    const names = [c.name, ...c.aliases];
    return [
      ...names.map((n) => `complete -c bull -n __fish_use_subcommand -f -a ${n} -d '${quote(c.description)}'`),
      ...c.flags.map(
        (f) => `complete -c bull -n '__fish_seen_subcommand_from ${names.join(" ")}' -l ${f.replace(/^--/, "")}`,
      ),
    ];
  });
  return `# bull completions for fish. Save them with:
#   bull completion fish > ~/.config/fish/completions/bull.fish
complete -c bull -l help -d 'Show help'
complete -c bull -l version -d 'Show the version'
${lines.join("\n")}
`;
}

function powershell(commands: CompletionCommand[]): string {
  const table = commands
    .map((c) => {
      const flags = [...c.flags, "--help"].map((f) => `'${f}'`).join(", ");
      return [c.name, ...c.aliases].map((n) => `  '${n}' = @(${flags})`).join("\n");
    })
    .join("\n");
  return `# bull completions for PowerShell. Add this line to your $PROFILE:
#   bull completion powershell | Out-String | Invoke-Expression
$bullFlags = @{
${table}
}
Register-ArgumentCompleter -Native -CommandName bull -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $words = @($commandAst.CommandElements | Select-Object -Skip 1 | ForEach-Object { $_.ToString() })
  if ($words.Count -eq 0 -or ($words.Count -eq 1 -and $wordToComplete)) {
    $candidates = @($bullFlags.Keys) + @(${GLOBAL_FLAGS.map((f) => `'${f}'`).join(", ")})
  } else {
    $candidates = $bullFlags[$words[0]]
  }
  $candidates | Where-Object { $_ -like "$wordToComplete*" } | Sort-Object | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;
}

export function completionScript(shell: Shell, commands: CompletionCommand[]): string {
  switch (shell) {
    case "bash":
      return bash(commands, false);
    case "zsh":
      return bash(commands, true);
    case "fish":
      return fish(commands);
    case "powershell":
      return powershell(commands);
  }
}

export function completionCommand(shellArg: string | undefined, commands: CompletionCommand[]): void {
  const shell = shellArg?.toLowerCase() === "pwsh" ? "powershell" : shellArg?.toLowerCase();
  if (!SHELLS.includes(shell as Shell)) {
    fail(
      `Usage: bull completion <${SHELLS.join("|")}>`,
      'Example: eval "$(bull completion bash)" in ~/.bashrc, or `bull completion powershell | Out-String | Invoke-Expression` in $PROFILE.',
    );
    return;
  }
  process.stdout.write(completionScript(shell as Shell, commands));
}
