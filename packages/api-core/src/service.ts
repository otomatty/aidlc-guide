import path from "node:path";
import { type Bridge, CONFIG_FILENAME, createBridge } from "@aidlc-guide/docs-bridge";
import type { InstalledVideoPack } from "@aidlc-guide/official-docs";
import {
  createReader,
  intentsDirOf,
  isSpaceName,
  listSpaces,
  type Reader,
  resolveIntents,
  watchSelection,
} from "@aidlc-guide/reader-core";
import type {
  IntentList,
  Matrix,
  MatrixCell,
  ReadResult,
  VersionGate,
  SpaceCatalog,
  SpaceSelection,
} from "@aidlc-guide/shared-types";
import { createSpaceEngine, type SpaceEngine } from "./spaces/engine.ts";
import type { CustomizationEngine } from "./customization/engine-adapter.ts";
import { type CustomizationService, createCustomizationService } from "./customization/index.ts";
import { createDocsQaService, type DocsQaService } from "./docs-qa/index.ts";
import type { AnswerContext } from "./handlers/answer-writer.ts";
import type { ReadContext, RouteResult } from "./handlers/read.ts";
import { createHub, type Hub } from "./push.ts";
import { electSelected, isIntentDirName } from "./select.ts";
import { createVersionGateCheck } from "./version-gate.ts";

export interface GuideServiceConfig {
  spaceEngine?: SpaceEngine;
  initialSelection?: SpaceSelection;
  onSelection?: (selection: SpaceSelection) => void;
  customizationEngine?: CustomizationEngine;
  canEdit?: () => boolean;
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
  /** Watch debounce; forwarded to reader-core. */
  debounceMs?: number;
  /** Installed doc video packs (VS Code extension host); omitted elsewhere. */
  videoPacks?: () => readonly InstalledVideoPack[];
  /** Restored view-pin slug (VS Code workspaceState). */
  initialSelected?: string | null;
  /** Persist the pin. Failures must not revert the in-memory pin. */
  onSelect?: (slug: string | null) => void;
  /**
   * The version check (docs/maintenance/version-gate-design.md). Omitted, the
   * workspace is checked against the Guide's supported release; only an
   * explicit `null` switches checking off (tests on bare fixtures).
   */
  versionGate?: (() => VersionGate) | null;
}

export interface GuideService {
  switchSpace(body: unknown): Promise<RouteResult>;
  customization?: CustomizationService;
  docsQa?: DocsQaService;
  reader: Reader;
  bridge: Bridge;
  hub: Hub;
  readContext: ReadContext;
  answerContext: AnswerContext;
  /** Stage 2: background matrix scan + matrix-ready broadcast. */
  startMatrixBackground(): void;
  /** Stage 6: file watch → hub push. Returns unwatch. */
  startWatch(): () => void;
  /** Set the view pin. Does not write `active-intent`. */
  selectIntent(name: string): Promise<RouteResult>;
  /** The current version check; null when switched off. */
  versionGate(): VersionGate | null;
  /** Forget the cached check, e.g. after an update or a harness file change. */
  invalidateVersionGate(): void;
}

