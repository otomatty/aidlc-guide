import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingLayout } from "@/shared/loading/LoadingLayout.tsx";

export function StageRailSkeleton(): ReactNode {
  return (
    <LoadingLayout label="ステージ一覧" className="flex flex-col gap-4">
      {["initialization", "ideation", "inception"].map((phase) => (
        <div key={phase}>
          <Skeleton className="mb-2 h-4 w-28" />
          <div className="flex flex-col gap-1">
            {["first", "second", "third"].map((stage) => (
              <div
                key={stage}
                className="flex items-start gap-2 rounded-lg border border-transparent px-2 py-1.5"
              >
                <Skeleton className="h-5 w-20 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="hidden h-4 w-3/4 md:block" />
                </div>
                <Skeleton className="h-4 w-8 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </LoadingLayout>
  );
}
