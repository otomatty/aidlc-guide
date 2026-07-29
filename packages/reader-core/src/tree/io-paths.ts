function pathBasename(relPath: string): string {
  const slash = relPath.lastIndexOf("/");
  return slash === -1 ? relPath : relPath.slice(slash + 1);
}

function pathSegments(relPath: string): string[] {
  return relPath.split("/");
}

/** hits = record 相対 POSIX（`/`）。fileName は `foo.md`。 */
export function pickIoPath(
  hits: readonly string[],
  fileName: string,
  opts: { unit: string | null; stage: string },
): string | null {
  if (opts.unit !== null) {
    const unitPrefix = `construction/${opts.unit}/`;
    const unitHits = hits.filter(
      (hit) => hit.startsWith(unitPrefix) && pathBasename(hit) === fileName,
    );
    if (unitHits.length === 1) {
      const hit = unitHits[0];
      if (hit !== undefined) return hit;
    }
    if (unitHits.length > 1) {
      const stageHits = unitHits.filter((hit) => {
        const segments = pathSegments(hit);
        return segments.length >= 3 && segments[2] === opts.stage;
      });
      const pool = stageHits.length > 0 ? stageHits : unitHits;
      const picked = [...pool].sort()[0];
      if (picked !== undefined) return picked;
    }
  }

  const stageDirHits = hits.filter((hit) => {
    const segments = pathSegments(hit);
    return (
      segments.length === 3 &&
      segments[0] === "construction" &&
      segments[1] === opts.stage &&
      segments[2] === fileName
    );
  });
  if (stageDirHits.length === 1) {
    const hit = stageDirHits[0];
    if (hit !== undefined) return hit;
  }

  const sharedHits = hits.filter(
    (hit) => !hit.startsWith("construction/") && pathBasename(hit) === fileName,
  );
  if (sharedHits.length === 1) {
    const hit = sharedHits[0];
    if (hit !== undefined) return hit;
  }

  return null;
}
