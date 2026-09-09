import { SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { inVsCodeWebview, vsCodeApi } from "../services/vscode-api.ts";

export function SettingsButton(): ReactNode {
  const canUpdate = inVsCodeWebview();

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={<Button type="button" variant="ghost" size="icon" aria-label="設定" />}
            />
          }
        >
          <SettingsIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">設定：AIDLC Guideの更新</TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>AIDLC Guideの更新を管理します。</DialogDescription>
        </DialogHeader>
        <section
          className="flex flex-col items-start gap-3"
          aria-labelledby="settings-update-title"
        >
          <h3 id="settings-update-title" className="font-medium">
            AIDLC Guideの更新
          </h3>
          <p className="text-muted-foreground">
            {canUpdate
              ? "最新版を確認し、更新がある場合はインストールへ進めます。確認結果と更新状況はIDEの通知に表示されます。"
              : "更新はVS Code / Cursorの拡張機能で行います。IDEでAIDLC Guideを開き、設定から更新してください。"}
          </p>
          {canUpdate ? (
            <Button
              type="button"
              data-testid="check-update"
              onClick={() => {
                vsCodeApi()?.postMessage({ type: "check-update" });
              }}
            >
              更新を確認
            </Button>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
