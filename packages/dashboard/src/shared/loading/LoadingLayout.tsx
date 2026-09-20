import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSkeletonVisible } from "@/shared/loading/LoadingSequence.tsx";

/** Reserve the layout immediately, but show/announce it only after P-UI-5's delay. */
export function LoadingLayout({
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

export function Paragraph(): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function MatrixGrid(): ReactNode {
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
