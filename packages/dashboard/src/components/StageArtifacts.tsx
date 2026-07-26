import type { MatrixCell } from "@aidlc-guide/shared-types";
import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prefetchArtifact } from "../services/api.ts";
import { artifactPath, firstArtifact } from "../viewer/artifact-path.ts";
import { Skeleton } from "./atoms.tsx";

const ArtifactViewer = lazy(async () => await import("../viewer/index.tsx"));

/** Cells of `stage` that already hold at least one `*.md` artifact. */
export function cellsWithArtifacts(cells: readonly MatrixCell[], stage: string): MatrixCell[] {
  return cells.filter((cell) => cell.stage === stage && cell.files.length > 0);
}

export interface StageArtifactsProps {
  stage: string;
  cells: readonly MatrixCell[];
  /** Unit to open first; falls back to the first cell when absent from `cells`. */
  initialUnit: string;
  hostMode: boolean;
}

/**
 * Stage-scoped artifact strip: one unit auto-opens; several units get a tab
 * switcher. File switching lives inside ArtifactViewer.
 */
export function StageArtifacts({
  stage,
  cells,
  initialUnit,
  hostMode,
}: StageArtifactsProps): ReactNode {
  const fallbackUnit = cells[0]?.unit ?? "";
  const startUnit = cells.some((cell) => cell.unit === initialUnit) ? initialUnit : fallbackUnit;
  const [unit, setUnit] = useState(startUnit);
  const warmed = useRef<string | null>(null);

  useEffect(() => {
    setUnit(startUnit);
  }, [startUnit]);

  const cell = cells.find((each) => each.unit === unit) ?? cells[0];
  const openFirst = cell === undefined ? null : firstArtifact(cell.files);
  const target =
    cell === undefined || openFirst === null ? null : artifactPath(cell.unit, stage, openFirst);
  if (warmed.current !== target) {
    warmed.current = target;
    if (target !== null) prefetchArtifact(target);
  }

  if (cell === undefined) return null;

  return (
    <div className="mt-5 border-t pt-4" data-testid="stage-artifacts">
      {cells.length > 1 ? (
        <Tabs
          value={unit}
          onValueChange={(value) => {
            if (typeof value === "string") setUnit(value);
          }}
          className="mb-3"
        >
          <TabsList aria-label="ユニット" data-testid="unit-tabs">
            {cells.map((each) => (
              <TabsTrigger key={each.unit} value={each.unit} className="font-mono text-xs">
                {each.unit}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <Suspense fallback={<Skeleton lines={6} label="成果物" />}>
        <ArtifactViewer
          unit={cell.unit}
          stage={stage}
          files={cell.files}
          verdict={cell.verdict}
          hostMode={hostMode}
        />
      </Suspense>
    </div>
  );
}
