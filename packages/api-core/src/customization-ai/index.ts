import { createHash, randomUUID } from "node:crypto";
import type {
  CustomizationAiConversation,
  CustomizationAiJob,
  CustomizationAiRequest,
  CustomizationCatalog,
  CustomizationDraft,
  CustomizationProposal,
  CustomizationProposalInput,
  CustomizationResult,
  DocsQaToolStatus,
} from "@aidlc-guide/shared-types";
import { processIdentity, stopOwnedProcess } from "../ai-cli/identity";
import { cliArguments, probeTool, publicError, runCli } from "../ai-cli/process";
import { createScratch } from "../ai-cli/scratch";
import { record } from "../ai-cli/validation";
import { CustomizationError } from "../customization/model";
import { CustomizationStorage } from "../customization/storage";
import {
  buildCustomizationPrompt,
  parseCustomizationProposal,
  parseCustomizationRequest,
} from "./prompt";

export interface CustomizationAiContext {
  draft: CustomizationDraft;
  catalog: CustomizationCatalog;
  materials?: Array<{ id: string; title: string; hash: string; content: string }>;
  references?: Array<{ title: string; hash: string; content: string }>;
}

export interface CustomizationAiService {
  tools(recheck?: boolean): Promise<CustomizationResult<DocsQaToolStatus[]>>;
  start(body: unknown): Promise<CustomizationResult<CustomizationAiJob>>;
  get(id: string): Promise<CustomizationResult<CustomizationAiJob>>;
  cancel(id: string): Promise<CustomizationResult<CustomizationAiJob>>;
  conversation(draftId: string): Promise<CustomizationResult<CustomizationAiConversation>>;
  request(id: string): Promise<CustomizationResult<CustomizationAiJob> | null>;
  dispose(): void;
}

export interface CustomizationAiDependencies {
  probe: typeof probeTool;
  run: typeof runCli;
  scratch: typeof createScratch;
  identity: typeof processIdentity;
  stop: typeof stopOwnedProcess;
  now(): number;
  timeoutMs: number;
}

interface StoredJob {
  job: CustomizationAiJob;
  inputHash: string;
  ownerToken: string;
  ownerPid: number;
  ownerIdentity: string;
  spawnStarted?: boolean;
  child?: { pid: number; identity: string };
  stopRequested: boolean;
}

interface JobIndex {
  schemaVersion: 1;
  jobs: StoredJob[];
}
const INDEX = "jobs/index.json";
const RETAIN_MS = 7 * 24 * 60 * 60_000;
const active = (job: CustomizationAiJob) => ["reserved", "running", "stopping"].includes(job.phase);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ok = <T>(value: T): CustomizationResult<T> => ({ ok: true, value: structuredClone(value) });
const failure = <T>(
  reason: string,
  message = "処理を完了できませんでした。保存した内容は保持されています。",
): CustomizationResult<T> => ({ error: true, reason, message });

