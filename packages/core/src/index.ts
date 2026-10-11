export { analyzeProject, ProjectAnalyzer, type AnalysisResult } from "./analyze";
export {
  defineConfig,
  resolveConfig,
  type ResolvedConfig,
  type TriadArchitectureConfig,
} from "./config";
export { extractFacts, parseModule, type ClassFact, type ImportFact, type MemberFact, type ModuleFacts } from "./facts";
export {
  buildImportGraph,
  edgeViolation,
  fileEdges,
  findCycles,
  type FileEdge,
  type GraphEdge,
  type GraphNode,
  type ImportGraph,
} from "./graph";
export { classifyFile, resolveImport, LAYERS, LAYER_LABEL, NAMING, type ImportTarget } from "./layers";
export { normalizePath, toPascalCase, stripExtension, isCodeFile } from "./paths";
export { runFileRules, FORBIDDEN_VIEW_HOOKS, expectedViewModelName, toKebab } from "./rules/file-rules";
export { RULES, RULE_LIST, ruleBySlug, isAutoFixable, type RuleMeta, type RuleCategory } from "./rules/meta";
export type { ProjectFile } from "./graph";
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
