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
import { useSkeletonVisible } from "./LoadingSequence.tsx";
import "./customization/customization-map.css";
import {
  EFFECTIVENESS_METRIC_GRID,
  EFFECTIVENESS_RECORD_GRID,
  EFFECTIVENESS_SUMMARY_GRID,
} from "./effectiveness-layout.ts";

/** Reserve the layout immediately, but show/announce it only after P-UI-5's delay. */
function LoadingLayout({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const visible = useSkeletonVisible();
  return (
    <div
      role="status"
      aria-hidden={!visible}
      aria-busy="true"
      aria-label={visible ? `${label}を読み込み中` : undefined}
      className={cn("min-w-0", !visible && "invisible")}
    >
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  );
}

function Paragraph(): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

/** Markdown viewers share headings, paragraphs and a block, rather than uniform rows. */
export function DocumentSkeleton({ label }: { label: string }): ReactNode {
  return (
    <LoadingLayout label={label} className="flex flex-col gap-6">
      <Skeleton className="h-7 w-2/3" />
      <Paragraph />
      <Skeleton className="h-5 w-2/5" />
      <Paragraph />
      <Skeleton className="h-28 w-full" />
    </LoadingLayout>
  );
}

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

function MatrixGrid(): ReactNode {
  return (
    <div className="relative overflow-x-auto">
      <div className="grid min-w-matrix grid-cols-matrix border-l border-t">
        {["heading", "unit-a", "unit-b", "unit-c"].flatMap((row) =>
          ["unit", "stage-a", "stage-b", "stage-c", "stage-d"].map((column) => (
            <div
              key={`${row}-${column}`}
              className="flex h-12 items-center justify-center border-b border-r p-2"
            >
              <Skeleton
                className={row === "heading" || column === "unit" ? "h-4 w-3/4" : "h-4 w-8"}
              />
            </div>
          )),
        )}
      </div>
    </div>
  );
}

export function MatrixSkeleton({ heading = false }: { heading?: boolean }): ReactNode {
  return (
    <LoadingLayout label="成果物マトリクス">
      {heading ? <Skeleton className="mb-3 h-6 w-40" /> : null}
      <MatrixGrid />
    </LoadingLayout>
  );
}

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
            <div className="col-span-full grid grid-cols-1 items-start gap-x-6 gap-y-4 @min-[25.5rem]:grid-cols-2 @min-[52.5rem]:grid-cols-3">
              {["elapsed", "remaining", "total-remaining"].map((id) => (
                <div
                  key={id}
                  className={cn(
                    "flex min-w-0 flex-col gap-1 px-1 py-0.5",
                    id === "total-remaining"
                      ? "@min-[25.5rem]:col-span-2 @min-[52.5rem]:col-span-1"
                      : "border border-transparent",
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
