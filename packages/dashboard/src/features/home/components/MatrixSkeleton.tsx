import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingLayout, MatrixGrid } from "@/shared/loading/LoadingLayout.tsx";

export function MatrixSkeleton({ heading = false }: { heading?: boolean }): ReactNode {
  return (
    <LoadingLayout label="成果物マトリクス">
      {heading ? <Skeleton className="mb-3 h-6 w-40" /> : null}
      <MatrixGrid />
    </LoadingLayout>
  );
}
