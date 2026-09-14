import { WORKFLOWS_TARGET_VERSION, type WorkflowsManagementState } from "@aidlc-guide/shared-types";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { inVsCodeWebview, vsCodeApi } from "../services/vscode-api.ts";

/** IDEでのインストールと更新を開く設定ページ。 */
export function SettingsPage(): ReactNode {
  const inIde = inVsCodeWebview();
  const heading = useRef<HTMLHeadingElement>(null);
  const [workflows, setWorkflows] = useState<WorkflowsManagementState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inIde) return;
    const receive = ({ data }: MessageEvent) => {
      if (data?.type === "workflows-management" && Array.isArray(data.state?.tools)) {
        setWorkflows(data.state);
        setError(null);
      }
      if (data?.type === "workflows-management-error" && typeof data.message === "string")
        setError(data.message);
    };
    window.addEventListener("message", receive);
    const refresh = () => vsCodeApi()?.postMessage({ type: "get-workflows-management" });
    window.addEventListener("focus", refresh);
    refresh();
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("focus", refresh);
    };
  }, [inIde]);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main
      className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-6 p-4 [overflow-wrap:anywhere]"
      aria-labelledby="settings-heading"
      data-testid="settings-page"
    >
      <h1 id="settings-heading" className="text-xl font-medium" ref={heading} tabIndex={-1}>
        設定
      </h1>
      <section aria-labelledby="settings-workflows-install-title">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="settings-workflows-install-title">aidlc-workflows</h2>
            </CardTitle>
            <CardDescription>
              {inIde
                ? "使うツールを複数選んで一括設定できます。設定済みのプロジェクトにも、別のツールを追加できます。"
                : "インストールはVS Code / Cursorの拡張機能で行います。IDEで対象のプロジェクトを開き、AIDLC Guideの設定からインストールしてください。"}
            </CardDescription>
          </CardHeader>
          {inIde ? (
            <CardContent className="flex flex-col gap-3">
              <p>導入バージョン：{workflows?.target ?? WORKFLOWS_TARGET_VERSION}</p>
              {workflows ? (
                <>
                  <p className="break-all">対象プロジェクト：{workflows.root}</p>
                  <ul aria-label="設定済みツール">
                    {workflows.tools.map((tool) => (
                      <li key={tool.id}>
                        {tool.label}：{tool.version ?? "確認が必要"}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p role="status">{error ?? workflows?.message ?? "設定状態を確認しています…"}</p>
              <p>更新は、このプロジェクトに設定済みのすべてのツールを対象に行います。</p>
            </CardContent>
          ) : null}
          {inIde ? (
            <CardFooter className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  vsCodeApi()?.postMessage({ type: "open-workflows-install" });
                }}
              >
                インストール・ツール追加
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => vsCodeApi()?.postMessage({ type: "open-workflows-update" })}
              >
                更新画面を開く
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => vsCodeApi()?.postMessage({ type: "get-workflows-management" })}
              >
                状態を再確認
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
