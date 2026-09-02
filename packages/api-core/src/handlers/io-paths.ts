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
  //
  // Only a Markdown mapping is used. `listMarkdownRel` lists `.md` and nothing
  // else, so a `.json` artifact has no path to offer either way; keeping the
  // `<name>.md` probe there still finds the `traceability.md` a State Version 7
  // record wrote, which substituting `traceability.json` would lose.
  const own = artifactDocsOf(key);
  const mapped = (name: string): string | undefined => {
    const fileName = own[name]?.fileName ?? artifactDocIndex().get(name)?.fileName;
    return fileName?.endsWith(".md") === true ? fileName : undefined;
  };
  const resolve = (name: string): string | null =>
    pickIoPath(listed.value, name.endsWith(".md") ? name : (mapped(name) ?? `${name}.md`), {
      unit,
      stage: key,
    });

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
