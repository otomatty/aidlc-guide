import { artifactDocIndex, artifactDocsOf, stageIoOf } from "@aidlc-guide/docs-bridge";
import { listMarkdownRel, pickIoPath } from "@aidlc-guide/reader-core";
import type { ReadResult, StageIoPaths } from "@aidlc-guide/shared-types";

export async function buildStageIoPaths(
  recordDir: string,
  stage: string,
  unit: string | null,
): Promise<ReadResult<StageIoPaths>> {
  const key = stage.trim();
  const io = stageIoOf(key);
  if (io === undefined) return { error: true, reason: "not-found" };

  const listed = await listMarkdownRel(recordDir);
  if (!("ok" in listed)) return listed;

  // A canonical artifact name is not always its filename: `build-test-results`
  // lands as `test-results.md`. Probing `<name>.md` alone silently resolves
  // those to null and renders the artifact as dead text instead of a link.
  //
  // Both names are tried, canonical first. Records committed under
  // `aidlc/spaces/` were written with the canonical name, so replacing rather
  // than extending the probe would unlink every one of them; the mapping is
  // additive reach, not a correction. Own outputs win over the shared index,
  // which answers for inputs another stage produced.
  //
  // A `.json` mapping is skipped: `listMarkdownRel` lists `.md` and nothing
  // else, so it can never match, and the canonical `<name>.md` probe still
  // finds the `traceability.md` a State Version 7 record wrote.
  const own = artifactDocsOf(key);
  const candidates = (name: string): string[] => {
    if (name.endsWith(".md")) return [name];
    const mapped = own[name]?.fileName ?? artifactDocIndex().get(name)?.fileName;
    const canonical = `${name}.md`;
    return mapped === undefined || mapped === canonical || !mapped.endsWith(".md")
      ? [canonical]
      : [canonical, mapped];
  };
  // Two passes, not one loop: `pickIoPath` ends a candidate on a shared-tree
  // match, so trying the canonical name to exhaustion first would let a stray
  // shared file win over this stage's own copy under the mapped name. Every
  // candidate gets its unit- and stage-specific chance before any shared one.
  const resolve = (name: string): string | null => {
    const names = candidates(name);
    for (const fileName of names) {
      const hit = pickIoPath(listed.value, fileName, { unit, stage: key, allowShared: false });
      if (hit !== null) return hit;
    }
    for (const fileName of names) {
      const hit = pickIoPath(listed.value, fileName, { unit, stage: key });
      if (hit !== null) return hit;
    }
    return null;
  };

  return {
    ok: true,
    value: {
      stage: key,
      unit,
      inputs: Object.fromEntries(io.inputs.map((name) => [name, resolve(name)])),
      outputs: Object.fromEntries(io.outputs.map((name) => [name, resolve(name)])),
    },
  };
}
