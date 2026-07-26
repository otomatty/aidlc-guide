import path from "node:path";
import { type Bridge, CONFIG_FILENAME, createBridge } from "@aidlc-guide/docs-bridge";
import { createReader, type Reader, resolveRecordDir } from "@aidlc-guide/reader-core";
import type { Matrix, ReadResult } from "@aidlc-guide/shared-types";
import type { AnswerContext } from "./handlers/answer-writer.ts";
import type { ReadContext } from "./handlers/read.ts";
import { createHub, type Hub } from "./push.ts";

export interface GuideServiceConfig {
  /** Workspace whose `aidlc/` tree is read. Defaults to process.cwd(). */
  workspaceRoot?: string;
  /** Pin the record instead of resolving the active-intent cursor (tests). */
  recordDir?: string;
  /** `--host` / mob read-only mode. */
  hostMode?: boolean;
  /** Watch debounce; forwarded to reader-core. */
  debounceMs?: number;
}

export interface GuideService {
  reader: Reader;
  bridge: Bridge;
  hub: Hub;
  readContext: ReadContext;
  answerContext: AnswerContext;
  /** Stage 2: background matrix scan + matrix-ready broadcast. */
  startMatrixBackground(): void;
  /** Stage 6: file watch → hub push. Returns unwatch. */
  startWatch(): () => void;
}

export function createGuideService(config: GuideServiceConfig = {}): GuideService {
  const workspaceRoot = config.workspaceRoot ?? process.cwd();
  const reader = createReader(workspaceRoot, {
    ...(config.recordDir === undefined ? {} : { recordDir: config.recordDir }),
  });
  const bridge = createBridge(path.join(workspaceRoot, CONFIG_FILENAME));

  const recordDir = async (): Promise<ReadResult<string>> =>
    config.recordDir === undefined
      ? await resolveRecordDir(workspaceRoot)
      : { ok: true, value: config.recordDir };

  const hub = createHub({ reader, recordDir });
  let matrixCache: ReadResult<Matrix> | null = null;

  const readContext: ReadContext = {
    reader,
    bridge,
    workspaceRoot,
    hostMode: config.hostMode ?? false,
    recordDir,
    matrix: () => matrixCache,
  };

  const answerContext: AnswerContext = {
    hostMode: config.hostMode ?? false,
    recordDir,
  };

  return {
    reader,
    bridge,
    hub,
    readContext,
    answerContext,

    startMatrixBackground() {
      queueMicrotask(() => {
        void reader.getMatrix().then((result) => {
          matrixCache = result;
          if ("ok" in result) hub.broadcast({ type: "matrix-ready", matrix: result.value });
        });
      });
    },

    startWatch() {
      return reader.watch(
        (event) => {
          void hub.handleWatchEvent(event);
        },
        config.debounceMs === undefined ? {} : { debounceMs: config.debounceMs },
      );
    },
  };
}
