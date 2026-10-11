import type { RuleCode, Severity } from "../types";

export type RuleCategory = "structure" | "dependencies" | "view" | "viewmodel" | "model" | "config";

export interface RuleMeta {
  code: RuleCode;
  /** Short kebab-case name (also the ESLint rule name). */
  slug: string;
  /** Heading shown at the top of the error. */
  title: string;
  category: RuleCategory;
  severity: Severity;
  /** Whether it can be changed or turned off from `triad.config.ts`. */
  configurable: boolean;
  /** `file` when it can be evaluated by looking at a single file (it also runs in ESLint). */
  scope: "file" | "project";
  /** One-line summary. */
  summary: string;
  /** Why this breaks MVVM. */
  why: string;
  /** Concrete steps to fix it, filled in with the data of the specific case. */
  fix: (data: Record<string, string | undefined>) => string[];
  example?: { bad: string; good: string };
}

const rule = (meta: RuleMeta) => meta;

export const RULES: Record<RuleCode, RuleMeta> = {
  // ─── Structure ──────────────────────────────────────────────────────────────
  MVVM001: rule({
    code: "MVVM001",
    slug: "required-layers",
    title: "MISSING LAYER",
    category: "structure",
    severity: "error",
    configurable: false,
    scope: "project",
    summary: "The project must have the src/model, src/viewmodel and src/view folders.",
    why:
      "Triad organizes the app in three layers with separate responsibilities: the Model (data and " +
      "business rules), the ViewModel (screen state and actions) and the View (what gets drawn). Each " +
      "layer lives in its own folder so the direction of dependencies is visible and verifiable.",
    fix: (d) => [
      `Create the \`${d.dir ?? "src/<layer>"}\` folder.`,
      "Move the files that belong to that layer into it (see `triad explain MVVM003` for naming).",
    ],
  }),
  MVVM002: rule({
    code: "MVVM002",
    slug: "file-outside-layers",
    title: "FILE OUTSIDE THE LAYERS",
    category: "structure",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "All code in src/ must belong to a layer (or be the composition root).",
    why:
      "A loose `utils/`, `hooks/` or `services/` folder is a back door: any layer can import it and " +
      "skip the View → ViewModel → Model direction. In Triad every piece of code has an owner: domain " +
      "logic goes to the Model, presentation logic to the ViewModel and components to the View.",
    fix: (d) => [
      `Decide which layer \`${d.file ?? "the file"}\` belongs to:`,
      "  · data, business rules or API access    →  src/model/",
      "  · state or actions of a screen          →  src/viewmodel/",
      "  · components that render                →  src/view/",
      "If they are static resources (images, styles), add their folder to `allowDirs` in triad.config.ts.",
    ],
  }),
  MVVM003: rule({
    code: "MVVM003",
    slug: "file-naming",
    title: "WRONG FILE NAME",
    category: "structure",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "Each layer has its convention: *.model.ts, *.viewmodel.ts, *.view.tsx.",
    why:
      "The file name says what role it plays, and Triad uses it to verify the architecture. The Model " +
      "and the ViewModel are plain TypeScript (.ts): if a file needs .tsx it is because it has JSX, and " +
      "JSX can only live in the View.",
    fix: (d) => [
      `Rename the file to \`${d.suggested ?? "<name>" + (d.expected ?? "")}\`.`,
      `Valid suffixes in this layer: ${d.expected ?? "see the table below"}.`,
    ],
    example: {
      bad: "src/viewmodel/TodoList.tsx\nsrc/model/api.ts\nsrc/view/Header.tsx",
      good: "src/viewmodel/todo-list.viewmodel.ts\nsrc/model/todo.repository.ts\nsrc/view/header.view.tsx",
    },
  }),
  MVVM004: rule({
    code: "MVVM004",
    slug: "empty-layer",
    title: "EMPTY LAYER",
    category: "structure",
    severity: "warning",
    configurable: true,
    scope: "project",
    summary: "One of the layers has no files.",
    why:
      "An empty layer usually means its responsibility is living somewhere else. For example, an empty " +
      "viewmodel/ almost always means the View is managing state by itself.",
    fix: (d) => [`Add at least one file to \`${d.dir ?? "the layer"}\`, or review where that responsibility ended up.`],
  }),
  MVVM005: rule({
    code: "MVVM005",
    slug: "composition-root",
    title: "MISSING COMPOSITION ROOT",
    category: "structure",
    severity: "error",
    configurable: false,
    scope: "project",
    summary: "The composition root must exist (src/main.tsx by default).",
    why:
      "The composition root is the only place that knows all three layers: it creates the Models, tells " +
      "the container how to build each ViewModel and mounts the root View. Keeping it in one place is " +
      "what lets the rest of the code depend only on the layer below.",
    fix: (d) => [
      `Create \`${d.file ?? "src/main.tsx"}\` with createTriadApp():`,
      "  createTriadApp({ root: AppView, register: (c) => { c.model(...); c.viewModel(...); } });",
    ],
  }),

  // ─── Dependencies ───────────────────────────────────────────────────────────
  MVVM100: rule({
    code: "MVVM100",
    slug: "view-imports-model",
    title: "VIEW IMPORTS MODEL",
    category: "dependencies",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The View can only depend on the ViewModel, never on the Model.",
    why:
      "The View only knows its ViewModel. If it talks to the Model directly, presentation logic gets " +
      "tied to the UI: it can no longer be tested without React, and changing where the data comes " +
      "from means touching components. The ViewModel exists precisely to translate between both layers.",
    fix: (d) =>
      d.typeOnly === "true"
        ? [
            `Re-export the type from the ViewModel: \`export type { ${d.imported ?? "Type"} } from "${d.modelPath ?? "../model/..."}";\``,
            `Import it in the View from the ViewModel (\`${d.viewModel ?? "XViewModel"}\`).`,
          ]
        : [
            `Move the use of \`${d.imported ?? "the import"}\` to ${d.viewModel ?? "this View's ViewModel"} (inject it through the constructor).`,
            "Expose the data as `state`/`computed` and the actions as `command`.",
            "In the View, use `useViewModel(...)` and `useBinding(...)`.",
          ],
    example: {
      bad:
        'import { TodoRepository } from "../model/todo.repository";\n\n' +
        "export function TodoListView() {\n  const todos = new TodoRepository().list();\n  …\n}",
      good:
        'import { TodoListViewModel } from "../viewmodel/todo-list.viewmodel";\n\n' +
        "export function TodoListView() {\n  const vm = useViewModel(TodoListViewModel);\n  const todos = useBinding(vm.todos);\n  …\n}",
    },
  }),
  MVVM101: rule({
    code: "MVVM101",
    slug: "viewmodel-imports-view",
    title: "VIEWMODEL IMPORTS VIEW",
    category: "dependencies",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The ViewModel cannot know about the View.",
    why:
      "The ViewModel does not know how it is drawn: the View observes it, not the other way around. If " +
      "the ViewModel imports components it can no longer be reused with another View or tested without " +
      "rendering.",
    fix: (d) => [
      `Remove the import of \`${d.source ?? "the View"}\`.`,
      "If the ViewModel needs the View to do something (navigate, open a modal), expose a `state` the View observes.",
    ],
  }),
  MVVM102: rule({
    code: "MVVM102",
    slug: "model-imports-upper-layer",
    title: "MODEL IMPORTS AN UPPER LAYER",
    category: "dependencies",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The Model is the foundation: it cannot import ViewModels or Views.",
    why:
      "The Model is the core of the app: entities, business rules and data access. It must be usable " +
      "from any screen, or even without screens (in a test or a script). If it knows about upper layers, " +
      "responsibilities become circularly coupled.",
    fix: (d) => [
      `Remove the import of \`${d.source ?? "the upper layer"}\`.`,
      "If the Model needs to notify changes, return the data or expose a callback/event the ViewModel listens to.",
    ],
  }),
  MVVM103: rule({
    code: "MVVM103",
    slug: "viewmodel-uses-react",
    title: "VIEWMODEL USES REACT",
    category: "dependencies",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The ViewModel is plain TypeScript: no React, JSX or hooks.",
    why:
      "The ViewModel models the screen without knowing what draws it. If it uses React (hooks, JSX, " +
      "React event types) it gets tied to the framework and can no longer be tested as a regular class.",
    fix: (d) => [
      d.what === "jsx"
        ? "Move the JSX to the View. The ViewModel exposes data and the View decides how to show it."
        : `Remove the import of \`${d.source ?? "react"}\`.`,
      "Use `this.state()`, `this.computed()` and `this.command()` instead of hooks.",
      "If you were receiving React events, have the View pass only the value to the command (`e.target.value`).",
    ],
  }),
  MVVM104: rule({
    code: "MVVM104",
    slug: "model-uses-react",
    title: "MODEL USES REACT",
    category: "dependencies",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The Model cannot depend on React.",
    why: "The Model does not know there is a user interface. Depending on React ties it to a UI technology.",
    fix: (d) => [`Remove the import of \`${d.source ?? "react"}\`. If you need observable state, it belongs in the ViewModel.`],
  }),
  MVVM105: rule({
    code: "MVVM105",
    slug: "import-cycle",
    title: "IMPORT CYCLE",
    category: "dependencies",
    severity: "error",
    configurable: false,
    scope: "project",
    summary: "Some modules import each other in a circle.",
    why:
      "Dependencies in MVVM form a straight line, from View to ViewModel and from ViewModel to Model. A " +
      "cycle means two pieces cannot be understood, tested or replaced independently.",
    fix: (d) => [
      `Cycle: ${d.cycle ?? "(see above)"}`,
      "Extract what they share into a new module both depend on, or invert the dependency with a constructor parameter.",
    ],
  }),
  MVVM106: rule({
    code: "MVVM106",
    slug: "imports-composition-root",
    title: "COMPOSITION ROOT IMPORTED",
    category: "dependencies",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "Nothing can import the composition root.",
    why:
      "The composition root sits on top of everything: it knows all layers in order to wire them. If a " +
      "layer imports it, that layer indirectly knows about all the others.",
    fix: () => ["Remove the import. If you needed an instance, take it through the constructor and register it in the composition root."],
  }),

  // ─── View ───────────────────────────────────────────────────────────────────
  MVVM200: rule({
    code: "MVVM200",
    slug: "view-does-io",
    title: "VIEW DOES I/O",
    category: "view",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The View does not access the network or storage.",
    why:
      "Fetching or saving data is the Model's job. When the View does I/O it mixes how the screen looks " +
      "with where the data comes from, and every API change forces you to touch components.",
    fix: (d) => [
      `Move the use of \`${d.api ?? "the API"}\` to a repository in src/model/ (for example \`*.repository.ts\`).`,
      "Inject the repository into the ViewModel and expose a `command` that uses it.",
      "The View only calls `vm.load.execute()` and shows `vm.load.isRunning`.",
    ],
    example: {
      bad: 'useEffect(() => {\n  fetch("/api/todos").then((r) => r.json()).then(setTodos);\n}, []);',
      good:
        '// model/todo.repository.ts\nasync list() { return (await fetch("/api/todos")).json(); }\n\n' +
        "// viewmodel/todo-list.viewmodel.ts\nprotected override onActivate() { this.load.execute(); }",
    },
  }),
  MVVM201: rule({
    code: "MVVM201",
    slug: "view-owns-state",
    title: "VIEW OWNS STATE",
    category: "view",
    severity: "error",
    configurable: true,
    scope: "file",
    summary: "State and effects live in the ViewModel, not in View hooks.",
    why:
      "In MVVM the View has no state: it only reflects the ViewModel's and delegates actions to it. " +
      "With `useState`/`useEffect` in the View, logic gets scattered across components and can no " +
      "longer be tested without rendering.",
    fix: (d) => [
      d.hook === "useEffect" || d.hook === "useLayoutEffect"
        ? `Replace \`${d.hook}\` with \`this.effect(...)\` or \`onActivate()\` in ${d.viewModel ?? "the ViewModel"}.`
        : d.hook === "useMemo"
          ? `Replace \`useMemo\` with \`this.computed(...)\` in ${d.viewModel ?? "the ViewModel"}.`
          : `Move that state to ${d.viewModel ?? "the ViewModel"} with \`this.state(...)\` and expose it with \`.readonly\`.`,
      "Read it in the View with `useBinding(vm.x)` and change it with a `command`.",
      "If it is purely visual state (an open dropdown), you can allow it with `view.allowHooks` in triad.config.ts.",
    ],
    example: {
      bad: "const [count, setCount] = useState(0);\n<button onClick={() => setCount(count + 1)}>",
      good:
        "// viewmodel\nreadonly #count = this.state(0);\nreadonly count = this.#count.readonly;\n" +
        "readonly increment = this.command(() => this.#count.update((n) => n + 1));\n\n" +
        "// view\nconst count = useBinding(vm.count);\n<button onClick={vm.increment.execute}>",
    },
  }),
  MVVM202: rule({
    code: "MVVM202",
    slug: "view-mutates-viewmodel",
    title: "VIEW MUTATES VIEWMODEL",
    category: "view",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The View never writes state: it asks the ViewModel to do it through commands.",
    why:
      "Communication from the View to the ViewModel only happens through commands. That way every state " +
      "change has a single place where it happens, with its validation, loading state and errors.",
    fix: (d) => [
      `Instead of \`${d.target ?? "changing the state"}\`, add a command to the ViewModel.`,
      "  readonly rename = this.command((name: string) => this.#name.set(name));",
      "From the View: `vm.rename.execute(e.target.value)`.",
    ],
  }),
  MVVM203: rule({
    code: "MVVM203",
    slug: "view-business-logic",
    title: "BUSINESS LOGIC IN THE VIEW",
    category: "view",
    severity: "warning",
    configurable: true,
    scope: "file",
    summary: "Filtering, sorting or aggregating data is the job of a ViewModel computed.",
    why:
      "Deciding which data is shown (filtering, sorting, counting) is presentation logic and belongs in " +
      "the ViewModel, where it can be tested and is only recomputed when its dependencies change. The " +
      "View should only iterate (`.map`) over what it receives ready to show.",
    fix: (d) => [
      `Create a computed in the ViewModel: \`readonly visible = this.computed(() => this.#${d.binding ?? "items"}.value.${d.method ?? "filter"}(...))\`.`,
      "Bind it in the View with `useBinding(vm.visible)`.",
    ],
  }),
  MVVM204: rule({
    code: "MVVM204",
    slug: "view-instantiates-viewmodel",
    title: "VIEW CREATES ITS VIEWMODEL WITH NEW",
    category: "view",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "ViewModels are obtained with useViewModel(), not with new.",
    why:
      "`useViewModel` creates the ViewModel once per component, injects its dependencies from the " +
      "composition root and activates/deactivates it with the View's lifecycle. With `new` a new one is " +
      "created on every render and injection is lost.",
    fix: (d) => [`Use \`const vm = useViewModel(${d.name ?? "XViewModel"});\`.`],
  }),
  MVVM205: rule({
    code: "MVVM205",
    slug: "view-creates-reactive-state",
    title: "VIEW CREATES REACTIVE STATE",
    category: "view",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The View can only import @triad/runtime/react, not the reactive primitives.",
    why:
      "`state`, `computed` and `effect` are ViewModel tools. If the View uses them, it owns state " +
      "again, just through a different API.",
    fix: (d) => [
      `Remove \`${d.imported ?? "the import"}\` from the View and declare it in the ViewModel.`,
      'In the View, only import from "@triad/runtime/react" (useViewModel, useBinding).',
    ],
  }),
  MVVM206: rule({
    code: "MVVM206",
    slug: "view-reads-value",
    title: "VIEW READS .value WITHOUT BINDING",
    category: "view",
    severity: "warning",
    configurable: true,
    scope: "file",
    summary: "Reading `vm.x.value` in the View is not reactive: use useBinding().",
    why:
      "`.value` returns the value at that moment, but the View is not notified when it changes. " +
      "`useBinding` subscribes the component and re-renders it on every change.",
    fix: (d) => [`Replace \`${d.target ?? "vm.x.value"}\` with \`useBinding(${d.binding ?? "vm.x"})\` at the top of the component.`],
  }),

  // ─── ViewModel ──────────────────────────────────────────────────────────────
  MVVM300: rule({
    code: "MVVM300",
    slug: "viewmodel-base-class",
    title: "VIEWMODEL DOES NOT EXTEND ViewModel",
    category: "viewmodel",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "Every file in viewmodel/ exports a class that extends ViewModel.",
    why:
      "The base class provides the primitives (`state`, `computed`, `command`, `effect`) and the " +
      "lifecycle `useViewModel` relies on. Without it, the View has no uniform contract to bind to.",
    fix: (d) => [
      'Import the base class: `import { ViewModel } from "@triad/runtime";`.',
      `Declare it as \`export class ${d.className ?? "XViewModel"} extends ViewModel { … }\`.`,
    ],
  }),
  MVVM301: rule({
    code: "MVVM301",
    slug: "viewmodel-touches-dom",
    title: "VIEWMODEL TOUCHES THE DOM",
    category: "viewmodel",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The ViewModel does not access document, window, elements or DOM events.",
    why:
      "The ViewModel describes the screen abstractly (what data exists and what actions are " +
      "available). The DOM is a View detail. If the ViewModel touches it, it cannot be tested outside " +
      "a browser or reused with another View.",
    fix: (d) => [
      `Remove the use of \`${d.api ?? "the DOM API"}\`.`,
      "If it receives an event, have the View pass only the value (`e.target.value`).",
      "If it needs to show something (alert, focus, scroll), expose a `state` that the View observes and acts on.",
    ],
  }),
  MVVM302: rule({
    code: "MVVM302",
    slug: "viewmodel-exposes-mutable-state",
    title: "VIEWMODEL EXPOSES MUTABLE STATE",
    category: "viewmodel",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The ViewModel's public surface is read-only: readonly state, computeds and commands.",
    why:
      "If the View can write state directly, commands lose their meaning and any component can change " +
      "the screen without going through the ViewModel's logic.",
    fix: (d) =>
      d.kind === "state"
        ? [
            `Make the state private: \`readonly #${d.member ?? "x"} = this.state(...)\`.`,
            `Expose the read-only view: \`readonly ${d.member ?? "x"} = this.#${d.member ?? "x"}.readonly;\`.`,
          ]
        : d.kind === "param"
          ? [`Mark the dependency as private: \`constructor(private readonly ${d.member ?? "repo"}: …)\`.`]
          : [`Mark \`${d.member ?? "the field"}\` as \`readonly\` or make it private (\`#${d.member ?? "x"}\`).`],
    example: {
      bad: "count = this.state(0);",
      good: "readonly #count = this.state(0);\nreadonly count = this.#count.readonly;",
    },
  }),
  MVVM303: rule({
    code: "MVVM303",
    slug: "viewmodel-per-file",
    title: "WRONG VIEWMODEL NAME",
    category: "viewmodel",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "One ViewModel per file, and the class is named after the file.",
    why:
      "Finding a View's ViewModel must be trivial: `todo-list.view.tsx` uses `TodoListViewModel`, " +
      "which lives in `todo-list.viewmodel.ts`. With several classes per file that correspondence is lost.",
    fix: (d) => [
      d.found
        ? `Rename \`${d.found}\` to \`${d.expected ?? "XViewModel"}\` or rename the file.`
        : "Split each ViewModel into its own `*.viewmodel.ts` file.",
    ],
  }),
  MVVM304: rule({
    code: "MVVM304",
    slug: "viewmodel-instantiates-dependency",
    title: "VIEWMODEL CREATES ITS DEPENDENCIES",
    category: "viewmodel",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "Repositories and services are injected through the constructor, not created with new.",
    why:
      "If the ViewModel creates its own repository, you cannot pass a fake one in a test or share the " +
      "same instance across screens. Constructor injection makes dependencies visible and lets the " +
      "composition root swap them.",
    fix: (d) => [
      `Take the dependency through the constructor: \`constructor(private readonly ${lowerFirst(d.name ?? "repo")}: ${d.name ?? "Repo"}) { super(); }\`.`,
      `Register it in the composition root: \`c.model(${d.name ?? "Repo"}, () => new ${d.name ?? "Repo"}())\`.`,
    ],
  }),
  MVVM305: rule({
    code: "MVVM305",
    slug: "viewmodel-does-io",
    title: "VIEWMODEL DOES DIRECT I/O",
    category: "viewmodel",
    severity: "error",
    configurable: true,
    scope: "file",
    summary: "Network and storage access belong in the Model.",
    why:
      "The ViewModel orchestrates, but where the data comes from is the Model's concern. That way you " +
      "can change the API, add caching or use fake data in a test without touching the screen's logic.",
    fix: (d) => [
      `Move the use of \`${d.api ?? "the API"}\` to a repository in src/model/.`,
      "Inject it into the ViewModel through the constructor.",
    ],
  }),

  // ─── Model ──────────────────────────────────────────────────────────────────
  MVVM400: rule({
    code: "MVVM400",
    slug: "model-uses-runtime",
    title: "MODEL USES THE PRESENTATION RUNTIME",
    category: "model",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The Model does not use @triad/runtime: observable state is the ViewModel's business.",
    why:
      "Reactive primitives exist so the View can observe the ViewModel. The Model is pure domain " +
      "(functions, classes and promises), so it can be used from anywhere.",
    fix: (d) => [
      `Remove the import of \`${d.imported ?? "@triad/runtime"}\`.`,
      "Return data (or promises) and let the ViewModel store it in its `state`.",
    ],
  }),
  MVVM401: rule({
    code: "MVVM401",
    slug: "model-touches-dom",
    title: "MODEL TOUCHES THE DOM",
    category: "model",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The Model does not know about the DOM.",
    why: "The Model does not know there is a screen. It may do I/O (fetch, storage), but never manipulate the UI.",
    fix: (d) => [`Remove the use of \`${d.api ?? "the DOM API"}\`. If needed, expose the data and let the View draw it.`],
  }),

  // ─── Config / analysis ──────────────────────────────────────────────────────
  MVVM900: rule({
    code: "MVVM900",
    slug: "invalid-config",
    title: "INVALID CONFIGURATION",
    category: "config",
    severity: "error",
    configurable: false,
    scope: "project",
    summary: "triad.config.ts has an invalid value.",
    why: "Triad is strict on purpose: the structure and the direction of dependencies are not optional.",
    fix: (d) => [`Check \`${d.setting ?? "the option"}\` in triad.config.ts.`],
  }),
  MVVM901: rule({
    code: "MVVM901",
    slug: "parse-error",
    title: "FILE COULD NOT BE PARSED",
    category: "config",
    severity: "error",
    configurable: false,
    scope: "file",
    summary: "The file has a syntax error.",
    why: "Triad needs to read the file to verify the architecture.",
    fix: () => ["Fix the syntax error."],
  }),
};

function lowerFirst(s: string): string {
  return s[0]!.toLowerCase() + s.slice(1);
}

export const RULE_LIST: RuleMeta[] = Object.values(RULES);

export function ruleBySlug(slug: string): RuleMeta | undefined {
  return RULE_LIST.find((r) => r.slug === slug);
}