/** The service can publish proposals but never receives a draft or configuration writer. */
export function createCustomizationAiService(config: {
  workspaceRoot: string;
  hostMode: boolean;
  trusted?: () => boolean;
  context(request: CustomizationAiRequest): Promise<CustomizationAiContext>;
  propose(
    input: CustomizationProposalInput,
    draftId: string,
    revision: number,
    contextHash: string,
  ): Promise<CustomizationProposal>;
  dependencies?: Partial<CustomizationAiDependencies>;
}): CustomizationAiService {
  const deps: CustomizationAiDependencies = {
    probe: probeTool,
    run: runCli,
    scratch: createScratch,
    identity: processIdentity,
    stop: stopOwnedProcess,
    now: Date.now,
    timeoutMs: 120_000,
    ...config.dependencies,
  };
  const storage = new CustomizationStorage(config.workspaceRoot);
  const ownerToken = randomUUID();
  const controllers = new Map<string, AbortController>();
  // Only settled executions enter this set; their CLI children have already closed.
  const failedExecutions = new Set<string>();
  let disposed = false;
  let cachedTools: { at: number; value: Awaited<ReturnType<typeof probeTool>>[] } | undefined;
  let probing: Promise<Awaited<ReturnType<typeof probeTool>>[]> | undefined;
  const permitted = () => !disposed && !config.hostMode && (config.trusted?.() ?? true);
  const denied = () =>
    failure<never>(
      disposed ? "disposed" : config.hostMode ? "read-only-mode" : "workspace-untrusted",
      "AIへの依頼は信頼されたローカルのプロジェクトで利用できます。",
    );

  async function readIndex(): Promise<JobIndex> {
    const value = await storage.readJson<JobIndex>(INDEX);
    if (value === null) return { schemaVersion: 1, jobs: [] };
    if (
      value.schemaVersion !== 1 ||
      !Array.isArray(value.jobs) ||
      value.jobs.some((entry) => !record(entry.job) || typeof entry.ownerToken !== "string")
    )
      throw new Error("recovery-required");
    return value;
  }
  async function mutate<T>(action: (index: JobIndex) => Promise<T>): Promise<T> {
    return storage.withLock("ai-jobs", async () => {
      const index = await readIndex();
      const result = await action(index);
      await storage.writeJson(INDEX, index);
      for (const entry of index.jobs) if (!active(entry.job)) failedExecutions.delete(entry.job.id);
      return result;
    });
  }
  async function capabilities(recheck = false) {
    if (recheck) cachedTools = undefined;
    if (cachedTools && deps.now() - cachedTools.at < 30_000) return cachedTools.value;
    probing ??= Promise.all([deps.probe("claude"), deps.probe("cursor"), deps.probe("copilot")])
      .then((value) => {
        cachedTools = { at: deps.now(), value };
        return value;
      })
      .finally(() => {
        probing = undefined;
      });
    return probing;
  }
  async function recover(index: JobIndex): Promise<void> {
    for (const entry of index.jobs) {
      if (!active(entry.job)) continue;
      if (entry.ownerToken === ownerToken) {
        if (!failedExecutions.has(entry.job.id)) continue;
      } else {
        const owner = await deps.identity(entry.ownerPid);
        if (owner === entry.ownerIdentity) continue;
        if (entry.child) {
          if (!(await deps.stop(entry.child.pid, entry.child.identity)))
            throw new Error("recovery-required");
        } else if (entry.spawnStarted) {
          // A crash between spawn and identity persistence cannot prove the child stopped.
          throw new Error("recovery-required");
        }
      }
      entry.job.phase = "interrupted";
      entry.job.error = "前回のAI処理が中断しました。入力を確認して再度依頼できます。";
      entry.job.updatedAt = new Date(deps.now()).toISOString();
    }
  }
  async function snapshot(): Promise<JobIndex> {
    const current = await readIndex();
    if (
      !failedExecutions.size &&
      !current.jobs.some((entry) => active(entry.job) && entry.ownerToken !== ownerToken)
    )
      return current;
    // Re-read under the lock: another owner may have completed since the snapshot.
    return mutate(async (index) => {
      await recover(index);
      return index;
    });
  }
  async function update(id: string, action: (entry: StoredJob) => Promise<void> | void) {
    return mutate(async (index) => {
      const entry = index.jobs.find((value) => value.job.id === id);
      if (!entry || entry.ownerToken !== ownerToken || !active(entry.job)) return false;
      await action(entry);
      entry.job.updatedAt = new Date(deps.now()).toISOString();
      return true;
    });
  }
  async function execute(
    stored: StoredJob,
    context: CustomizationAiContext,
    request: CustomizationAiRequest,
  ) {
    const id = stored.job.id;
    const abort = new AbortController();
    controllers.set(id, abort);
    let scratch: Awaited<ReturnType<typeof createScratch>> | undefined;
    let timeout = false;
    let output: CustomizationProposalInput | undefined;
    let reportedError: string | undefined;
    let controlling = false;
    const deadline = setTimeout(() => {
      timeout = true;
      abort.abort();
    }, deps.timeoutMs);
    deadline.unref?.();
    const control = setInterval(() => {
      if (controlling) return;
      controlling = true;
      void storage
        .withLock("ai-jobs", async () => {
          const entry = (await readIndex()).jobs.find((value) => value.job.id === id);
          if (!permitted() || !entry || entry.ownerToken !== ownerToken || entry.stopRequested)
            abort.abort();
        })
        .catch(() => abort.abort())
        .finally(() => {
          controlling = false;
        });
    }, 500);
    control.unref?.();
    try {
      const capability = (await capabilities()).find((value) => value.tool === request.tool);
      if (!capability?.available || !capability.command) throw new Error("cli-unavailable");
      if (abort.signal.aborted) throw new Error("cancelled");
      scratch = await deps.scratch(request.tool);
      const history = (await readIndex()).jobs
        .filter((entry) => entry.job.draftId === request.draftId && entry.job.phase === "completed")
        .slice(-8)
        .map((entry) => ({ message: entry.job.message, answer: entry.job.answer }));
      const prompt = buildCustomizationPrompt(request, context, history);
      const mayStart = await update(id, (entry) => {
        if (entry.stopRequested || !permitted()) {
          abort.abort();
          return;
        }
        entry.spawnStarted = true;
        entry.job.contextTruncated = prompt.truncated;
      });
      if (!mayStart || abort.signal.aborted) throw new Error("cancelled");
      const text = await deps.run({
        command: capability.command,
        args: cliArguments(request.tool),
        tool: request.tool,
        cwd: scratch.cwd,
        env: scratch.env,
        prompt: prompt.text,
        signal: abort.signal,
        onText: () => {},
        async onSpawn(pid) {
          const identity = await deps.identity(pid);
          if (!identity) throw new Error("process-registration-failed");
          const owned = await update(id, (entry) => {
            entry.child = { pid, identity };
            if (entry.stopRequested || !permitted()) abort.abort();
            entry.job.phase = entry.stopRequested ? "stopping" : "running";
          });
          if (!owned) throw new Error("owner-changed");
        },
      });
      if (!abort.signal.aborted) output = parseCustomizationProposal(text, context);
    } catch (error) {
      reportedError =
        error instanceof Error && error.message === "invalid-proposal"
          ? "変更案の形式を確認できませんでした。依頼する項目を絞って再試行できます。"
          : publicError(error, request.tool);
    } finally {
      clearTimeout(deadline);
      clearInterval(control);
      await scratch?.cleanup().catch(() => {});
    }
    // runCli settles only after its child closes. A cancellation cannot free the slot earlier.
    await update(id, async (entry) => {
      if (entry.stopRequested || !permitted() || abort.signal.aborted) {
        entry.job.phase = timeout ? "error" : "cancelled";
        if (timeout)
          entry.job.error = "AIの生成が時間内に終わりませんでした。範囲を絞って再試行できます。";
        return;
      }
      if (!output) {
        entry.job.phase = "error";
        entry.job.error = reportedError ?? "変更案を取得できませんでした。";
        return;
      }
      try {
        if (output.changes.length)
          entry.job.proposal = await config.propose(
            output,
            request.draftId,
            request.expectedDraftRevision,
            hash(context),
          );
        entry.job.answer = output.summary;
        entry.job.phase = "completed";
      } catch {
        entry.job.phase = "error";
        entry.job.error = "生成中に下書きが変わりました。最新の下書きで再度依頼してください。";
      }
    });
  }
  const safely = async <T>(
    action: () => Promise<CustomizationResult<T>>,
  ): Promise<CustomizationResult<T>> => {
    if (!permitted()) return denied();
    try {
      return await action();
    } catch (error) {
      const known = new Set(["recovery-required", "ai-busy", "ai-history-limit"]);
      const reason =
        error instanceof CustomizationError
          ? error.code
          : error instanceof Error && known.has(error.message)
            ? error.message
            : "ai-failed";
      return failure(reason);
    }
  };

  return {
    tools: (recheck) =>
      safely(async () =>
        ok(
          (await capabilities(recheck)).map(({ tool, label, available, detail }) => ({
            tool,
            label,
            available,
            ...(detail ? { detail } : {}),
          })),
        ),
      ),
    start: (body) =>
      safely(async () => {
        const request = parseCustomizationRequest(body);
        if (!request) return failure("bad-request", "依頼内容と下書きの状態を確認してください。");
        if (
          deps.now() - Number(request.requestId.split("-")[0]) > RETAIN_MS ||
          Number(request.requestId.split("-")[0]) > deps.now() + 60_000
        )
          return failure(
            "request-expired",
            "以前の受付IDは期限を過ぎています。現在の状態を確認してください。",
          );
        const inputHash = hash(request);
        const existing = (await snapshot()).jobs.find(
          (entry) => entry.job.requestId === request.requestId,
        );
        if (existing)
          return existing.inputHash === inputHash ? ok(existing.job) : failure("request-conflict");
        const context = await config.context(request);
        if (
          context.draft.id !== request.draftId ||
          context.draft.revision !== request.expectedDraftRevision ||
          context.draft.baseConfigurationRevision !== context.catalog.configurationRevision
        )
          return failure(
            "draft-conflict",
            "下書きまたは設定が変わりました。最新の内容を確認してください。",
          );
        const identity = await deps.identity(process.pid);
        if (!identity) return failure("process-identity-unavailable");
        const result = await mutate(async (index) => {
          await recover(index);
          const duplicate = index.jobs.find((entry) => entry.job.requestId === request.requestId);
          if (duplicate) return { entry: duplicate, fresh: false };
          if (index.jobs.some((entry) => active(entry.job))) throw new Error("ai-busy");
          index.jobs = index.jobs.filter(
            (entry) => deps.now() - Date.parse(entry.job.updatedAt) <= RETAIN_MS,
          );
          if (index.jobs.length >= 1000) throw new Error("ai-history-limit");
          const now = new Date(deps.now()).toISOString();
          const entry: StoredJob = {
            inputHash,
            ownerToken,
            ownerPid: process.pid,
            ownerIdentity: identity,
            stopRequested: false,
            job: {
              id: randomUUID(),
              requestId: request.requestId,
              draftId: request.draftId,
              draftRevision: request.expectedDraftRevision,
              configurationRevision: context.catalog.configurationRevision,
              tool: request.tool,
              message: request.message,
              phase: "reserved",
              answer: "",
              createdAt: now,
              updatedAt: now,
            },
          };
          index.jobs.push(entry);
          return { entry, fresh: true };
        });
        if (result.entry.inputHash !== inputHash) return failure("request-conflict");
        if (result.fresh)
          void execute(result.entry, context, request)
            .catch(() => {
              failedExecutions.add(result.entry.job.id);
            })
            .finally(() => {
              controllers.delete(result.entry.job.id);
            });
        return ok(result.entry.job);
      }),
    get: (id) =>
      safely(async () => {
        const entry = (await snapshot()).jobs.find((value) => value.job.id === id);
        return entry ? ok(entry.job) : failure("not-found");
      }),
    cancel: (id) =>
      safely(async () =>
        mutate(async (index) => {
          await recover(index);
          const entry = index.jobs.find((value) => value.job.id === id);
          if (!entry) return failure("not-found");
          if (active(entry.job)) {
            entry.stopRequested = true;
            entry.job.phase = "stopping";
            controllers.get(id)?.abort();
          }
          return ok(entry.job);
        }),
      ),
    conversation: (draftId) =>
      safely(async () =>
        ok({
          draftId,
          jobs: (await snapshot()).jobs
            .filter((entry) => entry.job.draftId === draftId)
            .slice(-40)
            .map((entry) => entry.job),
        }),
      ),
    async request(id) {
      if (!permitted()) return denied();
      try {
        const entry = (await snapshot()).jobs.find((value) => value.job.requestId === id);
        return entry ? ok(entry.job) : null;
      } catch {
        return failure("recovery-required");
      }
    },
    dispose() {
      disposed = true;
      for (const controller of controllers.values()) controller.abort();
    },
  };
}