export function createGuideService(config: GuideServiceConfig = {}): GuideService {
  const workspaceRoot = config.workspaceRoot ?? process.cwd();
  const officialDocsRoot = config.officialDocsRoot ?? workspaceRoot;
  const gateCheck = createVersionGateCheck(workspaceRoot, config.versionGate);
  const pushAllowed = (): boolean => {
    const gate = gateCheck.current();
    return gate === null || gate.status === "ok";
  };
  const docsQa = createDocsQaService({
    docsRoot: officialDocsRoot,
  });
  const customization = createCustomizationService({
    workspaceRoot,
    ...(config.customizationEngine ? { engine: config.customizationEngine } : {}),
    ...(config.canEdit ? { canEdit: config.canEdit } : {}),
    onChange: () => hub.broadcast({ type: "customization-changed" }),
  });
  let pin: string | null = config.initialSelected ?? null;
  let pinSpace: string | null = null;
  const pins = new Map<string, string | null>();
  if (config.initialSelection)
    pins.set(config.initialSelection.space, config.initialSelection.intent);
  else if (config.initialSelected) pins.set("default", config.initialSelected);
  const spaceEngine = config.spaceEngine ?? createSpaceEngine(workspaceRoot);
  let switching = false;

  const persist = (next: string | null): void => {
    try {
      config.onSelect?.(next);
      if (pinSpace !== null) config.onSelection?.({ space: pinSpace, intent: next });
    } catch {
      // Persist is best-effort; the in-memory pin stays.
    }
  };

  const recordDirFromPin = async (): Promise<ReadResult<string>> => {
    if (config.recordDir !== undefined) return { ok: true, value: config.recordDir };
    const intents = await resolveIntents(workspaceRoot);
    if (!("ok" in intents)) return intents;
    const space = intents.value.space;
    const next = electSelected(intents.value.all, pins.get(space) ?? null);
    if (space !== pinSpace || next !== pin) adoptPin(next, space);
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

  let matrixCache: ReadResult<Matrix> | null = null;
  let matrixGeneration = 0;
  // Unit changes can arrive before the startup scan finishes. Overlay both
  // pending invalidations and completed rows on that scan before exposing it.
  const matrixUnitUpdates = new Map<string, readonly MatrixCell[] | null>();

  const withUnitUpdates = (result: ReadResult<Matrix>): ReadResult<Matrix> => {
    if (!("ok" in result) || matrixUnitUpdates.size === 0) return result;
    let cells = result.value.cells;
    const units = new Set(result.value.units);
    for (const [unit, updated] of matrixUnitUpdates) {
      if (updated === null) {
        cells = cells.map((cell) => (cell.unit === unit ? { ...cell, verdict: null } : cell));
      } else {
        cells = [...cells.filter((cell) => cell.unit !== unit), ...updated];
        if (updated.length > 0) units.add(unit);
      }
    }
    return { ...result, value: { ...result.value, units: [...units].sort(), cells } };
  };

  const hub = createHub({
    reader,
    allowPush: pushAllowed,
    recordDir: recordDirFromPin,
    onMatrixInvalidated(units) {
      if (units === undefined) {
        matrixGeneration += 1;
        matrixCache = null;
        matrixUnitUpdates.clear();
      } else {
        for (const unit of units) matrixUnitUpdates.set(unit, null);
        if (matrixCache !== null) matrixCache = withUnitUpdates(matrixCache);
      }
    },
    onMatrix(result) {
      matrixCache = result;
      matrixUnitUpdates.clear();
      // A client can connect while the cache is invalidated. Publish a full
      // model so it can leave its loading state before applying Unit patches.
      if ("ok" in result) hub.broadcast({ type: "matrix-ready", matrix: result.value });
    },
    onMatrixUnits(units, cells) {
      for (const unit of units)
        matrixUnitUpdates.set(
          unit,
          cells.filter((cell) => cell.unit === unit),
        );
      if (matrixCache !== null) matrixCache = withUnitUpdates(matrixCache);
    },
  });

  const readContext: ReadContext = {
    spaces: async (): Promise<ReadResult<SpaceCatalog>> => {
      const spaces = await listSpaces(workspaceRoot);
      if (!("ok" in spaces)) return spaces;
      const canSwitch = config.canEdit?.() !== false;
      const harnesses = canSwitch ? await spaceEngine.harnesses() : [];
      return {
        ok: true,
        value: { ...spaces.value, harnesses, canSwitch: canSwitch && harnesses.length > 0 },
      };
    },
    customization,
    docsQa,
    reader,
    bridge,
    workspaceRoot,
    officialDocsRoot,
    ...(config.videoPacks === undefined ? {} : { videoPacks: config.videoPacks }),
    recordDir: recordDirFromPin,
    selected: () => pin,
    matrix: () => matrixCache,
    versionGate: () => gateCheck.current(),
  };

  const answerContext: AnswerContext = {
    recordDir: recordDirFromPin,
  };

  const watchOptions = config.debounceMs === undefined ? {} : { debounceMs: config.debounceMs };
  let unwatch: (() => void) | null = null;
  let watchGeneration = 0;
  let selectChain: Promise<void> = Promise.resolve();

  function startMatrixBackground(): void {
    const generation = ++matrixGeneration;
    queueMicrotask(() => {
      void reader.getMatrix().then((result) => {
        if (generation !== matrixGeneration) return;
        matrixCache = withUnitUpdates(result);
        if ("ok" in matrixCache) hub.broadcast({ type: "matrix-ready", matrix: matrixCache.value });
      });
    });
  }

  function rebindWatch(): void {
    unwatch?.();
    unwatch = null;
    const generation = ++watchGeneration;
    // reader.watch resolves recordDir() (and elects a lone record) itself.
    // Skipping here when pin is still null would miss that election and
    // leave dashboard-server with no watcher until a later selectIntent.
    unwatch = reader.watch((event) => {
      const gen = generation;
      if (gen !== watchGeneration) return;
      void hub.handleWatchEvent(event, () => gen === watchGeneration);
    }, watchOptions);
  }

  function adoptPin(next: string | null, space: string): void {
    const spaceChanged = pinSpace !== null && space !== pinSpace;
    const changed = next !== pin || spaceChanged;
    pinSpace = space;
    pin = next;
    pins.set(space, next);
    persist(pin);
    if (!changed) return;
    matrixCache = null;
    matrixUnitUpdates.clear();
    if (unwatch !== null) rebindWatch();
    startMatrixBackground();
    hub.broadcast(
      spaceChanged
        ? { type: "space-selected", space, intent: next }
        : { type: "intent-selected", intent: next },
    );
  }

  const listedIntents = async (): Promise<ReadResult<IntentList>> => {
    const intents = await resolveIntents(workspaceRoot);
    if (!("ok" in intents)) return intents;
    return { ok: true, value: { ...intents.value, selected: pin } };
  };

  const runSelect = async (name: string): Promise<RouteResult> => {
    const intents = await resolveIntents(workspaceRoot);
    if (!("ok" in intents)) return { status: 400, body: intents };
    if (!isIntentDirName(name, intents.value.all)) {
      return { status: 400, body: { error: true, reason: "bad-request" } };
    }
    adoptPin(name, intents.value.space);
    const listed = await listedIntents();
    return { status: 200, body: listed };
  };

  const exclusive = async <T>(action: () => Promise<T>): Promise<T> => {
    const previous = selectChain;
    let release = () => {};
    selectChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await action();
    } finally {
      release();
    }
  };
  const failure = (status: number, reason: string, message: string): RouteResult => ({
    status,
    body: { error: true, reason, message },
  });
  const runSwitch = async (body: unknown): Promise<RouteResult> => {
    if (config.canEdit?.() === false)
      return failure(
        403,
        "workspace-untrusted",
        "ワークスペースを信頼してから切り替えてください。",
      );
    if (!body || typeof body !== "object")
      return failure(400, "bad-request", "スペースとツールを選んでください。");
    const { space, expectedSpace, harness } = body as Record<string, unknown>;
    if (
      typeof space !== "string" ||
      !isSpaceName(space) ||
      typeof expectedSpace !== "string" ||
      typeof harness !== "string"
    )
      return failure(400, "bad-request", "スペースとツールを選んでください。");
    const catalog = await readContext.spaces!();
    if (!("ok" in catalog))
      return failure(409, "spaces-unreadable", "スペース一覧を読み直してください。");
    if (
      !catalog.value.spaces.includes(space) ||
      !catalog.value.harnesses.some((item) => item.id === harness)
    )
      return failure(400, "bad-request", "存在するスペースと導入済みのツールを選んでください。");
    if (catalog.value.active !== expectedSpace)
      return failure(
        409,
        "space-conflict",
        "作業スペースが変更されました。一覧を読み直してください。",
      );
    await recordDirFromPin();
    try {
      if (await customization.activeOperation())
        return failure(
          409,
          "customization-busy",
          "カスタマイズの保存・復旧が完了してから切り替えてください。",
        );
      switching = true;
      await spaceEngine.switch(space, harness);
      const after = await listSpaces(workspaceRoot);
      if (!("ok" in after) || after.value.active !== space)
        return failure(
          409,
          "space-switch-unconfirmed",
          "切り替え結果を確認できません。一覧を読み直してください。",
        );
      await recordDirFromPin();
      return { status: 200, body: await listedIntents() };
    } catch (error) {
      return failure(
        409,
        "space-switch-failed",
        error instanceof Error ? error.message : "スペースを切り替えられませんでした。",
      );
    } finally {
      switching = false;
      // A failed utility may already have moved the shared cursor.
      await recordDirFromPin();
    }
  };

  return {
    customization,
    docsQa,
    reader,
    bridge,
    hub,
    readContext,
    answerContext,
    startMatrixBackground,
    versionGate: () => gateCheck.current(),
    invalidateVersionGate: () => gateCheck.invalidate(),
    startWatch() {
      rebindWatch();
      const stopSelection =
        config.recordDir === undefined
          ? watchSelection(
              workspaceRoot,
              () => {
                if (switching) return;
                void exclusive(async () => {
                  await recordDirFromPin();
                }).catch(() =>
                  hub.broadcast({
                    type: "live-status",
                    degraded: true,
                    reason: "selection-unreadable",
                  }),
                );
              },
              () => hub.broadcast({ type: "live-status", degraded: true, reason: "watcher-lost" }),
            )
          : () => {};
      return () => {
        stopSelection();
        watchGeneration += 1;
        unwatch?.();
        unwatch = null;
      };
    },
    selectIntent: (name) => exclusive(() => runSelect(name)),
    switchSpace: (body) => exclusive(() => runSwitch(body)),
  };
}
