import { ArrowLeftIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { inVsCodeWebview, vsCodeApi } from "../services/vscode-api.ts";
import { useDispatch } from "../store/context.tsx";

/** IDEでのインストールと更新を開く設定ページ。 */
export function SettingsPage(): ReactNode {
  const inIde = inVsCodeWebview();
  const dispatch = useDispatch();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const returnHome = (): void => {
    dispatch({ type: "home" });
    document.getElementById("header-menu-trigger")?.focus();
  };

  return (
    <main
      className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-6 p-4 [overflow-wrap:anywhere]"
      aria-labelledby="settings-heading"
      data-testid="settings-page"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="settings-heading" className="text-xl font-medium" ref={heading} tabIndex={-1}>
          設定
        </h1>
        <Button type="button" variant="outline" onClick={returnHome} data-testid="settings-back">
          <ArrowLeftIcon data-icon="inline-start" />
          ステージ一覧に戻る
        </Button>
      </div>
      <p className="text-muted-foreground">
        aidlc-workflowsのインストールとAIDLC Guideの更新を管理します。
      </p>
      <section aria-labelledby="settings-workflows-install-title">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="settings-workflows-install-title">aidlc-workflowsのインストール</h2>
            </CardTitle>
            <CardDescription>
              {inIde
                ? "使うツールを複数選んで一括設定できます。設定済みのプロジェクトにも、別のツールを追加できます。"
                : "インストールはVS Code / Cursorの拡張機能で行います。IDEで対象のプロジェクトを開き、AIDLC Guideの設定からインストールしてください。"}
            </CardDescription>
          </CardHeader>
          {inIde ? (
            <CardFooter>
              <Button
                type="button"
                onClick={() => {
                  vsCodeApi()?.postMessage({ type: "open-workflows-install" });
                }}
              >
                インストール画面を開く
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      </section>
      <section aria-labelledby="settings-update-title">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="settings-update-title">AIDLC Guideの更新</h2>
            </CardTitle>
            <CardDescription>
              {inIde
                ? "最新版を確認し、更新がある場合はインストールへ進めます。確認結果と更新状況はIDEの通知に表示されます。"
                : "更新はVS Code / Cursorの拡張機能で行います。IDEでAIDLC Guideを開き、設定から更新してください。"}
            </CardDescription>
          </CardHeader>
          {inIde ? (
            <CardFooter>
              <Button
                type="button"
                data-testid="check-update"
                onClick={() => {
                  vsCodeApi()?.postMessage({ type: "check-update" });
                }}
              >
                更新を確認
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
