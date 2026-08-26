import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * FR-6.3 / S-AV-4. Props are `{ code }` and nothing else: the block knows only
 * "the text inside a mermaid fence", never how the surrounding document was
 * rendered. That is what makes it survive a renderer swap untouched
 * (nfr-design/logical-components.md「ADR-05 隔離の担保」).
 */

let engine: Promise<{
  initialize(config: Record<string, unknown>): void;
  render(id: string, code: string): Promise<{ svg: string }>;
}> | null = null;

function cssColor(varName: string, fallback: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${varName}, ${fallback})`;
  document.documentElement.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value === "" ? fallback : value;
}

function isDarkUi(): boolean {
  return (
    document.documentElement.classList.contains("dark") ||
    document.body.classList.contains("vscode-dark") ||
    document.body.classList.contains("vscode-high-contrast")
  );
}

/** Map the live document tokens (incl. VS Code `--vscode-*` via globals.css) into mermaid. */
function mermaidConfig(): Record<string, unknown> {
  const dark = isDarkUi();
  const fg = cssColor("--foreground", dark ? "#e6e6e6" : "#1a1a1a");
  const bg = cssColor("--background", dark ? "#1e1e1e" : "#ffffff");
  const muted = cssColor("--muted", dark ? "#2b2b2b" : "#f4f4f5");
  const border = cssColor("--border", dark ? "#555555" : "#d4d4d8");
  return {
    securityLevel: "strict",
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      darkMode: dark,
      background: bg,
      primaryColor: muted,
      primaryTextColor: fg,
      primaryBorderColor: border,
      secondaryColor: muted,
      tertiaryColor: bg,
      lineColor: fg,
      textColor: fg,
      mainBkg: muted,
      actorBkg: muted,
      actorBorder: border,
      actorTextColor: fg,
      actorLineColor: fg,
      signalColor: fg,
      signalTextColor: fg,
      labelBoxBkgColor: muted,
      labelBoxBorderColor: border,
      labelTextColor: fg,
      loopTextColor: fg,
      noteBkgColor: muted,
      noteBorderColor: border,
      noteTextColor: fg,
      activationBkgColor: muted,
      activationBorderColor: border,
      sequenceNumberColor: fg,
    },
  };
}

/**
 * Module-scope memo (P-AV-3): the library is fetched on the first diagram in
 * the session and never again. `securityLevel: "strict"` disables click
 * bindings and script content; `startOnLoad: false` stops mermaid from
 * scanning the document behind our back (S-AV-4).
 */
function mermaidEngine(): Promise<{
  initialize(config: Record<string, unknown>): void;
  render(id: string, code: string): Promise<{ svg: string }>;
}> {
  engine ??= import("mermaid").then((module) => {
    module.default.initialize(mermaidConfig());
    return module.default;
  });
  return engine;
}

/** Test seam: drops the memo so a fresh `initialize` can be observed. */
export function resetMermaidEngine(): void {
  engine = null;
}

let sequence = 0;

/**
 * Mermaid hands back an SVG *string*. It is parsed with `DOMParser` and
 * adopted as a node rather than assigned to `innerHTML`: DOMParser does not
 * execute scripts, and the ban on raw HTML injection (S-AV-3) holds with no
 * exception carved out for this component.
 */
function adopt(host: HTMLElement, svg: string): void {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.nodeName === "parsererror" || parsed.getElementsByTagName("parsererror").length > 0) {
    throw new Error("mermaid returned unparseable SVG");
  }
  host.replaceChildren(document.importNode(root, true));
}

export function MermaidBlock({ code }: { code: string }): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    sequence += 1;
    const id = `mermaid-${sequence}`;

    // Diagrams render one by one and independently: a failure here shows this
    // block as code and leaves every other diagram on the page alone (D3
    // partial).
    void mermaidEngine()
      .then(async (mermaid) => {
        // Re-apply tokens each render so a VS Code theme switch (same dark class,
        // new --vscode-* values) is not stuck on the first initialize.
        mermaid.initialize(mermaidConfig());
        const { svg } = await mermaid.render(id, code);
        if (!live || host.current === null) return;
        adopt(host.current, svg);
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
    };
  }, [code]);

  if (failed) {
    return (
      <figure className="viewer__diagram" data-testid="mermaid-fallback">
        <pre className="viewer__raw">
          <code>{code}</code>
        </pre>
        <figcaption className="viewer__note" role="status">
          図として描画できません（構文を確認してください）
        </figcaption>
      </figure>
    );
  }

  return <div className="viewer__diagram" data-testid="mermaid-diagram" ref={host} />;
}
