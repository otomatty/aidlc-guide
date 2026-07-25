/**
 * The two addressing rules of the viewer, in a leaf module with **no imports**
 * so that `DetailPanel` can use them without dragging the viewer chunk into the
 * initial bundle (P-AV-1).
 *
 * They live here rather than in `index.tsx` because DetailPanel's prefetch and
 * the viewer's own initial state have to agree on which artifact opens first;
 * two copies of that rule could drift and the prefetch would warm the wrong
 * path (P-AV-2).
 */

/** Record-relative, POSIX-separated — the wire format, not a filesystem path. */
export function artifactPath(unit: string, stage: string, file: string): string {
  return `construction/${unit}/${stage}/${file}`;
}

/** The artifact a cell opens with. `null` when the cell holds none. */
export function firstArtifact(files: readonly string[]): string | null {
  return files[0] ?? null;
}
