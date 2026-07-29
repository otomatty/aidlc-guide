import { bridgeMap } from "@aidlc-guide/docs-bridge";
import { listMarkdownRel, pickIoPath } from "@aidlc-guide/reader-core";
import type { ReadResult, StageIoPaths } from "@aidlc-guide/shared-types";

export async function buildStageIoPaths(
  recordDir: string,
  stage: string,
  unit: string | null,
): Promise<ReadResult<StageIoPaths>> {
  const key = stage.trim();
  if (!Object.hasOwn(bridgeMap.stages, key)) return { error: true, reason: "not-found" };
  const entry = bridgeMap.stages[key];
  if (entry === undefined) return { error: true, reason: "not-found" };

  const listed = await listMarkdownRel(recordDir);
  if (!("ok" in listed)) return listed;

  const resolve = (name: string): string | null => {
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    return pickIoPath(listed.value, fileName, { unit, stage: key });
  };

  return {
    ok: true,
    value: {
      stage: key,
      unit,
      inputs: Object.fromEntries(entry.inputs.map((name) => [name, resolve(name)])),
      outputs: Object.fromEntries(entry.outputs.map((name) => [name, resolve(name)])),
    },
  };
}
