export { type AnalysisResult, analyzeProject, ProjectAnalyzer } from "./analyze";
export {
  type BullArchitectureConfig,
  defineConfig,
  type ResolvedConfig,
  resolveConfig,
} from "./config";
export { type ClassFact, extractFacts, type ImportFact, type MemberFact, type ModuleFacts, parseModule } from "./facts";
export { buildFrame, type FrameLine } from "./format/frame";
export {
  formatDiagnostic,
  formatExplain,
  formatReport,
  formatRuleList,
  formatSummary,
  type PrettyOptions,
  ruleToMarkdown,
} from "./format/pretty";
export {
  type SerializedDiagnostic,
  type SerializedResult,
  serializeDiagnostic,
  serializeResult,
} from "./format/serialize";
export type { ProjectFile } from "./graph";
export {
  buildImportGraph,
  edgeViolation,
  type FileEdge,
  fileEdges,
  findCycles,
  type GraphEdge,
  type GraphNode,
  type ImportGraph,
} from "./graph";
export { classifyFile, type ImportTarget, LAYER_LABEL, LAYERS, NAMING, resolveImport } from "./layers";
export { isCodeFile, normalizePath, stripExtension, toPascalCase } from "./paths";
export { expectedViewModelName, FORBIDDEN_VIEW_HOOKS, runFileRules, toKebab } from "./rules/file-rules";
export { isAutoFixable, RULE_LIST, RULES, type RuleCategory, type RuleMeta, ruleBySlug } from "./rules/meta";
export type { Diagnostic, FileKind, Layer, Position, Range, RuleCode, Severity } from "./types";
