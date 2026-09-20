import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** mob-mode M2 / US-11 — visible read-only indicator for --host mode. */
export function ReadOnlyBadge(): ReactNode {
  return (
    <Badge variant="secondary" role="status" data-testid="read-only-badge">
      READ-ONLY · 参加者ビュー
    </Badge>
  );
}
