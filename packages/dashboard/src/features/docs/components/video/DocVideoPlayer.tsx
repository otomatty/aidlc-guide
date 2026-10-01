import {
  AudioClock,
  loadVideo,
  parseStoryboard,
  parseTimeline,
  Playback,
  Player,
  Stage,
} from "@aidlc-guide/kamishibai";
import { type ReactNode, useEffect, useRef, useState } from "react";

export interface DocVideoPlayerProps {
  storyboard: unknown;
  timeline: unknown;
  narrationUrl: string;
  /** Start playing once mounted — only ever set from the user's own click. */
  autoStart: boolean;
}

/**
 * The Kamishibai player for one doc video. Lives in its own chunk (loaded on
 * the first click) so the docs page does not pay for the renderer. The
 * narration `<audio>` is the clock: the picture is redrawn at its current time.
 */
export function DocVideoPlayer({
  storyboard,
  timeline,
  narrationUrl,
  autoStart,
}: DocVideoPlayerProps): ReactNode {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (mount === null) return;
    const sb = parseStoryboard(storyboard);
    const tl = parseTimeline(timeline);
    if (!sb.ok || !tl.ok) {
      setProblem(
        `動画データを読み込めませんでした（${sb.ok ? "" : sb.error}${!sb.ok && !tl.ok ? "、" : ""}${tl.ok ? "" : tl.error}）。`,
      );
      return;
    }
    let stage: Stage;
    try {
      stage = new Stage(mount.ownerDocument.createElement("canvas"));
    } catch {
      setProblem("この環境では動画を描画できません。");
      return;
    }
    const loaded = loadVideo(stage, sb.value, tl.value);
    if (!loaded.ok) {
      setProblem(`動画データを読み込めませんでした（${loaded.error}）。`);
      return;
    }
    const audio = mount.ownerDocument.createElement("audio");
    audio.preload = "auto";
    audio.src = narrationUrl;
    const onAudioError = () =>
      setProblem(
        "音声を読み込めませんでした。動画パックを入れ直すか、拡張機能を更新してください。",
      );
    audio.addEventListener("error", onAudioError);
    const playback = new Playback(stage, new AudioClock(audio));
    const offError = playback.on("error", () =>
      setProblem("音声を再生できませんでした。もう一度再生ボタンを押してください。"),
    );
    const player = new Player(playback, mount);
    void stage.loadFonts();
    if (autoStart) void playback.play();
    return () => {
      offError();
      player.destroy();
      playback.dispose();
      audio.removeEventListener("error", onAudioError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [storyboard, timeline, narrationUrl, autoStart]);

  return (
    <div data-testid="doc-video-player">
      <div ref={mountRef} />
      {problem === null ? null : (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}
