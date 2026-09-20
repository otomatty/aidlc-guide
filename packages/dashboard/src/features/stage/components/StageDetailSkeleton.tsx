import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingLayout, Paragraph } from "@/shared/loading/LoadingLayout.tsx";

export function StageDetailSkeleton(): ReactNode {
  return (
    <LoadingLayout label="ステージ解説">
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-16" />
          </CardTitle>
          <CardDescription>
            <Paragraph />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {["inputs", "outputs"].map((id) => (
            <div key={id} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-5 h-4 w-2/3" />
              <Skeleton className="ml-5 h-4 w-1/2" />
            </div>
          ))}
          {["agent", "gate"].map((id) => (
            <div key={id} className="flex flex-col gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
          <Skeleton className="h-5 w-36" />
        </CardContent>
      </Card>
    </LoadingLayout>
  );
}
