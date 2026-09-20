import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  EFFECTIVENESS_METRIC_GRID,
  EFFECTIVENESS_RECORD_GRID,
  EFFECTIVENESS_SUMMARY_GRID,
} from "@/features/effectiveness/utils/layout.ts";
import { LoadingLayout } from "@/shared/loading/LoadingLayout.tsx";

function EffectivenessContentSkeleton(): ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-24" />
      <div className={EFFECTIVENESS_SUMMARY_GRID} data-testid="effectiveness-summary-skeleton">
        {["duration", "wait", "rejections", "checks"].map((id) => (
          <Card key={id} size="sm">
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-5 w-3/4" />
              </CardTitle>
              <CardDescription>
                <Skeleton
                  className={cn(
                    "w-full",
                    id === "checks" ? "h-10" : id === "rejections" ? "h-5 xl:h-10" : "h-5",
                  )}
                />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-4 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="grid min-w-0 gap-4">
        <div className="grid gap-1">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <div className={EFFECTIVENESS_RECORD_GRID} data-testid="effectiveness-records-skeleton">
          {["first", "second"].map((id) => (
            <Card key={id} className="min-w-0">
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-6 w-2/3" />
                </CardTitle>
                <CardDescription>
                  <Skeleton className="h-10 w-5/6 sm:h-5" />
                </CardDescription>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={EFFECTIVENESS_METRIC_GRID}>
                  {["duration", "wait", "rejections", "checks"].map((metric) => (
                    <div key={metric} className="grid min-w-0 content-start gap-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-16" />
                      {metric === "rejections" ? null : (
                        <Skeleton className={cn("w-24", metric === "checks" ? "h-6" : "h-4")} />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-5 w-28" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
      <Skeleton className="h-4 w-48 max-w-full" />
    </div>
  );
}

export function EffectivenessSkeleton({ page = false }: { page?: boolean }): ReactNode {
  return (
    <LoadingLayout label="効果測定" className={page ? "p-4" : undefined}>
      {page ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <Skeleton className="h-7 w-24" />
          </div>
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      ) : null}
      <EffectivenessContentSkeleton />
    </LoadingLayout>
  );
}
