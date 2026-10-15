import { describe, expect, it } from "vitest";
import { localSvgPath, svgDataUrl } from "@/viewer/local-image.ts";

/**
 * Which image a document may show: an SVG beside it, named relative to it. The document's own
 * folder is the boundary, as the focus-diagrams sensor draws it, and the server's guardPath
 * still holds the record boundary behind this.
 */
describe("localSvgPath", () => {
  const doc = "construction/u1/focus-test/focus-test-report.md";

  it("resolves an svg in the document's folder to a record-relative path", () => {
    expect(localSvgPath(doc, "diagrams/a.svg")).toBe("construction/u1/focus-test/diagrams/a.svg");
    expect(localSvgPath(doc, "./a.SVG")).toBe("construction/u1/focus-test/a.SVG");
    expect(localSvgPath("report.md", "a.svg")).toBe("a.svg");
    // A browser loads the file without its fragment or query.
    expect(localSvgPath(doc, "diagrams/a.svg#top")).toBe(
      "construction/u1/focus-test/diagrams/a.svg",
    );
    expect(localSvgPath(doc, "diagrams/a.svg?v=2")).toBe(
      "construction/u1/focus-test/diagrams/a.svg",
    );
    expect(localSvgPath(doc, "diagrams/%E6%A7%8B%E6%88%90.svg")).toBe(
      "construction/u1/focus-test/diagrams/構成.svg",
    );
    expect(localSvgPath(doc, "diagrams/../b.svg")).toBe("construction/u1/focus-test/b.svg");
  });

  it("refuses anything that leaves the document's folder or the machine", () => {
    for (const href of [
      "../other/a.svg",
      "diagrams/../../a.svg",
      "/etc/a.svg",
      "//cdn.example.com/a.svg",
      "https://example.com/a.svg",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "file:///c:/a.svg",
      "C:/a.svg",
      "diagrams\\a.svg",
      "%2e%2e/a.svg",
    ])
      expect(localSvgPath(doc, href), href).toBeNull();
  });

  it("refuses what is not an svg, or cannot be read as a path", () => {
    for (const href of ["shot.png", "a.svg.txt", "diagrams/", "", "diagrams/100%.svg"])
      expect(localSvgPath(doc, href), href).toBeNull();
  });
});

describe("svgDataUrl", () => {
  it("carries the drawing as a data url an <img> shows without fetching anything", () => {
    const url = svgDataUrl('<svg viewBox="0 0 1 1"><text>図 #1 & 100%</text></svg>');
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.slice("data:image/svg+xml;charset=utf-8,".length))).toBe(
      '<svg viewBox="0 0 1 1"><text>図 #1 & 100%</text></svg>',
    );
    // `#` would end the data url early.
    expect(url).not.toContain("#");
  });
});
