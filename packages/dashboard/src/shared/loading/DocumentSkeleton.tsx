import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingLayout, Paragraph } from "@/shared/loading/LoadingLayout.tsx";

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
