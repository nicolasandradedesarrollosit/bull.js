/**
 * Code of the overlay that runs in the browser during `bull dev`.
 *
 * It is served as a virtual module: the plugin takes the source of
 * `overlayMain` with `toString()` and calls it with `import.meta.hot`.
 * That is why the function must be self-contained: it cannot use anything
 * from the module scope.
 */

interface HotLike {
  on(event: string, cb: (payload: OverlayPayload) => void): void;
  send(event: string, data?: unknown): void;
}

interface FrameLine {
  line: number;
  text: string;
  highlight?: [number, number];
}

interface OverlayDiagnostic {
  code: string;
  severity: "error" | "warning";
  title: string;
  message: string;
  file?: string;
  absoluteFile?: string;
  line?: number;
  column?: number;
  why: string;
  fix: string[];
  notes?: string[];
  explain: string;
  fixable?: boolean;
  frame?: FrameLine[];
}

export interface OverlayPayload {
  errorCount: number;
  warningCount: number;
  diagnostics: OverlayDiagnostic[];
  mode: "dismissible" | "blocking";
}

export function overlayMain(hot: HotLike | undefined): void {
  if (!hot || typeof customElements === "undefined") return;

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop {
      position: fixed; inset: 0; z-index: 2147483646; overflow-y: auto;
      background: rgba(9, 9, 14, 0.72); backdrop-filter: blur(6px);
      font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #e6e6ef; padding: 48px 16px;
    }
    .panel { max-width: 920px; margin: 0 auto; }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .logo { display: block; width: 40px; height: 40px; flex: none; }
    header h1 { font-size: 18px; margin: 0; font-weight: 650; letter-spacing: -0.01em; }
    header p { margin: 0; color: #9a9ab0; font-size: 13px; }
    .spacer { flex: 1; }
    .close {
      border: 1px solid #34344a; background: #1b1b27; color: #c8c8da; border-radius: 8px;
      padding: 6px 12px; cursor: pointer; font: inherit; font-size: 13px;
    }
    .close:hover { background: #26263a; }
    .arch {
      display: flex; gap: 8px; align-items: center; margin: 0 0 20px; padding: 10px 14px;
      background: #14141d; border: 1px solid #262636; border-radius: 10px; font-size: 13px; color: #9a9ab0;
      flex-wrap: wrap;
    }
    .layer { padding: 2px 10px; border-radius: 999px; background: #1f2a22; color: #7ee2a8; font-weight: 600; }
    .arrow { color: #4c8f69; }
    .card {
      background: #15151f; border: 1px solid #2a2a3c; border-left: 4px solid var(--tone);
      border-radius: 12px; padding: 18px 20px; margin-bottom: 16px;
    }
    .card.error { --tone: #ff5c7a; }
    .card.warning { --tone: #ffc04d; }
    .card-head { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
    .title { color: var(--tone); font-weight: 750; font-size: 13px; letter-spacing: 0.04em; }
    .code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: #8a8aa3; }
    .loc {
      margin-left: auto; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: #a99bff;
      background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline dotted;
    }
    .message { font-size: 16px; font-weight: 600; margin: 10px 0 12px; color: #fff; }
    pre {
      margin: 0 0 14px; padding: 12px 0; background: #0d0d14; border-radius: 8px; overflow-x: auto;
      font: 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .fl { display: block; padding: 0 14px; white-space: pre; color: #8d8da6; }
    .fl.hl { color: #f0f0f8; background: rgba(255, 92, 122, 0.08); }
    .warning .fl.hl { background: rgba(255, 192, 77, 0.08); }
    .ln { display: inline-block; min-width: 3ch; margin-right: 14px; color: #55556d; text-align: right; }
    mark { background: none; color: inherit; text-decoration: underline wavy var(--tone); text-underline-offset: 4px; }
    .why { color: #b9b9cc; margin: 0 0 12px; }
    .notes { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; color: #b9b9cc; margin: 0 0 12px; white-space: pre; }
    .fix-title { font-weight: 700; color: #7ee2a8; font-size: 13px; margin-bottom: 4px; }
    ol { margin: 0 0 10px; padding-left: 22px; color: #dadaea; }
    li { margin: 2px 0; }
    .sub { list-style: none; margin-left: -22px; padding-left: 22px; }
    code {
      font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; background: #232333;
      padding: 1px 6px; border-radius: 5px; color: #ffd4e0;
    }
    .explain { font-size: 12px; color: #6f6f88; }
    .fixable { font-size: 12.5px; color: #8fd3ff; margin-bottom: 6px; }
    .pill {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; cursor: pointer;
      display: flex; gap: 8px; align-items: center; border: 1px solid #3a2330;
      background: #1d1218; color: #ffb3c2; border-radius: 999px; padding: 8px 14px;
      font: 600 13px ui-sans-serif, system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.35);
    }
    .pill.warning { background: #1f1a10; color: #ffd98a; border-color: #3d3220; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  `;

  // The Bull logo (assets/brand/bull-logo.svg), inlined so the overlay has no dependencies.
  const bull = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M19 20C10.5 20 4.5 15 4 5.5c3.5 5.8 9 8.6 17 9.2Z" fill="#ffd9bf"/>
    <path d="M45 20c8.5 0 14.5-5 15-14.5c-3.5 5.8-9 8.6-17 9.2Z" fill="#ffd9bf"/>
    <path d="M19.5 21 9 24.5l11.5 4Z" fill="#5a3df0"/><path d="M44.5 21 55 24.5l-11.5 4Z" fill="#e2456f"/>
    <path d="M18 15h28L32 36Z" fill="#a78bfa"/>
    <path d="M18 15l14 21v21h-6L20.5 34Z" fill="#6b4dff"/>
    <path d="M46 15 32 36v21h6l5.5-23Z" fill="#f0507c"/>
    <path d="m23.5 28.5 4.5 1.5-4 1.8Z" fill="#160f24"/><path d="m40.5 28.5-4.5 1.5 4 1.8Z" fill="#160f24"/>
    <rect x="23" y="45" width="18" height="12" rx="6" fill="#33224a"/>
    <ellipse cx="28" cy="50.5" rx="1.6" ry="2.2" fill="#ff7aa2"/><ellipse cx="36" cy="50.5" rx="1.6" ry="2.2" fill="#ff7aa2"/>
    <path d="M28.5 56.5a3.5 3.5 0 0 0 7 0" fill="none" stroke="#fff4e6" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

  function frameHtml(frame: FrameLine[]): string {
    const rows = frame.map((l) => {
      let text = esc(l.text);
      if (l.highlight) {
        const [from, to] = l.highlight;
        const raw = l.text;
        text = esc(raw.slice(0, from - 1)) + "<mark>" + esc(raw.slice(from - 1, to - 1) || " ") + "</mark>" + esc(raw.slice(to - 1));
      }
      return `<span class="fl${l.highlight ? " hl" : ""}"><span class="ln">${l.line}</span>${text}</span>`;
    });
    return `<pre>${rows.join("")}</pre>`;
  }

  function cardHtml(d: OverlayDiagnostic, i: number): string {
    const loc = d.file ? `${d.file}${d.line ? `:${d.line}:${d.column}` : ""}` : "";
    const fix = d.fix
      .map((f) => (f.startsWith("  ") ? `<li class="sub">${inline(f.trim())}</li>` : `<li>${inline(f)}</li>`))
      .join("");
    return `
      <section class="card ${d.severity}">
        <div class="card-head">
          <span class="title">${esc(d.title)}</span>
          <span class="code">${esc(d.code)}</span>
          ${loc ? `<button class="loc" data-open="${i}" title="Open in editor">${esc(loc)}</button>` : ""}
        </div>
        <div class="message">${inline(d.message)}</div>
        ${d.frame ? frameHtml(d.frame) : ""}
        ${d.notes?.length ? `<div class="notes">${esc(d.notes.join("\n"))}</div>` : ""}
        <p class="why">${inline(d.why)}</p>
        <div class="fix-title">How to fix</div>
        <ol>${fix}</ol>
        ${d.fixable ? `<div class="fixable">✦ Auto-fixable: run <code>bull fix</code></div>` : ""}
        <div class="explain">More info in the terminal: <code>${esc(d.explain)}</code></div>
      </section>`;
  }

  class BullOverlay extends HTMLElement {
    payload: OverlayPayload | null = null;
    collapsed = false;
    readonly root: ShadowRoot;

    constructor() {
      super();
      this.root = this.attachShadow({ mode: "open" });
      this.root.addEventListener("click", (event) => this.onClick(event));
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.payload?.mode !== "blocking") this.collapse(true);
      });
    }

    update(payload: OverlayPayload): void {
      const changed = JSON.stringify(payload.diagnostics) !== JSON.stringify(this.payload?.diagnostics);
      this.payload = payload;
      if (changed && payload.errorCount > 0) this.collapsed = false;
      if (payload.errorCount === 0 && payload.diagnostics.length > 0 && changed) this.collapsed = true;
      this.render();
    }

    collapse(value: boolean): void {
      this.collapsed = value;
      this.render();
    }

    onClick(event: Event): void {
      const target = event.target as HTMLElement;
      if (target.closest(".close")) return this.collapse(true);
      if (target.closest(".pill")) return this.collapse(false);
      const open = target.closest<HTMLElement>("[data-open]");
      if (open && this.payload) {
        const d = this.payload.diagnostics[Number(open.dataset.open)];
        if (d?.absoluteFile) {
          void fetch(`/__open-in-editor?file=${encodeURIComponent(`${d.absoluteFile}:${d.line ?? 1}:${d.column ?? 1}`)}`);
        }
      }
    }

    render(): void {
      const p = this.payload;
      if (!p || p.diagnostics.length === 0) {
        this.root.innerHTML = "";
        return;
      }
      const tone = p.errorCount ? "error" : "warning";
      const summary = [
        p.errorCount ? `${p.errorCount} ${p.errorCount === 1 ? "error" : "errors"}` : "",
        p.warningCount ? `${p.warningCount} ${p.warningCount === 1 ? "warning" : "warnings"}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      if (this.collapsed && p.mode !== "blocking") {
        this.root.innerHTML = `<style>${css}</style><button class="pill ${tone}"><span class="dot"></span>MVVM · ${summary}</button>`;
        return;
      }
      this.root.innerHTML = `
        <style>${css}</style>
        <div class="backdrop" role="dialog" aria-label="MVVM architecture errors">
          <div class="panel">
            <header>
              ${bull}
              <div>
                <h1>The MVVM architecture is broken</h1>
                <p>${summary}${p.mode === "blocking" ? " · the app unlocks once you fix it" : " · Esc to close"}</p>
              </div>
              <div class="spacer"></div>
              ${p.mode === "blocking" ? "" : `<button class="close">Close</button>`}
            </header>
            <div class="arch">
              Allowed direction:
              <span class="layer">View</span><span class="arrow">──▶</span>
              <span class="layer">ViewModel</span><span class="arrow">──▶</span>
              <span class="layer">Model</span>
            </div>
            ${p.diagnostics.map(cardHtml).join("")}
          </div>
        </div>`;
    }
  }

  const TAG = "bull-mvvm-overlay";
  if (!customElements.get(TAG)) customElements.define(TAG, BullOverlay);
  let element = document.querySelector(TAG) as BullOverlay | null;
  const ensure = () => {
    if (!element) {
      element = document.createElement(TAG) as BullOverlay;
      document.documentElement.appendChild(element);
    }
    return element;
  };

  hot.on("bull:diagnostics", (payload) => ensure().update(payload));
  hot.send("bull:request");
}

export const OVERLAY_PUBLIC_PATH = "/@bull/overlay.js";

/** Code of the virtual module served to the browser. */
export function overlayModuleCode(): string {
  return `(${overlayMain.toString()})(import.meta.hot);\n`;
}
