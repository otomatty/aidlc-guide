import { randomUUID } from "node:crypto";
import type {
  CustomizationCatalog,
  CustomizationChange,
  CustomizationDraft,
  CustomizationMutation,
  CustomizationRequestReceipt,
} from "@aidlc-guide/shared-types";
import { applyChanges, digest, fail, identifier, localIdentifier, object } from "./model.ts";
import type { CustomizationStorage } from "./storage.ts";

type Receipt = { hash: string; draftId: string | null; revision: number; kind: string };
export const MAX_DRAFT_RECEIPTS = 1024;
type DraftState = {
  schemaVersion: 1;
  draft: CustomizationDraft | null;
  receipts: Record<string, Receipt>;
  receiptOrder?: string[];
  undo?: { operationId: string; revision: number; items: CustomizationDraft["items"] };
};

function pruneReceipts(state: DraftState, newest?: string): void {
  const order = (state.receiptOrder ?? Object.keys(state.receipts)).filter(
    (id) => id !== newest && Object.hasOwn(state.receipts, id),
  );
  if (newest) order.push(newest);
  state.receiptOrder = order.slice(-MAX_DRAFT_RECEIPTS);
  state.receipts = Object.fromEntries(
    state.receiptOrder.map((id) => [id, state.receipts[id] as Receipt]),
  );
}

export function mutationHeader(body: unknown): CustomizationMutation {
  if (
    !object(body) ||
    !localIdentifier(body.requestId) ||
    !Number.isSafeInteger(body.expectedDraftRevision) ||
    Number(body.expectedDraftRevision) < 0 ||
    (body.draftId !== undefined && !identifier(body.draftId))
  )
    return fail("bad-request", "下書きrevisionまたはrequest IDが不正です。");
  return {
    requestId: body.requestId,
    expectedDraftRevision: Number(body.expectedDraftRevision),
    ...(body.draftId === undefined ? {} : { draftId: body.draftId }),
  };
}

export class CustomizationDraftStore {
  constructor(readonly storage: CustomizationStorage) {}
  private async state(): Promise<DraftState> {
    const state = await this.storage.readJson<DraftState>("draft.json");
    if (!state) return { schemaVersion: 1, draft: null, receipts: {} };
    if (
      state.schemaVersion !== 1 ||
      !object(state.receipts) ||
      (state.draft !== null && (!identifier(state.draft.id) || !Array.isArray(state.draft.items)))
    )
      return fail("draft-unreadable", "保存済み下書きを読み取れません。", 409);
    return state;
  }
  async read(): Promise<CustomizationDraft | null> {
    return (await this.state()).draft;
  }
  async request(id: string): Promise<CustomizationRequestReceipt | null> {
    const state = await this.state();
    const receipt = Object.hasOwn(state.receipts, id) ? state.receipts[id] : undefined;
    return receipt
      ? {
          requestId: id,
          kind: receipt.kind,
          status: "completed",
          draftId: receipt.draftId,
          draftRevision: receipt.revision,
          currentDraft: state.draft,
        }
      : null;
  }
  async replay(
    header: CustomizationMutation,
    request: unknown,
    kind: string,
  ): Promise<CustomizationDraft | null | undefined> {
    const state = await this.state();
    const receipt = Object.hasOwn(state.receipts, header.requestId)
      ? state.receipts[header.requestId]
      : undefined;
    if (!receipt) return undefined;
    if (receipt.hash !== digest(JSON.stringify([kind, request])) || receipt.kind !== kind)
      return fail("request-id-conflict", "同じrequest IDに異なる入力があります。", 409);
    if (
      (state.draft?.id ?? null) !== receipt.draftId ||
      (state.draft?.revision ?? 0) !== receipt.revision
    )
      return fail(
        "request-already-completed",
        "この操作は完了済みです。操作結果と最新の下書きを再取得してください。",
        409,
      );
    return state.draft;
  }
  async require(id?: string, revision?: number): Promise<CustomizationDraft> {
    const draft = await this.read();
    if (!draft) return fail("draft-not-found", "下書きがありません。", 404);
    if (
      (id !== undefined && draft.id !== id) ||
      (revision !== undefined && draft.revision !== revision)
    )
      return fail("draft-conflict", "別の編集が保存されています。内容を再確認してください。", 409);
    return draft;
  }

