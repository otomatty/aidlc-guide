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

/** IDEでのインストールと更新を開く設定ダイアログ。 */
export function SettingsButton(): ReactNode {
  const inIde = inVsCodeWebview();

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
        <TooltipContent side="bottom">設定：インストール・更新</TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>
            aidlc-workflowsのインストールとAIDLC Guideの更新を管理します。
          </DialogDescription>
        </DialogHeader>
        <section
          className="flex flex-col items-start gap-3"
          aria-labelledby="settings-workflows-install-title"
        >
          <h3 id="settings-workflows-install-title" className="font-medium">
            aidlc-workflowsのインストール
          </h3>
          <p className="text-muted-foreground">
            {inIde
              ? "Claude CodeやCursorなど、使うツールを複数選んでこのプロジェクトに一括で設定できます。"
              : "インストールはVS Code / Cursorの拡張機能で行います。IDEで対象のプロジェクトを開き、AIDLC Guideの設定からインストールしてください。"}
          </p>
          {inIde ? (
            <Button
              type="button"
              onClick={() => {
                vsCodeApi()?.postMessage({ type: "open-workflows-install" });
              }}
            >
              インストール画面を開く
            </Button>
          ) : null}
        </section>
        <section
          className="flex flex-col items-start gap-3"
          aria-labelledby="settings-update-title"
        >
          <h3 id="settings-update-title" className="font-medium">
            AIDLC Guideの更新
          </h3>
          <p className="text-muted-foreground">
            {inIde
              ? "最新版を確認し、更新がある場合はインストールへ進めます。確認結果と更新状況はIDEの通知に表示されます。"
              : "更新はVS Code / Cursorの拡張機能で行います。IDEでAIDLC Guideを開き、設定から更新してください。"}
          </p>
          {inIde ? (
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
