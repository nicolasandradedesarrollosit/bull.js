import { parse, type TSESTree } from "@typescript-eslint/typescript-estree";
import type { Range } from "./types";

/**
 * Module facts: everything the rules need to know about a file.
 *
 * They are extracted from an ESTree AST. Project analysis parses with
 * typescript-estree and the ESLint plugin receives the same kind of AST, so
 * the rules are identical in the build, in `bull check` and in the editor.
 */
export interface ModuleFacts {
  imports: ImportFact[];
  /** The first JSX in the file, or `null` if there is none. */
  jsx: Range | null;
  hooks: NamedRef[];
  /** References to relevant browser globals (DOM, events, I/O). */
  globals: NamedRef[];
  calls: ChainRef[];
  /** Outermost `a.b.c` expressions (those that are not part of another chain). */
  members: ChainRef[];
  assignments: ChainRef[];
  news: NamedRef[];
  /** `const x = something(...)`: tells which variables come from `useViewModel` or `useBinding`. */
  declarators: Array<{ name: string; callee: string; /** First argument as a chain (`TodoListViewModel`, `vm.todos`). */ arg: string | null; range: Range }>;
  /** Function parameter names (including destructuring). */
  params: string[];
  classes: ClassFact[];
}

export interface ImportFact {
  source: string;
  /** `import type`, or every specifier is `type`. */
  typeOnly: boolean;
  /** Imported → local pairs. `default` and `*` for default and namespace imports. */
  specifiers: Array<{ imported: string; local: string; typeOnly: boolean }>;
  kind: "import" | "export" | "dynamic";
  range: Range;
}

export interface NamedRef {
  name: string;
  range: Range;
}

export interface ChainRef {
  /** Root identifier (`vm` in `vm.count.set`), `this`, or `null` when it is not simple. */
  root: string | null;
  /** Chain segments, for example `["vm", "count", "set"]`. */
  path: string[];
  range: Range;
}

export type MemberInit = "state" | "computed" | "command" | "readonly-view" | "other" | "none";

export interface MemberFact {
  name: string;
  kind: "field" | "method" | "getter" | "setter" | "constructor" | "param-property";
  access: "public" | "protected" | "private" | "#private";
  readonly: boolean;
  static: boolean;
  init: MemberInit;
  range: Range;
}

export interface ClassFact {
  name: string | null;
  superClass: string | null;
  exported: boolean;
  members: MemberFact[];
  range: Range;
}

// ─── watched globals ──────────────────────────────────────────────────────────

const DOM_GLOBALS = new Set([
  "document",
  "window",
  "navigator",
  "location",
  "history",
  "Element",
  "HTMLElement",
  "alert",
  "confirm",
  "prompt",
  "requestAnimationFrame",
  "getComputedStyle",
]);
const EVENT_GLOBAL = /^(Mouse|Keyboard|Pointer|Focus|Input|Touch|Drag|Wheel|Clipboard|Submit|Composition|UI)?Event$/;
const IO_GLOBALS = new Set([
  "fetch",
  "localStorage",
  "sessionStorage",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "indexedDB",
]);

export function isDomGlobal(name: string): boolean {
  return DOM_GLOBALS.has(name) || /^HTML[A-Za-z]*Element$/.test(name) || EVENT_GLOBAL.test(name);
}

export function isIoGlobal(name: string): boolean {
  return IO_GLOBALS.has(name);
}

/** Data or network libraries that reveal I/O. */
export const IO_PACKAGES = new Set([
  "axios",
  "ky",
  "ofetch",
  "superagent",
  "graphql-request",
  "@tanstack/react-query",
  "swr",
  "@apollo/client",
]);

// ─── parsing and traversal ────────────────────────────────────────────────────

export function parseModule(code: string, file: string): TSESTree.Program {
  return parse(code, {
    jsx: /\.[jt]sx$/.test(file),
    loc: true,
    range: true,
    comment: false,
    filePath: file,
  });
}

type AnyNode = TSESTree.Node;
const SKIP_KEYS = new Set(["parent", "loc", "range", "tokens", "comments"]);

function toRange(node: { loc: TSESTree.SourceLocation }): Range {
  return {
    start: { line: node.loc.start.line, column: node.loc.start.column + 1 },
    end: { line: node.loc.end.line, column: node.loc.end.column + 1 },
  };
}

function walk(
  node: AnyNode,
  visit: (node: AnyNode, parent: AnyNode | null, key: string | null) => void,
  parent: AnyNode | null = null,
  key: string | null = null,
): void {
  visit(node, parent, key);
  for (const childKey of Object.keys(node)) {
    if (SKIP_KEYS.has(childKey)) continue;
    const value = (node as unknown as Record<string, unknown>)[childKey];
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, visit, node, childKey);
    } else if (isNode(value)) {
      walk(value, visit, node, childKey);
    }
  }
}

