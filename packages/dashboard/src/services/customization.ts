import type {
  CustomizationAiConversation,
  CustomizationAiJob,
  CustomizationAiMaterial,
  CustomizationAiRequest,
  CustomizationCatalog,
  CustomizationDraft,
  CustomizationExport,
  CustomizationImportPlan,
  CustomizationImportSelection,
  CustomizationMutation,
  CustomizationOperation,
  CustomizationPlan,
  CustomizationRequestReceipt,
  CustomizationResult,
  CustomizationSaveRequest,
  CustomizationValidation,
  DocsQaToolStatus,
} from "@aidlc-guide/shared-types";
import { getTransport } from "./transport/index.ts";

const ROOT = "/api/customization";
export const customizationRequestId = () => `${Date.now()}-${crypto.randomUUID()}`;

export class CustomizationError extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

function unwrap<T>(body: unknown): T {
  if (!body || typeof body !== "object")
    throw new CustomizationError("unavailable", "カスタマイズ機能に接続できませんでした。");
  const result = body as CustomizationResult<T>;
  if ("ok" in result && result.ok === true) return result.value;
  if ("reason" in result)
    throw new CustomizationError(result.reason, result.message || result.reason);
  throw new CustomizationError(
    "unavailable",
    "カスタマイズ機能を利用できません。Guideを更新してください。",
  );
}

async function get<T>(route: string): Promise<T> {
  const response = await getTransport().getJson(`${ROOT}${route}`);
  if (!response.reached)
    throw new CustomizationError("unavailable", "接続できませんでした。入力は保持しています。");
  return unwrap<T>(response.body);
}

async function post<T>(route: string, body: object): Promise<T> {
  const response = await getTransport().postJson(`${ROOT}${route}`, body);
  if (response.status === 0)
    throw new CustomizationError(
      "response-unknown",
      "受付結果を確認できません。入力を保持して、同じ操作の結果を再確認してください。",
    );
  try {
    return unwrap<T>(response.body);
  } catch (error) {
    if (
      error instanceof CustomizationError &&
      "requestId" in body &&
      typeof body.requestId === "string"
    )
      throw new CustomizationError(error.reason, error.message, body.requestId);
    throw error;
  }
}

export const customizationApi = {
  catalog: (space?: string) =>
    get<CustomizationCatalog>(space ? `?space=${encodeURIComponent(space)}` : ""),
  draft: () => get<CustomizationDraft | null>("/draft"),
  save: (body: CustomizationSaveRequest) => post<CustomizationDraft>("/draft/save", body),
  discard: (body: CustomizationMutation) => post<CustomizationDraft | null>("/draft/discard", body),
  reconcile: (
    body: CustomizationMutation & {
      choices: Array<{ itemId: string; choice: "draft" | "current" }>;
    },
  ) => post<CustomizationDraft>("/draft/reconcile", body),
  validate: (body: CustomizationMutation) =>
    post<CustomizationValidation>("/validate", {
      ...body,
      draftRevision: body.expectedDraftRevision,
    }),
  plan: (body: CustomizationMutation) =>
    post<CustomizationPlan>("/plan", { ...body, draftRevision: body.expectedDraftRevision }),
  apply: (body: CustomizationMutation & { planId: string; configurationRevision: string }) =>
    post<CustomizationOperation>("/apply", {
      ...body,
      expectedConfigurationRevision: body.configurationRevision,
    }),
  operation: (id: string) => get<CustomizationOperation>(`/operation?id=${encodeURIComponent(id)}`),
  pendingOperation: () => get<CustomizationOperation | null>("/operation"),
  importAnalyze: (body: CustomizationMutation & { package: unknown }) =>
    post<CustomizationImportPlan>("/import/analyze", body),
  importAdopt: (
    body: CustomizationMutation & { planId: string; selections: CustomizationImportSelection[] },
  ) => post<CustomizationDraft>("/import/adopt", body),
  export: (
    body: CustomizationMutation & {
      format: "guide" | "plugin";
      itemIds: string[];
      name: string;
      version: string;
      excludeUnsupported?: boolean;
      harnesses?: string[];
    },
  ) =>
    post<CustomizationExport>("/export", {
      ...body,
      selectedItemIds: body.itemIds,
      draftRevision: body.expectedDraftRevision,
      confirmedOmissions: body.excludeUnsupported,
    }),
  request: (id: string) =>
    get<CustomizationRequestReceipt | null>(`/request?id=${encodeURIComponent(id)}`),
  recover: (operationId: string) => post<CustomizationOperation>("/recover", { operationId }),
  materials: () => get<CustomizationAiMaterial[]>("/ai/materials"),
  tools: () => get<DocsQaToolStatus[]>("/ai/tools"),
  ask: (body: CustomizationAiRequest) => post<CustomizationAiJob>("/ai/ask", body),
  job: (id: string) => get<CustomizationAiJob>(`/ai/job?id=${encodeURIComponent(id)}`),
  conversation: (draftId: string) =>
    get<CustomizationAiConversation>(`/ai/conversation?draftId=${encodeURIComponent(draftId)}`),
  cancel: (id: string) => post<CustomizationAiJob>("/ai/cancel", { id }),
  adopt: (body: CustomizationMutation & { proposalId: string }) =>
    post<CustomizationDraft>("/proposal/adopt", body),
  undo: (body: CustomizationMutation & { operationId: string }) =>
    post<CustomizationDraft>("/proposal/undo", body),
};

export type CustomizationApi = typeof customizationApi;

export function downloadCustomization(file: CustomizationExport): void {
  const data =
    file.encoding === "base64"
      ? Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0))
      : file.content;
  const url = URL.createObjectURL(new Blob([data], { type: file.mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
