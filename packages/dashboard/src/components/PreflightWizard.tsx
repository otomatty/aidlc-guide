import { PREFLIGHT_TEXT_MAX, type PreflightPayload } from "@aidlc-guide/shared-types";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTransport } from "../services/transport/types.ts";
import { vsCodeApi } from "../services/vscode-api.ts";

const DEBOUNCE_MS = 400;

const DEGRADED_ERRORS = new Set(["detect-failed", "framework-not-found", "bun-not-found"]);

/**
 * インテント未作成時の開始ウィザード(spec 2026-08-20 §4)。読み取り専用 —
 * 書き込みはゼロで、開始は拡張ホストへの `start-workflow` ハンドオフのみ。
 * 表示ゲート(webview のみ)は NowStrip 側が持つ。
 */
export function PreflightWizard({
  hint,
  children,
}: {
  hint: string;
  children?: ReactNode;
}): ReactNode {
  const [text, setText] = useState("");
  const [data, setData] = useState<PreflightPayload | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 静的部分(scan/scopes/cli)は初回応答を保持し、以降は
  // inference/plan だけ差し替える(spec §4「1 回取得して保持」)。
  const staticPart = useRef<Pick<PreflightPayload, "scan" | "scopes" | "cli"> | null>(null);
  // 直列化しない fetch の到着順ズレ(古いテキストの応答が新しい応答より後に
  // 届く)を無視するための連番。setData 直前に「今なお最新の要求か」を確認する。
  const seq = useRef(0);

  const fetchPreflight = async (query: string) => {
    const requestId = ++seq.current;
    const result = await getTransport().getJson(
      query === "" ? "/api/preflight" : `/api/preflight?text=${encodeURIComponent(query)}`,
    );
    if (requestId !== seq.current) return;
    if (!result.reached) return;
    const body = result.body as PreflightPayload;
    if (staticPart.current === null && body.scan !== null) {
      staticPart.current = { scan: body.scan, scopes: body.scopes, cli: body.cli };
    }
    setData(staticPart.current === null ? body : { ...body, ...staticPart.current });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  useEffect(() => {
    void fetchPreflight("");
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const onChange = (value: string) => {
    setText(value);
    if (timer.current !== null) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed === "") return;
    timer.current = setTimeout(() => void fetchPreflight(trimmed), DEBOUNCE_MS);
  };

  const start = () => {
    vsCodeApi()?.postMessage({ type: "start-workflow", text });
  };

  const scan = data?.scan ?? null;
  const scopes = data?.scopes ?? [];
  const inference = data?.inference ?? null;
  const plan = data?.plan ?? null;
  const degraded = (data?.errors ?? []).some((code) => DEGRADED_ERRORS.has(code));
  const claudeMissing = data?.cli.claude === false;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm" htmlFor="preflight-text">
        作りたいこと・直したいことを書いてください
        <textarea
          id="preflight-text"
          data-testid="preflight-text"
          className="min-h-24 w-full rounded-lg border bg-background p-2 text-sm"
          maxLength={PREFLIGHT_TEXT_MAX}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>

      {degraded ? (
        <div data-testid="preflight-degraded" className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            環境情報を取得できませんでした。AIDLC Guide: Setup で状態を確認してください。
          </p>
          {scopes.length === 0 ? null : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {scopes.map((scope) => (
                <li key={scope.name}>
                  {scope.name} — {scope.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {scan === null ? null : (
            <p className="text-muted-foreground text-sm">
              {scan.projectType} / {scan.languages} / {scan.buildSystem}
            </p>
          )}

          {inference === null || plan === null ? null : (
            <div data-testid="preflight-readout" className="flex flex-col gap-2">
              <p data-testid="preflight-scope" className="text-sm">
                推定スコープ: {inference.scope}(
                {inference.source === "keyword" ? inference.matches[0]?.keyword : "既定"})
              </p>
              <p data-testid="preflight-gates" className="text-sm">
                承認ゲート {plan.gateCount} 回 / {plan.executeCount} / {plan.totalCount} ステージ /{" "}
                {plan.depth} / {plan.skeleton}
              </p>
              <details>
                <summary className="cursor-pointer text-sm">フェーズ別ステージ一覧</summary>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                  {plan.phases.flatMap((phase) =>
                    phase.stages.map((stage) => (
                      <li key={stage.slug} className="flex flex-wrap items-center gap-2">
                        <span>
                          {stage.number} {stage.name}
                        </span>
                        <Badge variant={stage.decision === "EXECUTE" ? "default" : "outline"}>
                          {stage.decision}
                        </Badge>
                        <span className="text-muted-foreground">{stage.leadAgent}</span>
                        <span className="text-muted-foreground">{stage.produces.join(", ")}</span>
                      </li>
                    )),
                  )}
                </ul>
              </details>
            </div>
          )}
        </>
      )}

      <p className="text-muted-foreground text-xs">
        これは見通しです。実際のプランは composer が提案し、approve / edit / reject
        ゲートであなたが確定します。
      </p>

      <Button
        type="button"
        data-testid="preflight-start"
        disabled={text.trim() === ""}
        onClick={start}
      >
        {claudeMissing ? "コマンドをコピー" : "開始"}
      </Button>

      <p className="text-muted-foreground text-sm">{hint}</p>
      {children}
    </div>
  );
}
