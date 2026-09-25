import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LoadingLayout } from "@/shared/loading/LoadingLayout.tsx";

export function NowStripSkeleton({ expanded = false }: { expanded?: boolean }): ReactNode {
  return (
    <LoadingLayout label="現在のステージ">
      <div className="flex items-center gap-2 border border-transparent py-2.5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="ml-auto size-4" />
      </div>
      {expanded ? (
        <div className="@container pb-2.5">
          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 @min-[25.5rem]:grid-cols-2 @min-[52.5rem]:grid-cols-4">
            {["phase", "scope", "depth", "done"].map((id) => (
              <div
                key={id}
                className="flex min-w-0 flex-col gap-1 border border-transparent px-1 py-0.5"
              >
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
            <div className="col-span-full flex min-w-0 flex-col gap-1 border border-transparent px-1 py-0.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-1/2" />
            </div>
            <div className="col-span-full grid grid-cols-1 items-start gap-x-6 gap-y-4 @min-[25.5rem]:grid-cols-2 @min-[52.5rem]:grid-cols-4">
              {["elapsed", "remaining", "next-gate", "total-remaining"].map((id) => (
                <div
                  key={id}
                  className={cn(
                    "flex min-w-0 flex-col gap-1 px-1 py-0.5",
                    id === "total-remaining" ? null : "border border-transparent",
                  )}
                >
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </LoadingLayout>
  );
}
