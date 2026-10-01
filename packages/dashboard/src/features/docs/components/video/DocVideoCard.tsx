import type { DocVideoPayload, OfficialDocsLocale } from "@aidlc-guide/shared-types";
import { PlayIcon } from "lucide-react";
import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFetchView } from "@/hooks/useFetchView.ts";
import { fetchOfficialDocsVideo } from "@/services/api.ts";
import { onVideoPacksChanged } from "@/services/video-packs-inject.ts";
import { inVsCodeWebview } from "@/services/vscode-api.ts";
import { viewValue } from "@/store/state.ts";

const DocVideoPlayer = lazy(() =>
  import("./DocVideoPlayer.tsx").then((m) => ({ default: m.DocVideoPlayer })),
);

/** `m:ss`. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Available = Extract<DocVideoPayload, { status: "available" }>;

function isPayload(value: unknown): value is DocVideoPayload {
  if (typeof value !== "object" || value === null) return false;
  const status = (value as { status?: unknown }).status;
  return status === "none" || status === "available";
}

/** Why an available video cannot play here, or null when it can. */
function blocker(video: Available): string | null {
  if (video.missingTemplates.length > 0) {
    return "この動画を再生するには AIDLC Guide 拡張機能の更新が必要です。";
  }
  if (video.narrationUrl === null)
    return "この画面では動画を再生できません。VS Code の AIDLC Guide で開いてください。";
  return null;
}

export interface DocVideoCardProps {
  locale: OfficialDocsLocale;
  docPath: string;
}

/**
 * The explainer video above an official-docs page. Purely additive: any
 * failure to find or load a video renders nothing, and the page reads as before.
 */
export function DocVideoCard({ locale, docPath }: DocVideoCardProps): ReactNode {
  // Bumped when the host installs or removes a pack, so the open page re-asks.
  const [packsGeneration, setPacksGeneration] = useState(0);
  useEffect(() => onVideoPacksChanged(() => setPacksGeneration((g) => g + 1)), []);
  const view = useFetchView(
    () => fetchOfficialDocsVideo(locale, docPath),
    [locale, docPath, packsGeneration],
  );
  // Keyed by page at the call site, so a different page starts closed.
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const payload = view === null ? null : viewValue(view);
  if (!isPayload(payload)) return null;

  if (payload.status === "none") {
    if (payload.packs > 0 || locale !== "ja" || !inVsCodeWebview()) return null;
    return (
      <p data-testid="doc-video-hint" className="mb-4 text-xs text-muted-foreground">
        解説動画パック（AIDLC Guide Videos）を入れると、ページごとの解説動画を見られます。GitHub
        Releases から VSIX をダウンロードし、「VSIX からインストール」で追加してください。
      </p>
    );
  }

  const reason = blocker(payload);
  return (
    <section
      data-testid="doc-video"
      aria-label="解説動画"
      className="mb-6 rounded-xl border border-border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={reason !== null || audio !== null}
          onClick={() => {
            if (payload.narrationUrl === null) return;
            // Start the narration inside the click itself: a later play() after the
            // player chunk loads may no longer count as a user gesture.
            const element = document.createElement("audio");
            element.preload = "auto";
            element.src = payload.narrationUrl;
            element.play().catch(() => {
              // Refused or not ready: the player shows its own play button.
            });
            setAudio(element);
          }}
        >
          <PlayIcon aria-hidden="true" />
          解説動画 {clock(payload.durationSec)}
        </Button>
        <Badge variant="secondary">音声は AI 生成</Badge>
        {payload.freshness === "stale" ? (
          <Badge variant="outline" data-testid="doc-video-stale">
            ページ更新前の内容
          </Badge>
        ) : null}
      </div>
      {payload.freshness === "stale" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          この動画を作った後にページが更新されています。最新の内容は本文を確認してください。
        </p>
      ) : null}
      {reason === null ? null : (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {reason}
        </p>
      )}
      {audio !== null ? (
        <div className="mt-3">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">プレイヤーを読み込んでいます…</p>
            }
          >
            <DocVideoPlayer
              storyboard={payload.storyboard}
              timeline={payload.timeline}
              audio={audio}
            />
          </Suspense>
        </div>
      ) : null}
    </section>
  );
}
