/** The three MVVM layers. */
export type Layer = "model" | "viewmodel" | "view";

/**
 * What a file is from the architecture's point of view.
 * - `root`: the composition root (`src/main.tsx`), the only one that sees all three layers.
 * - `allowed`: a file inside a directory allowed by config (assets, styles).
 * - `outside`: a code file in `src/` that does not belong to any layer.
 * - `ignored`: tests and `.d.ts` files, which are not analyzed.
 */
export type FileKind = Layer | "root" | "allowed" | "outside" | "ignored";

export type Severity = "error" | "warning";
export type SeveritySetting = Severity | "off" | "warn";

/** 1-based position (line and column). */
export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export type RuleCode =
  | "MVVM001"
  | "MVVM002"
  | "MVVM003"
  | "MVVM004"
  | "MVVM005"
  | "MVVM100"
  | "MVVM101"
  | "MVVM102"
  | "MVVM103"
  | "MVVM104"
  | "MVVM105"
  | "MVVM106"
  | "MVVM200"
  | "MVVM201"
  | "MVVM202"
  | "MVVM203"
  | "MVVM204"
  | "MVVM205"
  | "MVVM206"
  | "MVVM300"
  | "MVVM301"
  | "MVVM302"
  | "MVVM303"
  | "MVVM304"
  | "MVVM305"
  | "MVVM400"
  | "MVVM401"
  | "MVVM900"
  | "MVVM901";

export interface Diagnostic {
  code: RuleCode;
  severity: Severity;
  /** What happened in this specific case (one line). */
  message: string;
  /** Absolute (posix) path. When missing, the diagnostic applies to the whole project. */
  file?: string;
  range?: Range;
  /** Case data used by the "how to fix" steps. */
  data: Record<string, string>;
  /** Extra pre-formatted lines (for example, the expected folder tree). */
  notes?: string[];
}
