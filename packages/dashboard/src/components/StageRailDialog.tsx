import type { WorkflowModel } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ViewState } from "../store/state.ts";
import { StageRail } from "./StageRail.tsx";

export interface StageRailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: ViewState<WorkflowModel>;
  purposes?: Readonly<Record<string, string>>;
  markedSlug: string;
  onSelect: (slug: string) => void;
  onRetry: () => void;
}

export function StageRailDialog({
  open,
  onOpenChange,
  workflow,
  purposes,
  markedSlug,
  onSelect,
  onRetry,
}: StageRailDialogProps): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="stage-rail-dialog"
        className="sm:max-w-md max-h-[min(80dvh,40rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>ステージ一覧</DialogTitle>
          <DialogDescription>ステージを選ぶと詳細パネルが切り替わります</DialogDescription>
        </DialogHeader>
        <StageRail
          state={workflow}
          purposes={purposes}
          markedSlug={markedSlug}
          onRetry={onRetry}
          onSelect={(next) => {
            onSelect(next);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