  async mutate(
    header: CustomizationMutation,
    request: unknown,
    kind: string,
    action: (state: DraftState) => Promise<void>,
  ): Promise<CustomizationDraft | null> {
    return await this.storage.withLock("draft", async () => {
      const state = await this.state();
      const hash = digest(JSON.stringify([kind, request]));
      const receipt = Object.hasOwn(state.receipts, header.requestId)
        ? state.receipts[header.requestId]
        : undefined;
      if (receipt) {
        if (receipt.hash !== hash || receipt.kind !== kind)
          return fail("request-id-conflict", "同じrequest IDに異なる入力があります。", 409);
        if (
          (state.draft?.id ?? null) !== receipt.draftId ||
          (state.draft?.revision ?? 0) !== receipt.revision
        )
          return fail(
            "request-already-completed",
            "この操作は完了済みです。操作結果と最新の下書きを再取得してください。",
            409,
          );
        return state.draft;
      }
      if (await this.storage.readJson(`requests/${header.requestId}.json`))
        return fail("request-id-conflict", "同じrequest IDが適用操作に使用されています。", 409);
      const applying = await this.storage.readJson<{ active: boolean }>("apply-running.json");
      if (applying?.active)
        return fail(
          "operation-active",
          "設定を適用中です。完了後に下書きを保存してください。",
          409,
        );
      if (state.draft) {
        if (
          header.draftId !== state.draft.id ||
          header.expectedDraftRevision !== state.draft.revision
        )
          return fail(
            "draft-conflict",
            "別の編集が保存されています。内容を再確認してください。",
            409,
          );
      } else if (header.expectedDraftRevision !== 0 || header.draftId !== undefined)
        return fail("draft-conflict", "下書きが変更または破棄されています。", 409);
      await action(state);
      if (state.draft) {
        state.draft.revision += 1;
        state.draft.updatedAt = new Date().toISOString();
        const current = new Set(state.draft.items.map((item) => item.id));
        state.draft.removedItemIds = state.draft.baseItems
          .filter((item) => !current.has(item.id))
          .map((item) => item.id);
      }
      state.receipts[header.requestId] = {
        hash,
        kind,
        draftId: state.draft?.id ?? null,
        revision: state.draft?.revision ?? 0,
      };
      // Older receipts expire; draft identity/revision checks still protect every mutation.
      pruneReceipts(state, header.requestId);
      await this.storage.writeJson("draft.json", state);
      return state.draft;
    });
  }

  async save(
    header: CustomizationMutation,
    changes: CustomizationChange[],
    catalog?: CustomizationCatalog,
  ): Promise<CustomizationDraft> {
    const result = await this.mutate(header, { header, changes }, "save", async (state) => {
      if (!state.draft) {
        if (!catalog) return fail("draft-not-found", "設定の読込みが必要です。", 409);
        state.draft = {
          schemaVersion: 1,
          id: randomUUID(),
          revision: 0,
          spaceId: catalog.spaceId,
          baseConfigurationRevision: catalog.configurationRevision,
          engineVersion: catalog.engineVersion,
          capabilityProfile: String(catalog.capabilities.protocolVersion),
          updatedAt: new Date().toISOString(),
          baseItems: catalog.items,
          items: structuredClone(catalog.items),
          removedItemIds: [],
        };
      }
      state.draft.items = applyChanges(state.draft.items, changes);
    });
    return result ?? fail("draft-not-found", "下書きがありません。", 404);
  }

  async discard(header: CustomizationMutation): Promise<void> {
    await this.mutate(header, header, "discard", async (state) => {
      state.draft = null;
      delete state.undo;
    });
  }

