import { createContext, Fragment, type ReactNode, useContext, useEffect, useState } from "react";
import { fetchArtifact } from "@/services/api.ts";
import { isSvgDocument, localSvgPath, MAX_SVG_CHARS, svgDataUrl } from "./local-image.ts";

/**
 * The record-relative path of the document being rendered, for the images in it. Absent (null),
 * as for guides and official docs, every image stays its alt text.
 */
export const DocumentPathContext = createContext<string | null>(null);

type Loaded = { kind: "loading" } | { kind: "shown"; url: string } | { kind: "unavailable" };

function LocalSvg({ path, alt }: { path: string; alt: string }): ReactNode {
  const [state, setState] = useState<Loaded>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    void fetchArtifact(path).then((result) => {
      if (!live) return;
      const svg = "ok" in result ? result.value : null;
      setState(
        svg !== null && svg.length <= MAX_SVG_CHARS && isSvgDocument(svg)
          ? { kind: "shown", url: svgDataUrl(svg) }
          : { kind: "unavailable" },
      );
    });
    return () => {
      live = false;
    };
  }, [path]);
  if (state.kind === "shown")
    return <img className="viewer__diagram" src={state.url} alt={alt} data-image-path={path} />;
  // Until it loads, and if it cannot be read, the reader still gets what the image says.
  return (
    <span data-image-state={state.kind} data-image-path={path}>
      {alt}
    </span>
  );
}

/** A Markdown image: an SVG beside the document is drawn; anything else is its alt text. */
export function MarkdownImage({ href, alt }: { href: string; alt: string }): ReactNode {
  const documentPath = useContext(DocumentPathContext);
  const path = documentPath === null ? null : localSvgPath(documentPath, href);
  return path === null ? <Fragment>{alt}</Fragment> : <LocalSvg path={path} alt={alt} />;
}
