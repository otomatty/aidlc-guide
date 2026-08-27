import { CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton as SkeletonPrimitive } from "@/components/ui/skeleton";
import { STATUS_PRESENTATION } from "./StatusChip.tsx";

/**
 * Cross-cutting feedback pieces built on stock shadcn/ui primitives.
 */

export function Skeleton({ lines = 3, label }: { lines?: number; label: string }): ReactNode {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`${label}を読み込み中`}
      className="flex flex-col gap-2"
    >
      {Array.from({ length: lines }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: purely decorative bars
        <SkeletonPrimitive key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}

/** R-UI-2: degradation always shows up as an element. */
export function UnparseableBadge({ detail }: { detail: string }): ReactNode {
  const { symbol, label } = STATUS_PRESENTATION.unparseable;
  return (
    <Badge variant="destructive" role="status">
      <span aria-hidden="true">{symbol}</span>
      解析不可（{label}）: {detail}
    </Badge>
  );
}

export function EmptyState({
  hint,
  children,
  showCreateHint = true,
  title = "ワークフローはまだありません",
}: {
  hint: string;
  children?: ReactNode;
  /**
   * Suppresses the "create your first intent" paragraph — wrong wording when
   * an intent already exists (`state-missing`, spec §7-2 / §9). Defaults to
   * `true` so every other caller keeps today's copy unchanged.
   */
  showCreateHint?: boolean;
  title?: string;
}): ReactNode {
  return (
    <Empty role="alert" className="border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{hint}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {showCreateHint ? (
          <p>
            `/aidlc`
            で最初のインテントを作成してください。既存のインテントは下の一覧で確認できます。
          </p>
        ) : null}
        {children}
      </EmptyContent>
    </Empty>
  );
}

export function AreaError({
  detail,
  onRetry,
}: {
  detail: string;
  onRetry?: () => void;
}): ReactNode {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>読み込みエラー</AlertTitle>
      <AlertDescription>{detail}</AlertDescription>
      {onRetry === undefined ? null : (
        <AlertAction>
          <Button type="button" variant="outline" size="sm" onClick={onRetry} data-testid="retry">
            再試行
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
