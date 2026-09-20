import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingLayout } from "@/shared/loading/LoadingLayout.tsx";

export function NavigationSkeleton({ label }: { label: string }): ReactNode {
  return (
    <LoadingLayout label={label} className="flex flex-col gap-1">
      <div className="flex items-center gap-2 py-3">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      {["first", "second", "third", "fourth"].map((id) => (
        <div key={id} className="flex items-center gap-2 px-3 py-2">
          <Skeleton className="size-4 shrink-0" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </LoadingLayout>
  );
}
