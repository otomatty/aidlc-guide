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
  // Own outputs win over the shared index, which answers for inputs another
  // stage produced.
  const own = artifactDocsOf(key);
  const resolve = (name: string): string | null => {
    const fileName = name.endsWith(".md")
      ? name
      : (own[name]?.fileName ?? artifactDocIndex().get(name)?.fileName ?? `${name}.md`);
    return pickIoPath(listed.value, fileName, { unit, stage: key });
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