  async adopt(
    header: CustomizationMutation,
    operationId: string,
    changes: CustomizationChange[],
    kind: "proposal" | "import",
    selection?: unknown,
    expectedConfigurationRevision?: string,
  ): Promise<CustomizationDraft> {
    const result = await this.mutate(
      header,
      { header, operationId, ...(selection ? { selection } : {}) },
      kind,
      async (state) => {
        if (!state.draft) return fail("draft-not-found", "下書きがありません。", 404);
        if (
          expectedConfigurationRevision !== undefined &&
          state.draft.baseConfigurationRevision !== expectedConfigurationRevision
        )
          return fail(
            "proposal-stale",
            "設定が変更されています。下書きの基準を更新して再度提案を作成してください。",
            409,
          );
        state.undo = {
          operationId,
          revision: state.draft.revision + 1,
          items: structuredClone(state.draft.items),
        };
        state.draft.items = applyChanges(state.draft.items, changes);
      },
    );
    return result ?? fail("draft-not-found", "下書きがありません。", 404);
  }

  async undo(header: CustomizationMutation, operationId: string): Promise<CustomizationDraft> {
    const result = await this.mutate(header, { header, operationId }, "undo", async (state) => {
      if (
        !state.draft ||
        state.undo?.operationId !== operationId ||
        state.undo.revision !== state.draft.revision
      )
        return fail(
          "proposal-stale",
          "後続の編集があるため、そのまま取り消せません。差分を確認してください。",
          409,
        );
      state.draft.items = state.undo.items;
      delete state.undo;
    });
    return result ?? fail("draft-not-found", "下書きがありません。", 404);
  }

  async reconcile(
    header: CustomizationMutation,
    catalog: CustomizationCatalog,
    choices: { itemId: string; choice: "draft" | "current" }[],
  ): Promise<CustomizationDraft> {
    const result = await this.mutate(
      header,
      { header, revision: catalog.configurationRevision, choices },
      "reconcile",
      async (state) => {
        if (!state.draft) return fail("draft-not-found", "下書きがありません。", 404);
        const base = new Map(state.draft.baseItems.map((item) => [item.id, item]));
        const local = new Map(state.draft.items.map((item) => [item.id, item]));
        const current = new Map(catalog.items.map((item) => [item.id, item]));
        const decisions = new Map(choices.map((entry) => [entry.itemId, entry.choice]));
        const items: CustomizationDraft["items"] = [];
        for (const id of new Set([...base.keys(), ...local.keys(), ...current.keys()])) {
          const previous = JSON.stringify(base.get(id));
          const edited = JSON.stringify(local.get(id));
          const changed = JSON.stringify(current.get(id));
          if (
            edited !== previous &&
            changed !== previous &&
            edited !== changed &&
            !decisions.has(id)
          )
            return fail("configuration-changed", "両方で変更された項目を選択してください。", 409);
          const keepLocal =
            decisions.get(id) === "draft" ||
            (decisions.get(id) !== "current" && edited !== previous);
          const item = keepLocal ? local.get(id) : current.get(id);
          if (item) {
            const next = structuredClone(item);
            if (current.get(id)?.source) next.source = current.get(id)?.source;
            items.push(next);
          }
        }
        state.draft.items = items;
        state.draft.baseItems = catalog.items;
        state.draft.baseConfigurationRevision = catalog.configurationRevision;
        state.draft.engineVersion = catalog.engineVersion;
        delete state.undo;
      },
    );
    return result ?? fail("draft-not-found", "下書きがありません。", 404);
  }

  async markApplied(
    draftId: string,
    revision: number,
    configurationRevision: string,
    catalog?: CustomizationCatalog,
  ): Promise<void> {
    await this.storage.withLock("draft", async () => {
      const state = await this.state();
      if (!state.draft || state.draft.id !== draftId || state.draft.revision !== revision) return;
      state.draft = {
        ...state.draft,
        id: randomUUID(),
        revision: state.draft.revision + 1,
        baseConfigurationRevision: configurationRevision,
        baseItems: structuredClone(catalog?.items ?? state.draft.items),
        items: structuredClone(catalog?.items ?? state.draft.items),
        removedItemIds: [],
        updatedAt: new Date().toISOString(),
      };
      delete state.undo;
      pruneReceipts(state);
      await this.storage.writeJson("draft.json", state);
    });
  }
}