function isNode(value: unknown): value is AnyNode {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

function patternNames(node: AnyNode | null | undefined, out: string[] = []): string[] {
  if (!node) return out;
  switch (node.type) {
    case "Identifier":
      out.push(node.name);
      break;
    case "ObjectPattern":
      for (const prop of node.properties) patternNames(prop.type === "RestElement" ? prop : prop.value, out);
      break;
    case "ArrayPattern":
      for (const el of node.elements) patternNames(el, out);
      break;
    case "AssignmentPattern":
      patternNames(node.left, out);
      break;
    case "RestElement":
      patternNames(node.argument, out);
      break;
    case "TSParameterProperty":
      patternNames(node.parameter, out);
      break;
  }
  return out;
}

/** The `a.b.c` chain of an expression. `root` is `null` when the chain does not start with an identifier. */
function chainOf(node: AnyNode): { root: string | null; path: string[] } {
  switch (node.type) {
    case "Identifier":
      return { root: node.name, path: [node.name] };
    case "ThisExpression":
      return { root: "this", path: ["this"] };
    case "MemberExpression": {
      const inner = chainOf(node.object);
      const prop =
        !node.computed && node.property.type === "Identifier"
          ? node.property.name
          : node.property.type === "PrivateIdentifier"
            ? `#${node.property.name}`
            : node.property.type === "Literal"
              ? String(node.property.value)
              : "[]";
      return { root: inner.root, path: [...inner.path, prop] };
    }
    case "ChainExpression":
      return chainOf(node.expression);
    case "TSNonNullExpression":
    case "TSAsExpression":
      return chainOf(node.expression);
    case "CallExpression": {
      const inner = chainOf(node.callee);
      return { root: inner.root, path: [...inner.path.slice(0, -1), `${inner.path.at(-1) ?? ""}()`] };
    }
    default:
      return { root: null, path: [] };
  }
}

function isReference(parent: AnyNode | null, key: string | null): boolean {
  if (!parent) return true;
  switch (parent.type) {
    case "MemberExpression":
      return key !== "property" || parent.computed;
    case "Property":
      return key !== "key" || parent.computed;
    case "PropertyDefinition":
    case "MethodDefinition":
    case "TSPropertySignature":
    case "TSMethodSignature":
    case "TSAbstractPropertyDefinition":
    case "TSAbstractMethodDefinition":
      return key !== "key" || parent.computed;
    case "TSQualifiedName":
      return key !== "right";
    case "ImportSpecifier":
    case "ImportDefaultSpecifier":
    case "ImportNamespaceSpecifier":
    case "ExportSpecifier":
    case "LabeledStatement":
    case "BreakStatement":
    case "ContinueStatement":
      return false;
    case "TSEnumMember":
      return key !== "id";
    default:
      return true;
  }
}

function memberInit(value: AnyNode | null): MemberInit {
  if (!value) return "none";
  if (
    value.type === "CallExpression" &&
    value.callee.type === "MemberExpression" &&
    value.callee.object.type === "ThisExpression" &&
    value.callee.property.type === "Identifier"
  ) {
    const name = value.callee.property.name;
    if (name === "state" || name === "computed" || name === "command") return name;
  }
  if (
    value.type === "MemberExpression" &&
    !value.computed &&
    value.property.type === "Identifier" &&
    value.property.name === "readonly"
  ) {
    return "readonly-view";
  }
  return "other";
}

function classFact(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression, exported: boolean): ClassFact {
  const members: MemberFact[] = [];
  for (const element of node.body.body) {
    if (element.type === "PropertyDefinition" || element.type === "MethodDefinition") {
      const key = element.key;
      const isHash = key.type === "PrivateIdentifier";
      const name =
        key.type === "Identifier" || key.type === "PrivateIdentifier"
          ? key.name
          : key.type === "Literal"
            ? String(key.value)
            : "[computed]";
      const access = isHash ? "#private" : (element.accessibility ?? "public");
      if (element.type === "PropertyDefinition") {
        members.push({
          name,
          kind: "field",
          access,
          readonly: element.readonly,
          static: element.static,
          init: memberInit(element.value),
          range: toRange(element),
        });
      } else {
        const kind =
          element.kind === "constructor"
            ? "constructor"
            : element.kind === "get"
              ? "getter"
              : element.kind === "set"
                ? "setter"
                : "method";
        members.push({ name, kind, access, readonly: false, static: element.static, init: "none", range: toRange(element) });
        if (element.kind === "constructor") {
          for (const param of element.value.params) {
            if (param.type !== "TSParameterProperty") continue;
            const [paramName] = patternNames(param.parameter);
            members.push({
              name: paramName ?? "?",
              kind: "param-property",
              access: param.accessibility ?? "public",
              readonly: param.readonly,
              static: false,
              init: "other",
              range: toRange(param),
            });
          }
        }
      }
    }
  }
  const superClass = node.superClass ? chainOf(node.superClass).path.join(".") || null : null;
  return { name: node.id?.name ?? null, superClass, exported, members, range: toRange(node.id ?? node) };
}

// ─── extraction ───────────────────────────────────────────────────────────────

export function extractFacts(program: TSESTree.Program): ModuleFacts {
  const facts: ModuleFacts = {
    imports: [],
    jsx: null,
    hooks: [],
    globals: [],
    calls: [],
    members: [],
    assignments: [],
    news: [],
    declarators: [],
    params: [],
    classes: [],
  };

  // First pass: names declared in the file. A global "shadowed" by a local
  // declaration does not count as browser access.
  const declared = new Set<string>();
  walk(program, (node) => {
    switch (node.type) {
      case "ImportSpecifier":
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
        declared.add(node.local.name);
        break;
      case "VariableDeclarator":
        patternNames(node.id).forEach((n) => declared.add(n));
        break;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        if (node.type === "FunctionDeclaration" && node.id) declared.add(node.id.name);
        for (const param of node.params) {
          const names = patternNames(param);
          names.forEach((n) => declared.add(n));
          facts.params.push(...names);
        }
        break;
      case "ClassDeclaration":
        if (node.id) declared.add(node.id.name);
        break;
      case "CatchClause":
        patternNames(node.param).forEach((n) => declared.add(n));
        break;
      case "TSInterfaceDeclaration":
      case "TSTypeAliasDeclaration":
      case "TSEnumDeclaration":
        declared.add(node.id.name);
        break;
    }
  });

  const seenGlobals = new Set<number>();

  walk(program, (node, parent, key) => {
    switch (node.type) {
      case "ImportDeclaration":
        facts.imports.push({
          source: node.source.value,
          typeOnly:
            node.importKind === "type" ||
            (node.specifiers.length > 0 &&
              node.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type")),
          specifiers: node.specifiers.map((s) => ({
            imported:
              s.type === "ImportDefaultSpecifier"
                ? "default"
                : s.type === "ImportNamespaceSpecifier"
                  ? "*"
                  : s.imported.type === "Identifier"
                    ? s.imported.name
                    : String(s.imported.value),
            local: s.local.name,
            typeOnly: node.importKind === "type" || (s.type === "ImportSpecifier" && s.importKind === "type"),
          })),
          kind: "import",
          range: toRange(node),
        });
        break;
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration":
        if (node.source) {
          facts.imports.push({
            source: node.source.value,
            typeOnly: node.exportKind === "type",
            specifiers: [],
            kind: "export",
            range: toRange(node),
          });
        }
        if (node.type === "ExportNamedDeclaration" && node.declaration?.type === "ClassDeclaration") {
          facts.classes.push(classFact(node.declaration, true));
        }
        break;
      case "ExportDefaultDeclaration":
        if (node.declaration.type === "ClassDeclaration" || node.declaration.type === "ClassExpression") {
          facts.classes.push(classFact(node.declaration, true));
        }
        break;
      case "ClassDeclaration":
        if (parent?.type !== "ExportNamedDeclaration" && parent?.type !== "ExportDefaultDeclaration") {
          facts.classes.push(classFact(node, false));
        }
        break;
      case "ImportExpression":
        if (node.source.type === "Literal" && typeof node.source.value === "string") {
          facts.imports.push({
            source: node.source.value,
            typeOnly: false,
            specifiers: [],
            kind: "dynamic",
            range: toRange(node),
          });
        }
        break;
      case "JSXElement":
      case "JSXFragment":
        if (!facts.jsx) facts.jsx = toRange(node);
        break;
      case "CallExpression": {
        const chain = chainOf(node.callee);
        facts.calls.push({ ...chain, range: toRange(node) });
        const last = chain.path.at(-1);
        if (last && /^use[A-Z0-9]/.test(last) && (chain.path.length === 1 || chain.root === "React")) {
          facts.hooks.push({ name: last, range: toRange(node) });
        }
        break;
      }
      case "NewExpression":
        if (node.callee.type === "Identifier") facts.news.push({ name: node.callee.name, range: toRange(node) });
        break;
      case "AssignmentExpression":
      case "UpdateExpression": {
        const target = node.type === "AssignmentExpression" ? node.left : node.argument;
        if (target.type === "MemberExpression") facts.assignments.push({ ...chainOf(target), range: toRange(node) });
        break;
      }
      case "MemberExpression":
        if (!(parent?.type === "MemberExpression" && key === "object")) {
          facts.members.push({ ...chainOf(node), range: toRange(node) });
        }
        break;
      case "VariableDeclarator":
        if (node.id.type === "Identifier" && node.init?.type === "CallExpression") {
          const callee = chainOf(node.init.callee).path.join(".");
          const first = node.init.arguments[0];
          const arg = first && first.type !== "SpreadElement" ? chainOf(first).path.join(".") || null : null;
          if (callee) facts.declarators.push({ name: node.id.name, callee, arg, range: toRange(node) });
        }
        break;
      case "Identifier":
        if (
          (isDomGlobal(node.name) || isIoGlobal(node.name)) &&
          !declared.has(node.name) &&
          isReference(parent, key) &&
          !seenGlobals.has(node.range[0])
        ) {
          seenGlobals.add(node.range[0]);
          facts.globals.push({ name: node.name, range: toRange(node) });
        }
        break;
    }
  });

  return facts;
}
