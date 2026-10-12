import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildImportGraph, type FileKind, type ImportGraph, LAYER_LABEL, ProjectAnalyzer } from "@bull/core";
import pc from "picocolors";
import { banner, fail } from "../commands/shared";
import { loadBullConfig } from "../config";

/** Column order: the composition root on the left, the Model on the right. */
const COLUMNS: FileKind[] = ["root", "view", "viewmodel", "model", "allowed", "outside"];
const COLUMN_LABEL: Partial<Record<FileKind, string>> = {
  root: "Composition root",
  view: "View",
  viewmodel: "ViewModel",
  model: "Model",
  allowed: "Resources",
  outside: "Outside the layers",
};

function sortedNodes(graph: ImportGraph) {
  return [...graph.nodes].sort(
    (a, b) => COLUMNS.indexOf(a.kind) - COLUMNS.indexOf(b.kind) || a.rel.localeCompare(b.rel),
  );
}

function layerEdgeCounts(graph: ImportGraph) {
  const kindOf = new Map(graph.nodes.map((n) => [n.file, n.kind]));
  const counts = new Map<string, { from: FileKind; to: FileKind; count: number; violation?: string }>();
  for (const e of graph.edges) {
    const from = kindOf.get(e.from)!;
    const to = kindOf.get(e.to)!;
    const key = `${from}→${to}`;
    const entry = counts.get(key) ?? { from, to, count: 0, violation: e.violation };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort(
    (a, b) => COLUMNS.indexOf(a.from) - COLUMNS.indexOf(b.from) || COLUMNS.indexOf(a.to) - COLUMNS.indexOf(b.to),
  );
}

// ─── tree (terminal) ──────────────────────────────────────────────────────────

export function renderTree(graph: ImportGraph, colors = pc.isColorSupported): string {
  const c = pc.createColors(colors);
  const relOf = new Map(graph.nodes.map((n) => [n.file, n.rel]));
  const out: string[] = [];
  let column: FileKind | undefined;
  for (const node of sortedNodes(graph)) {
    if (node.kind !== column) {
      column = node.kind;
      out.push(`  ${c.bold(COLUMN_LABEL[column] ?? column)}`);
    }
    out.push(`    ${node.rel}`);
    for (const e of graph.edges.filter((edge) => edge.from === node.file)) {
      const target = relOf.get(e.to) ?? e.to;
      const type = e.typeOnly ? c.dim(" (type)") : "";
      if (e.violation) out.push(`      ${c.red(`✗ → ${target}`)}${type}  ${c.red(e.violation)}`);
      else if (e.inCycle) out.push(`      ${c.yellow(`↻ → ${target}`)}${type}  ${c.yellow("MVVM105")}`);
      else out.push(`      ${c.dim("→")} ${target}${type}`);
    }
  }
  out.push("");
  out.push(`  ${c.bold("Layer edges")}`);
  for (const e of layerEdgeCounts(graph)) {
    const label = `${LAYER_LABEL[e.from]} → ${LAYER_LABEL[e.to]}`.padEnd(36);
    const line = `    ${label} ${String(e.count).padStart(3)}`;
    out.push(e.violation ? c.red(`${line}  ✗ ${e.violation}`) : line);
  }
  const violations = graph.edges.filter((e) => e.violation).length;
  out.push("");
  out.push(
    violations || graph.cycles.length
      ? `  ${c.red("✗")} ${violations} edge(s) break the dependency direction, ${graph.cycles.length} cycle(s)`
      : `  ${c.green("✓")} Every edge follows View ──▶ ViewModel ──▶ Model`,
  );
  return `${out.join("\n")}\n`;
}

// ─── mermaid ──────────────────────────────────────────────────────────────────

export function renderMermaid(graph: ImportGraph): string {
  const nodes = sortedNodes(graph);
  const id = new Map(nodes.map((n, i) => [n.file, `n${i}`]));
  const out = ["flowchart LR"];
  for (const kind of COLUMNS) {
    const members = nodes.filter((n) => n.kind === kind);
    if (!members.length) continue;
    out.push(`  subgraph layer_${kind}["${COLUMN_LABEL[kind]}"]`);
    for (const n of members) out.push(`    ${id.get(n.file)}["${path.posix.basename(n.rel)}"]`);
    out.push("  end");
  }
  const styles: string[] = [];
  graph.edges.forEach((e, i) => {
    out.push(
      `  ${id.get(e.from)} ${e.typeOnly ? "-.->" : "-->"}${e.violation ? `|${e.violation}|` : ""} ${id.get(e.to)}`,
    );
    if (e.violation) styles.push(`  linkStyle ${i} stroke:#e2456f,stroke-width:2.5px`);
    else if (e.inCycle) styles.push(`  linkStyle ${i} stroke:#f5a524,stroke-width:2px`);
  });
  return `${[...out, ...styles].join("\n")}\n`;
}

// ─── graphviz dot ─────────────────────────────────────────────────────────────

const FILL: Partial<Record<FileKind, string>> = {
  root: "#f1edff",
  view: "#e8f7ee",
  viewmodel: "#efe9ff",
  model: "#e7f0ff",
  allowed: "#f4f4f5",
  outside: "#fde8ec",
};

export function renderDot(graph: ImportGraph): string {
  const out = [
    "digraph bull {",
    "  rankdir=LR; nodesep=0.3; ranksep=1.2;",
    '  node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=11, color="#c9c4d8"];',
    '  edge [color="#8d8aa0", arrowsize=0.7];',
  ];
  for (const kind of COLUMNS) {
    const members = graph.nodes.filter((n) => n.kind === kind);
    if (!members.length) continue;
    out.push(
      `  subgraph cluster_${kind} { label="${COLUMN_LABEL[kind]}"; style=rounded; color="#d9d4e8"; fontname="Helvetica";`,
    );
    for (const n of members)
      out.push(`    "${n.rel}" [label="${path.posix.basename(n.rel)}", fillcolor="${FILL[kind]}"];`);
    out.push("  }");
  }
  const relOf = new Map(graph.nodes.map((n) => [n.file, n.rel]));
  for (const e of graph.edges) {
    const attrs: string[] = [];
    if (e.typeOnly) attrs.push("style=dashed");
    if (e.violation) attrs.push(`color="#e2456f", penwidth=2, label="${e.violation}", fontcolor="#e2456f", fontsize=9`);
    else if (e.inCycle) attrs.push('color="#f5a524", penwidth=2');
    out.push(`  "${relOf.get(e.from)}" -> "${relOf.get(e.to)}"${attrs.length ? ` [${attrs.join(", ")}]` : ""};`);
  }
  out.push("}");
  return `${out.join("\n")}\n`;
}

// ─── html (self-contained SVG) ────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderHtml(graph: ImportGraph, title: string): string {
  const NODE_W = 220;
  const NODE_H = 34;
  const GAP_Y = 12;
  const COL_W = 330;
  const TOP = 110;
  const LEFT = 40;

  const columns = COLUMNS.filter((k) => graph.nodes.some((n) => n.kind === k));
  const position = new Map<string, { x: number; y: number }>();
  let maxRows = 0;
  columns.forEach((kind, col) => {
    const members = graph.nodes.filter((n) => n.kind === kind).sort((a, b) => a.rel.localeCompare(b.rel));
    maxRows = Math.max(maxRows, members.length);
    for (const [row, n] of members.entries()) {
      position.set(n.file, { x: LEFT + col * COL_W, y: TOP + row * (NODE_H + GAP_Y) });
    }
  });
  const width = LEFT * 2 + (columns.length - 1) * COL_W + NODE_W + 60;
  const height = TOP + maxRows * (NODE_H + GAP_Y) + 40;
  const index = new Map(graph.nodes.map((n, i) => [n.file, i]));

  const edges = graph.edges
    .map((e, i) => {
      const a = position.get(e.from)!;
      const b = position.get(e.to)!;
      let d: string;
      if (Math.abs(a.x - b.x) < 1) {
        // Same column: loop out to the right.
        const x = a.x + NODE_W;
        const bulge = 36 + Math.min(80, Math.abs(a.y - b.y) / 4);
        d = `M${x},${a.y + NODE_H / 2} C${x + bulge},${a.y + NODE_H / 2} ${x + bulge},${b.y + NODE_H / 2} ${x + 4},${b.y + NODE_H / 2}`;
      } else if (b.x > a.x) {
        const sx = a.x + NODE_W;
        const tx = b.x - 4;
        const skipped = Math.round((b.x - a.x) / COL_W) - 1;
        if (skipped > 0) {
          // Skips a column (e.g. View → Model): arc above the nodes in between.
          const lift = 46 + 18 * skipped + Math.abs(a.y - b.y) / 6;
          const top = Math.min(a.y, b.y) - lift;
          d = `M${sx},${a.y + NODE_H / 2} C${sx + 70},${top} ${tx - 70},${top} ${tx},${b.y + NODE_H / 2}`;
        } else {
          const mid = (sx + tx) / 2;
          d = `M${sx},${a.y + NODE_H / 2} C${mid},${a.y + NODE_H / 2} ${mid},${b.y + NODE_H / 2} ${tx},${b.y + NODE_H / 2}`;
        }
      } else {
        // Backwards (an upper layer imported from below): leave from the left, arrive on the right.
        const sx = a.x;
        const tx = b.x + NODE_W + 4;
        d = `M${sx},${a.y + NODE_H / 2} C${sx - 90},${a.y - 30} ${tx + 90},${b.y + NODE_H + 30} ${tx},${b.y + NODE_H / 2}`;
      }
      const cls = ["edge", e.violation ? "bad" : e.inCycle ? "cycle" : "", e.typeOnly ? "type" : ""]
        .filter(Boolean)
        .join(" ");
      const label = e.violation ? `<title>${esc(e.violation)}</title>` : "";
      return `<path id="e${i}" class="${cls}" data-from="${index.get(e.from)}" data-to="${index.get(e.to)}" d="${d}" marker-end="url(#${e.violation ? "arrow-bad" : "arrow"})">${label}</path>`;
    })
    .join("\n      ");

  const headers = columns
    .map((kind, col) => `<text class="col" x="${LEFT + col * COL_W}" y="28">${esc(COLUMN_LABEL[kind] ?? kind)}</text>`)
    .join("\n      ");

  const nodes = graph.nodes
    .map((n) => {
      const p = position.get(n.file)!;
      const bad = graph.edges.some((e) => (e.from === n.file || e.to === n.file) && e.violation);
      const name = path.posix.basename(n.rel);
      return `<g class="node ${n.kind}${bad ? " has-bad" : ""}" data-id="${index.get(n.file)}" transform="translate(${p.x},${p.y})">
        <title>${esc(n.rel)}</title>
        <rect width="${NODE_W}" height="${NODE_H}" rx="9"/>
        <circle cx="16" cy="${NODE_H / 2}" r="4"/>
        <text x="28" y="${NODE_H / 2 + 4}">${esc(name.length > 27 ? `${name.slice(0, 26)}…` : name)}</text>
      </g>`;
    })
    .join("\n      ");

  const violations = graph.edges.filter((e) => e.violation).length;
  const status =
    violations || graph.cycles.length
      ? `<span class="pill bad">✗ ${violations} edge(s) break the direction · ${graph.cycles.length} cycle(s)</span>`
      : `<span class="pill ok">✓ Every edge follows View → ViewModel → Model</span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Bull graph</title>
<style>
  :root { --bg:#f7f6f3; --panel:#ffffff; --ink:#1d1b22; --muted:#77737f; --line:#e4e0ea;
    --view:#1f9d5a; --viewmodel:#6b4dff; --model:#2f6fe4; --root:#9a7b2f; --other:#9a95a8; --bad:#e2456f; --cycle:#e8930c; --edge:#b3aec2; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f0d15; --panel:#17151f; --ink:#ecebf2; --muted:#8f8b9c; --line:#2a2735;
      --view:#4ad48a; --viewmodel:#a48bff; --model:#6aa2ff; --root:#e0c06a; --other:#8a8597; --edge:#4c4858; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { display: flex; align-items: center; gap: 14px; padding: 20px 28px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  header h1 { font-size: 17px; margin: 0; }
  header p { margin: 0; color: var(--muted); font-size: 13px; }
  .spacer { flex: 1; }
  .pill { font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px; }
  .pill.ok { background: color-mix(in srgb, var(--view) 15%, transparent); color: var(--view); }
  .pill.bad { background: color-mix(in srgb, var(--bad) 15%, transparent); color: var(--bad); }
  .legend { display: flex; gap: 18px; padding: 12px 28px; color: var(--muted); font-size: 12px; flex-wrap: wrap; }
  .legend i { display: inline-block; width: 22px; height: 0; border-top: 2px solid var(--edge); vertical-align: middle; margin-right: 6px; }
  .legend .bad i { border-color: var(--bad); }
  .legend .cycle i { border-color: var(--cycle); }
  .legend .type i { border-top-style: dashed; }
  main { overflow: auto; padding: 8px 0 32px; }
  svg { display: block; margin: 0 auto; }
  .col { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; fill: var(--muted); }
  .node rect { fill: var(--panel); stroke: var(--line); stroke-width: 1.2; transition: stroke .15s; }
  .node text { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; fill: var(--ink); }
  .node circle { fill: var(--other); }
  .node.view circle { fill: var(--view); } .node.viewmodel circle { fill: var(--viewmodel); }
  .node.model circle { fill: var(--model); } .node.root circle { fill: var(--root); }
  .node.has-bad rect { stroke: var(--bad); }
  .node { cursor: default; }
  .edge { fill: none; stroke: var(--edge); stroke-width: 1.4; transition: opacity .15s, stroke-width .15s; }
  .edge.type { stroke-dasharray: 4 4; }
  .edge.cycle { stroke: var(--cycle); stroke-width: 2; }
  .edge.bad { stroke: var(--bad); stroke-width: 2.4; }
  #arrow path { fill: var(--edge); } #arrow-bad path { fill: var(--bad); }
  svg.focus .edge { opacity: .12; } svg.focus .edge.on { opacity: 1; stroke-width: 2.6; }
  svg.focus .node { opacity: .35; } svg.focus .node.on { opacity: 1; }
</style>
</head>
<body>
<header>
  ${BULL_SVG}
  <div><h1>${esc(title)}</h1><p>Import graph · ${graph.nodes.length} files · ${graph.edges.length} edges · hover a file to trace it</p></div>
  <div class="spacer"></div>
  ${status}
</header>
<div class="legend">
  <span><i></i>import</span><span class="type"><i></i>type-only import</span>
  <span class="bad"><i></i>breaks View → ViewModel → Model</span><span class="cycle"><i></i>import cycle</span>
</div>
<main>
  <svg id="graph" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Import graph">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>
      <marker id="arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>
    </defs>
    <g>
      ${headers}
    </g>
    <g>
      ${edges}
    </g>
    <g>
      ${nodes}
    </g>
  </svg>
</main>
<script>
  const svg = document.getElementById("graph");
  svg.querySelectorAll(".node").forEach((node) => {
    const id = node.dataset.id;
    node.addEventListener("mouseenter", () => {
      svg.classList.add("focus");
      node.classList.add("on");
      svg.querySelectorAll('.edge[data-from="' + id + '"], .edge[data-to="' + id + '"]').forEach((edge) => {
        edge.classList.add("on");
        svg.querySelector('.node[data-id="' + edge.dataset.from + '"]').classList.add("on");
        svg.querySelector('.node[data-id="' + edge.dataset.to + '"]').classList.add("on");
      });
    });
    node.addEventListener("mouseleave", () => {
      svg.classList.remove("focus");
      svg.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
    });
  });
</script>
</body>
</html>
`;
}

