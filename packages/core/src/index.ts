export { analyzeProject, ProjectAnalyzer, type AnalysisResult } from "./analyze";
export {
  defineConfig,
  resolveConfig,
  type ResolvedConfig,
  type TriadArchitectureConfig,
} from "./config";
export { extractFacts, parseModule, type ModuleFacts } from "./facts";
export { classifyFile, resolveImport, LAYERS, LAYER_LABEL, NAMING } from "./layers";
export { normalizePath } from "./paths";
export { runFileRules, FORBIDDEN_VIEW_HOOKS } from "./rules/file-rules";
export { RULES, RULE_LIST, ruleBySlug, type RuleMeta, type RuleCategory } from "./rules/meta";
export type { ProjectFile } from "./rules/project-rules";
export { buildFrame, type FrameLine } from "./format/frame";
export {
  formatDiagnostic,
  formatExplain,
  formatReport,
  formatRuleList,
  formatSummary,
  ruleToMarkdown,
  type PrettyOptions,
} from "./format/pretty";
export {
  serializeDiagnostic,
  serializeResult,
  type SerializedDiagnostic,
  type SerializedResult,
} from "./format/serialize";
export type { Diagnostic, FileKind, Layer, Position, Range, RuleCode, Severity } from "./types";
