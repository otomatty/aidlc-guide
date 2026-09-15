import type {
  CustomizationAiJob,
  CustomizationAiMaterial,
  CustomizationAiRequest,
  CustomizationDraft,
  DocsQaTool,
  DocsQaToolStatus,
} from "@aidlc-guide/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CustomizationError,
  customizationApi,
  customizationRequestId,
} from "../../services/customization";

export const aiRunning = (job: CustomizationAiJob) =>
  ["reserved", "running", "stopping"].includes(job.phase);

export function useCustomizationAi(
  draft: CustomizationDraft | null,
  open: boolean,
  readOnly: boolean,
  flush: () => Promise<CustomizationDraft>,
) {
  const [message, setMessage] = useState("");
  const [tool, setTool] = useState<DocsQaTool>("claude");
  const [tools, setTools] = useState<DocsQaToolStatus[]>([]);
  const [jobs, setJobs] = useState<CustomizationAiJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [materials, setMaterials] = useState<CustomizationAiMaterial[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const pending = useRef<CustomizationAiRequest | null>(null);
  const locked = useRef(false);
  const cancellation = useRef(false);
  const currentDraft = useRef(draft?.id);
  currentDraft.current = draft?.id;
  const active = jobs.find(aiRunning);
  const activeId = active?.id;
  const receive = useCallback((job: CustomizationAiJob) => {
    if (currentDraft.current && job.draftId !== currentDraft.current) return;
    setJobs((old) =>
      old.some((value) => value.id === job.id)
        ? old.map((value) => (value.id === job.id ? job : value))
        : [...old, job],
    );
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a user refresh intentionally rechecks availability.
  useEffect(() => {
    if (!open || readOnly) return;
    let valid = true;
    void customizationApi
      .tools()
      .then((value) => {
        if (valid) setTools(value);
      })
      .catch((error) => {
        if (valid) setError(error instanceof Error ? error.message : "AIツールを確認できません。");
      });
    void customizationApi
      .materials()
      .then((value) => {
        if (valid) setMaterials(value);
      })
      .catch(() => {});
    return () => {
      valid = false;
    };
  }, [open, readOnly, refreshVersion]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh also restores a conversation after a temporary connection failure.
  useEffect(() => {
    if (!draft?.id || readOnly) {
      setJobs([]);
      return;
    }
    let valid = true;
    void customizationApi
      .conversation(draft.id)
      .then((value) => {
        if (valid)
          setJobs((current) => {
            const merged = new Map(value.jobs.map((job) => [job.id, job]));
            for (const job of current)
              if (
                job.draftId === draft.id &&
                (!merged.has(job.id) || (merged.get(job.id)?.updatedAt ?? "") < job.updatedAt)
              )
                merged.set(job.id, job);
            return [...merged.values()];
          });
      })
      .catch((error) => {
        if (valid) setError(error instanceof Error ? error.message : "会話を復元できません。");
      });
    return () => {
      valid = false;
    };
  }, [draft?.id, readOnly, refreshVersion]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit refresh restarts polling after a connection error.
  useEffect(() => {
    if (!activeId || readOnly) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await customizationApi.job(activeId);
        if (!live) return;
        receive(next);
        if (aiRunning(next)) timer = setTimeout(() => void poll(), 500);
      } catch (error) {
        if (live)
          setError(
            error instanceof Error
              ? error.message
              : "生成状況を確認できません。再確認してください。",
          );
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [activeId, readOnly, receive, refreshVersion]);
  async function send(itemIds: string[] = []) {
    if (locked.current || active || readOnly || (!pending.current && !message.trim())) return;
    locked.current = true;
    cancellation.current = false;
    setSubmitting(true);
    setError(null);
    try {
      if (!pending.current) {
        const saved = await flush();
        currentDraft.current = saved.id;
        pending.current = {
          requestId: customizationRequestId(),
          draftId: saved.id,
          expectedDraftRevision: saved.revision,
          tool,
          message: message.trim(),
          itemIds,
          materialIds,
        };
      }
      const request = pending.current;
      const job = await customizationApi.ask(request);
      receive(job);
      pending.current = null;
      setUncertain(false);
      setMessage((value) => (value.trim() === request.message ? "" : value));
      if (cancellation.current && aiRunning(job)) receive(await customizationApi.cancel(job.id));
    } catch (error) {
      const unknown =
        !(error instanceof CustomizationError) ||
        ["response-unknown", "unavailable"].includes(error.reason);
      setUncertain(unknown && pending.current !== null);
      if (!unknown) pending.current = null;
      setError(error instanceof Error ? error.message : "AIへ接続できませんでした。");
    } finally {
      locked.current = false;
      setSubmitting(false);
    }
  }
  async function cancel() {
    cancellation.current = true;
    if (!active) return;
    try {
      receive(await customizationApi.cancel(active.id));
    } catch (error) {
      setError(error instanceof Error ? error.message : "停止結果を確認できません。");
    }
  }
  return {
    message,
    setMessage,
    tool,
    setTool,
    tools,
    jobs,
    error,
    submitting,
    active,
    materials,
    materialIds,
    setMaterialIds,
    uncertain,
    send,
    cancel,
    refresh: () => setRefreshVersion((value) => value + 1),
  };
}
export type CustomizationAiState = ReturnType<typeof useCustomizationAi>;
