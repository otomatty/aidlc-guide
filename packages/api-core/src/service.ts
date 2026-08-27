import path from "node:path";
import { type Bridge, CONFIG_FILENAME, createBridge } from "@aidlc-guide/docs-bridge";
import { createReader, intentsDirOf, type Reader, resolveIntents } from "@aidlc-guide/reader-core";
import type { Matrix, ReadResult } from "@aidlc-guide/shared-types";
import type { AnswerContext } from "./handlers/answer-writer.ts";
import type { ReadContext } from "./handlers/read.ts";
import { createHub, type Hub } from "./push.ts";
import { electSelected } from "./select.ts";

export interface GuideServiceConfig {
  /** Workspace whose `aidlc/` tree is read. Defaults to process.cwd(). */
  workspaceRoot?: string;
  /**
   * Root for bundled official docs (`docs/guide|reference` + manifest).
   * Defaults to {@link workspaceRoot}. Pass the extension media snapshot when
   * hosting inside a packaged VSIX.
   */
  officialDocsRoot?: string;
  /** Pin the record instead of resolving the view pin (tests). */
  recordDir?: string;
  /** `--host` / mob read-only mode. */
  hostMode?: boolean;
  /** Watch debounce; forwarded to reader-core. */
  debounceMs?: number;
  /** Restored view-pin slug (VS Code workspaceState). */
  initialSelected?: string | null;
  /** Persist the pin. Failures must not revert the in-memory pin. */
  onSelect?: (slug: string | null) => void;
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
  const officialDocsRoot = config.officialDocsRoot ?? workspaceRoot;
  let pin: string | null = config.initialSelected ?? null;

  const persist = (next: string | null): void => {
    try {
      config.onSelect?.(next);
    } catch {
      // Persist is best-effort; the in-memory pin stays.
    }
  };

  const recordDirFromPin = async (): Promise<ReadResult<string>> => {
    if (config.recordDir !== undefined) return { ok: true, value: config.recordDir };
    const intents = await resolveIntents(workspaceRoot);
    if (!("ok" in intents)) return intents;
    const next = electSelected(intents.value.all, pin);
    if (next !== pin) {
      pin = next;
      persist(pin);
    }
    if (next === null) {
      return {
        error: true,
        reason: intents.value.all.length === 0 ? "no-active-intent" : "no-selected-intent",
      };
    }
    return {
      ok: true,
      value: path.join(intentsDirOf(workspaceRoot, intents.value.space), next),
    };
  };

  const reader = createReader(workspaceRoot, {
    recordDir: config.recordDir ?? recordDirFromPin,
  });
  const bridge = createBridge(path.join(workspaceRoot, CONFIG_FILENAME));

  const hub = createHub({ reader, recordDir: recordDirFromPin });
  let matrixCache: ReadResult<Matrix> | null = null;

  const readContext: ReadContext = {
    reader,
    bridge,
    workspaceRoot,
    officialDocsRoot,
    hostMode: config.hostMode ?? false,
    recordDir: recordDirFromPin,
    selected: () => pin,
    matrix: () => matrixCache,
  };

  const answerContext: AnswerContext = {
    hostMode: config.hostMode ?? false,
    recordDir: recordDirFromPin,
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