const BULL_SVG = `<svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M19 20C10.5 20 4.5 15 4 5.5c3.5 5.8 9 8.6 17 9.2Z" fill="#ffc9a8"/>
    <path d="M45 20c8.5 0 14.5-5 15-14.5c-3.5 5.8-9 8.6-17 9.2Z" fill="#ffc9a8"/>
    <path d="M18 15h28L32 36Z" fill="#a78bfa"/><path d="M18 15l14 21v21h-6L20.5 34Z" fill="#6b4dff"/>
    <path d="M46 15 32 36v21h6l5.5-23Z" fill="#f0507c"/><rect x="23" y="45" width="18" height="12" rx="6" fill="#33224a"/>
  </svg>`;

// ─── command ──────────────────────────────────────────────────────────────────

export async function graphCommand(
  rootArg: string | undefined,
  options: { format?: string; out?: string; open?: boolean },
): Promise<void> {
  const format = options.format ?? "tree";
  if (!["tree", "mermaid", "dot", "html", "json"].includes(format)) {
    fail(`Unknown format "${format}".`, "Use tree, mermaid, dot, html or json.");
    return;
  }
  const root = path.resolve(rootArg ?? ".");
  const { config } = await loadBullConfig(root, "serve");
  const graph = buildImportGraph(new ProjectAnalyzer(root, config).analyze());
  const title = path.basename(root);

  const text =
    format === "mermaid"
      ? renderMermaid(graph)
      : format === "dot"
        ? renderDot(graph)
        : format === "json"
          ? `${JSON.stringify(graph, null, 2)}\n`
          : format === "html"
            ? renderHtml(graph, title)
            : undefined;

  if (text === undefined) {
    banner("graph");
    process.stdout.write(renderTree(graph));
  } else if (options.out || format === "html") {
    const out = path.resolve(options.out ?? "bull-graph.html");
    fs.writeFileSync(out, text);
    banner("graph");
    console.log(`  ${pc.green("✓")} Wrote ${pc.bold(path.relative(process.cwd(), out) || out)}`);
    if (options.open) openInBrowser(out);
  } else {
    process.stdout.write(text);
  }
  if (graph.edges.some((e) => e.violation) || graph.cycles.length) process.exitCode = 1;
}

function openInBrowser(file: string): void {
  const command =
    process.platform === "win32"
      ? `start "" "${file}"`
      : process.platform === "darwin"
        ? `open "${file}"`
        : `xdg-open "${file}"`;
  exec(command);
}
