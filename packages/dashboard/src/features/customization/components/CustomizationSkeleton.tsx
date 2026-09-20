import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import "@/features/customization/customization-map.css";
import { LoadingLayout, MatrixGrid, Paragraph } from "@/shared/loading/LoadingLayout.tsx";

export function CustomizationSkeleton({ page = true }: { page?: boolean }): ReactNode {
  return (
    <LoadingLayout
      label="カスタマイズ"
      className={cn("flex min-w-0 flex-col gap-5", page && "p-4")}
    >
      {page ? (
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="ml-auto h-6 w-20" />
        </div>
      ) : null}
      <div className="customization-map">
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-32" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
        <div className="flex h-16 items-center justify-center">
          <Skeleton className="size-6" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-40" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-24" />
            <MatrixGrid />
          </CardContent>
        </Card>
        <div className="customization-supports">
          <div className="customization-support-stem" />
          <div className="customization-support-bus" />
          <p className="customization-support-caption">
            <Skeleton className="h-4 w-32" />
          </p>
          <div className="customization-support-grid">
            {["agents", "quality", "rules", "knowledge"].map((id) => (
              <div key={id} className="customization-support-item">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>
                      <Skeleton className="h-6 w-1/2" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Paragraph />
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingLayout>
  );
}
