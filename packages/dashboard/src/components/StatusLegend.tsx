import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHIP_STATUSES, StatusChip } from "./StatusChip.tsx";

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
            <DialogDescription>ステージ状態の凡例</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2" data-testid="legend-list">
            {CHIP_STATUSES.map((status) => (
              <li key={status}>
                <StatusChip status={status} />
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
