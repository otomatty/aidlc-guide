import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export interface SourceVersionBadgeProps {
  sourceVersion: string | null;
}

/** Manifest / page `sourceVersion` readout in the Docs Shell header. */
export function SourceVersionBadge({ sourceVersion }: SourceVersionBadgeProps): ReactNode {
  if (sourceVersion === null || sourceVersion === "") return null;
  return (
    <Badge variant="secondary" data-testid="source-version">
      {sourceVersion}
    </Badge>
  );
}
