import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { Fragment, type ReactNode } from "react";

/**
 * Fence → highlighted React tree. highlight.js escapes the source before
 * wrapping tokens in `<span class="…">`; we rehydrate that HTML through an
 * allow-list (span + text only) so S-AV-3 stays structural — no
 * `dangerouslySetInnerHTML`, no arbitrary tags from the fence body.
 */

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("svg", xml);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("docker", dockerfile);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("toml", ini);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("text", plaintext);

function walkNodes(nodes: NodeListOf<ChildNode>): ReactNode[] {
  return Array.from(nodes, (node, index) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // biome-ignore lint/suspicious/noArrayIndexKey: token position is the identity
      return <Fragment key={index}>{node.textContent}</Fragment>;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as Element;
    if (el.tagName === "SPAN") {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: token position is the identity
        <span key={index} className={el.getAttribute("class") ?? undefined}>
          {walkNodes(el.childNodes)}
        </span>
      );
    }
    // Anything unexpected collapses to text (never an element the fence chose).
    // biome-ignore lint/suspicious/noArrayIndexKey: token position is the identity
    return <Fragment key={index}>{el.textContent}</Fragment>;
  });
}

/** highlight.js HTML → React, span/text only. */
export function hljsHtmlToReact(html: string): ReactNode {
  const doc = new DOMParser().parseFromString(`<div id="hljs-root">${html}</div>`, "text/html");
  const root = doc.getElementById("hljs-root");
  return root === null ? null : walkNodes(root.childNodes);
}

export function highlightFence(code: string, lang: string | undefined): ReactNode {
  const language = lang?.trim().toLowerCase();
  if (language === undefined || language === "" || hljs.getLanguage(language) === undefined) {
    return code;
  }
  const { value } = hljs.highlight(code, { language, ignoreIllegals: true });
  return hljsHtmlToReact(value);
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }): ReactNode {
  const language = lang?.trim().toLowerCase() || undefined;
  return (
    <pre className="viewer__code" data-testid="code-block" data-language={language ?? "plaintext"}>
      <code className={language === undefined ? undefined : `language-${language}`}>
        {highlightFence(code, language)}
      </code>
    </pre>
  );
}
