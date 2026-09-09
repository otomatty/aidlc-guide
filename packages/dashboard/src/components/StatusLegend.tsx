import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHIP_STATUSES, type ChipStatus, StatusChip } from "./StatusChip.tsx";

const STATUS_DESCRIPTIONS: Record<ChipStatus, string> = {
  completed: "完了：このステージの作業が完了しています。",
  "in-progress": "進行中：現在、このステージの作業を進めています。",
  "awaiting-approval": "承認待ち：成果物の確認と承認を待っています。",
  revising: "修正中：差し戻しを受けて、内容を見直しています。",
  "not-started": "未着手：まだ作業を開始していません。",
  skipped: "スキップ：このステージを飛ばして進めています。",
  unparseable: "読み取り不可：記録から状態を判定できません。",
};

export function StatusLegend(): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="legend-open"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        凡例
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="legend-dialog">
          <DialogHeader>
            <DialogTitle>凡例</DialogTitle>
            <DialogDescription>
              ステージの状態を、色付きの枠・記号・英語ラベルで表示します。
              色だけでなく、記号とラベルでも状態を見分けられます。
            </DialogDescription>
          </DialogHeader>
          <ul
            className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto"
            data-testid="legend-list"
          >
            {CHIP_STATUSES.map((status) => (
              <li key={status} className="flex flex-col items-start gap-1">
                <StatusChip status={status} />
                <p className="text-muted-foreground">{STATUS_DESCRIPTIONS[status]}</p>
              </li>
            ))}
            <li className="text-muted-foreground">
              <span aria-hidden="true">·</span> 空（成果物 0 件）
            </li>
            <li className="text-muted-foreground">
              <span aria-hidden="true">—</span> 対象外（このユニットに無いステージ）
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
