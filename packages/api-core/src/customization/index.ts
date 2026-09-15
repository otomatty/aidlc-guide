import { randomUUID } from "node:crypto";
import type {
  CustomizationCatalog,
  CustomizationDiagnostic,
  CustomizationDraft,
  CustomizationExport,
  CustomizationFileChange,
  CustomizationImportSelection,
  CustomizationOperation,
  CustomizationPlan,
  CustomizationRequestReceipt,
  CustomizationValidation,
} from "@aidlc-guide/shared-types";
import { readCompatibilityCatalog } from "./catalog.ts";
import { CustomizationDraftStore, mutationHeader } from "./draft-store.ts";
import {
  type CustomizationEngine,
  createCustomizationEngine,
  type EngineRequest,
} from "./engine-adapter.ts";
import {
  CustomizationError,
  digest,
  fail,
  identifier,
  localDiagnostics,
  localIdentifier,
  object,
  parseChanges,
} from "./model.ts";
import { CustomizationPackages, guideExport } from "./packages.ts";
import { CustomizationProposals } from "./proposals.ts";
import { CustomizationStorage } from "./storage.ts";

type EnginePlan = {
  id: string;
  configurationRevision: string;
  files: (CustomizationFileChange & { content?: string })[];
  diagnostics: CustomizationDiagnostic[];
  canApply: boolean;
};
type EngineApplied = {
  transactionId?: string;
  status: "committed" | "rolled-back" | "recovery-required" | "nothing-to-recover";
  configurationRevision: string;
  diagnostics?: CustomizationDiagnostic[];
};
type ApplyReceipt = {
  hash: string;
  operation: CustomizationOperation;
  planId: string;
  draftId: string;
  draftRevision: number;
  spaceId: string;
};

export type CustomizationServiceConfig = {
  workspaceRoot: string;
  hostMode?: boolean;
  engine?: CustomizationEngine;
  /** Injected by hosts; a failed permission check never destroys stored edits. */
  canEdit?: () => boolean;
  onChange?: () => void;
};

export class CustomizationService {
  readonly storage: CustomizationStorage;
  readonly drafts: CustomizationDraftStore;
  readonly proposals: CustomizationProposals;
  readonly packages: CustomizationPackages;
  readonly engine: CustomizationEngine;
  constructor(readonly config: CustomizationServiceConfig) {
    this.storage = new CustomizationStorage(config.workspaceRoot);
    this.drafts = new CustomizationDraftStore(this.storage);
    this.proposals = new CustomizationProposals(this.storage, this.drafts);
    this.packages = new CustomizationPackages(this.storage, this.drafts);
    this.engine = config.engine ?? createCustomizationEngine(config.workspaceRoot);
  }
  assertEditable(): void {
    if (this.config.hostMode) fail("read-only-mode", "共有閲覧モードでは編集できません。", 403);
    if (this.config.canEdit?.() === false)
      fail("workspace-untrusted", "信頼されていないワークスペースでは編集できません。", 403);
  }
  async catalog(spaceId?: string): Promise<CustomizationCatalog> {
    if (spaceId !== undefined && !identifier(spaceId))
      return fail("bad-request", "spaceが不正です。");
    if (this.config.hostMode || this.config.canEdit?.() === false)
      return await readCompatibilityCatalog(
        this.config.workspaceRoot,
        spaceId,
        this.config.hostMode ?? false,
      );
    try {
      const catalog = await this.engine.call<Omit<CustomizationCatalog, "hostMode">>("catalog", {
        schemaVersion: 1,
        ...(spaceId ? { spaceId } : {}),
      });
      if (!Array.isArray(catalog.items) || typeof catalog.configurationRevision !== "string")
        throw new CustomizationError(
          "engine-invalid-response",
          "エンジンの設定一覧が不正です。",
          502,
        );
      return { ...catalog, hostMode: false };
    } catch (error) {
      if (
        !(error instanceof CustomizationError) ||
        !["engine-capability-missing", "engine-unavailable"].includes(error.code)
      )
        throw error;
      return await readCompatibilityCatalog(this.config.workspaceRoot, spaceId);
    }
  }
  async draft(): Promise<CustomizationDraft | null> {
    this.assertEditable();
    return await this.drafts.read();
  }
  async item(id: string): Promise<CustomizationCatalog["items"][number]> {
    const catalog = await this.catalog();
    return (
      catalog.items.find((item) => item.id === id) ??
      fail("item-not-found", "項目が見つかりません。", 404)
    );
  }
  private async checkedDraft(body: Record<string, unknown>): Promise<CustomizationDraft> {
    this.assertEditable();
    if (
      (body.draftId !== undefined && !identifier(body.draftId)) ||
      (body.draftRevision !== undefined && !Number.isSafeInteger(body.draftRevision))
    )
      return fail("bad-request", "下書きの識別情報が不正です。");
    return await this.drafts.require(
      body.draftId as string | undefined,
      body.draftRevision as number | undefined,
    );
  }
  private engineRequest(draft: CustomizationDraft): EngineRequest {
    const base = new Map(draft.baseItems.map((item) => [item.id, JSON.stringify(item)]));
    return {
      schemaVersion: 1,
      spaceId: draft.spaceId,
      items: draft.items.filter((item) => base.get(item.id) !== JSON.stringify(item)),
      removedItemIds: draft.removedItemIds,
      expectedConfigurationRevision: draft.baseConfigurationRevision,
    };
  }
  async validate(body: Record<string, unknown>): Promise<CustomizationValidation> {
    const draft = await this.checkedDraft(body);
    const local = localDiagnostics(draft.items);
    try {
      const result = await this.engine.call<CustomizationValidation>(
        "validate",
        this.engineRequest(draft),
      );
      const diagnostics = [...local, ...result.diagnostics];
      return { valid: !diagnostics.some((item) => item.severity === "error"), diagnostics };
    } catch (error) {
      if (!(error instanceof CustomizationError) || error.code !== "engine-capability-missing")
        throw error;
      return {
        valid: false,
        diagnostics: [...local, { severity: "error", code: error.code, message: error.message }],
      };
    }
  }
  async plan(body: Record<string, unknown>): Promise<CustomizationPlan> {
    const draft = await this.checkedDraft(body);
    const catalog = await this.catalog(draft.spaceId);
    if (catalog.configurationRevision !== draft.baseConfigurationRevision)
      return fail(
        "configuration-changed",
        "設定が外部で変更されました。下書きの基準を更新してください。",
        409,
      );
    const local = localDiagnostics(draft.items);
    let result: EnginePlan;
    try {
      result = await this.engine.call<EnginePlan>("plan", this.engineRequest(draft));
    } catch (error) {
      if (!(error instanceof CustomizationError) || error.code !== "engine-capability-missing")
        throw error;
      result = {
        id: randomUUID(),
        configurationRevision: draft.baseConfigurationRevision,
        files: [],
        canApply: false,
        diagnostics: [{ severity: "error", code: error.code, message: error.message }],
      };
    }
    const diagnostics = [...local, ...result.diagnostics];
    const plan: CustomizationPlan = {
      id: result.id,
      draftId: draft.id,
      draftRevision: draft.revision,
      configurationRevision: result.configurationRevision,
      files: result.files.map((file) => ({
        ...file,
        ...(file.content !== undefined && file.after === undefined ? { after: file.content } : {}),
      })),
      diagnostics,
      canApply: result.canApply && !diagnostics.some((entry) => entry.severity === "error"),
      createdAt: new Date().toISOString(),
    };
    await this.storage.writeJson(`plans/${plan.id}.json`, plan);
    return plan;
  }
  async apply(body: Record<string, unknown>): Promise<CustomizationOperation> {
    this.assertEditable();
    const header = mutationHeader(body);
    if (await this.drafts.request(header.requestId))
      return fail("request-id-conflict", "同じrequest IDが別の編集に使用されています。", 409);
    if (!localIdentifier(body.planId) || typeof body.expectedConfigurationRevision !== "string")
      return fail("bad-request", "適用計画の識別情報が不正です。");
    const requestHash = digest(JSON.stringify(body));
    return await this.storage.withLock("apply", async () => {
      const existing = await this.storage.readJson<ApplyReceipt>(
        `requests/${header.requestId}.json`,
      );
      if (existing && existing.hash !== requestHash)
        return fail("request-id-conflict", "同じrequest IDに異なる入力があります。", 409);
      if (existing) return await this.recoverReceipt(existing);
      const plan = await this.storage.readJson<CustomizationPlan>(`plans/${body.planId}.json`);
      if (!plan?.canApply) return fail("validation-failed", "適用可能な計画がありません。", 409);
      if (
        plan.draftId !== header.draftId ||
        plan.draftRevision !== header.expectedDraftRevision ||
        plan.configurationRevision !== body.expectedConfigurationRevision
      )
        return fail("configuration-changed", "確認した内容が変更されています。", 409);
      const operation: CustomizationOperation = {
        id: randomUUID(),
        requestId: header.requestId,
        status: "running",
        kind: "apply",
      };
      const draft = await this.drafts.require(plan.draftId, plan.draftRevision);
      const receipt: ApplyReceipt = {
        hash: requestHash,
        operation,
        planId: plan.id,
        draftId: plan.draftId,
        draftRevision: plan.draftRevision,
        spaceId: draft.spaceId,
      };
      await this.storage.withLock("draft", async () => {
        if (await this.drafts.request(header.requestId))
          return fail("request-id-conflict", "同じrequest IDが別の編集に使用されています。", 409);
        await this.drafts.require(plan.draftId, plan.draftRevision);
        const active = await this.storage.readJson<{ active: boolean; requestId: string }>(
          "apply-running.json",
        );
        if (active?.active && active.requestId !== header.requestId)
          return fail("operation-active", "別の適用操作を復旧してください。", 409);
        await this.storage.writeJson(`operations/${operation.id}.json`, operation);
        await this.storage.writeJson(`requests/${header.requestId}.json`, receipt);
        await this.storage.writeJson("apply-running.json", {
          active: true,
          requestId: header.requestId,
          operationId: operation.id,
        });
      });
      try {
        const result = await this.engine.call<EngineApplied>("apply", {
          schemaVersion: 1,
          requestId: header.requestId,
          planId: plan.id,
          expectedConfigurationRevision: plan.configurationRevision,
        });
        if (result.status !== "committed" && result.status !== "rolled-back")
          throw new CustomizationError(
            "recovery-required",
            "エンジンの適用処理を復旧する必要があります。",
            409,
          );
        await this.finishReceipt(receipt, result);
      } catch (error) {
        // Transport loss is indeterminate. Preserve the receipt and allow replay to the engine.
        if (
          !(error instanceof CustomizationError) ||
          ["engine-unavailable", "engine-invalid-response", "recovery-required"].includes(
            error.code,
          )
        ) {
          operation.status = "running";
          operation.message = "適用結果を確認できません。同じ操作を再照会してください。";
          operation.error = { code: "recovery-required", message: operation.message };
          operation.recoveryRequired = true;
        } else {
          operation.status = "failed";
          operation.error = { code: error.code, message: error.message };
          await this.storage.writeJson("apply-running.json", {
            active: false,
            requestId: header.requestId,
          });
        }
      }
      await this.storeReceipt(receipt);
      this.config.onChange?.();
      return operation;
    });
  }
  async operation(id: string): Promise<CustomizationOperation> {
    this.assertEditable();
    if (!localIdentifier(id)) return fail("bad-request", "操作IDが不正です。");
    const operation =
      (await this.storage.readJson<CustomizationOperation>(`operations/${id}.json`)) ??
      fail("operation-not-found", "操作が見つかりません。", 404);
    return { ...operation, ...(operation.status === "running" ? { recoveryRequired: true } : {}) };
  }
  async activeOperation(): Promise<CustomizationOperation | null> {
    this.assertEditable();
    const active = await this.storage.readJson<{ active: boolean; requestId: string }>(
      "apply-running.json",
    );
    if (!active?.active) return null;
    const receipt = await this.storage.readJson<ApplyReceipt>(`requests/${active.requestId}.json`);
    return receipt ? { ...receipt.operation, recoveryRequired: true } : null;
  }
  async request(id: string): Promise<CustomizationRequestReceipt | null> {
    this.assertEditable();
    if (!localIdentifier(id)) return fail("bad-request", "request IDが不正です。");
    const applied = await this.storage.readJson<ApplyReceipt>(`requests/${id}.json`);
    if (applied)
      return {
        requestId: id,
        kind: "apply",
        status: applied.operation.status,
        operation: {
          ...applied.operation,
          ...(applied.operation.status === "running" ? { recoveryRequired: true } : {}),
        },
      };
    return await this.drafts.request(id);
  }
  private async storeReceipt(receipt: ApplyReceipt): Promise<void> {
    await this.storage.writeJson(`operations/${receipt.operation.id}.json`, receipt.operation);
    await this.storage.writeJson(`requests/${receipt.operation.requestId}.json`, receipt);
  }
  private async finishReceipt(receipt: ApplyReceipt, result: EngineApplied): Promise<void> {
    const operation = receipt.operation;
    if (result.status === "committed") {
      const catalog = await this.catalog(receipt.spaceId);
      await this.drafts.markApplied(
        receipt.draftId,
        receipt.draftRevision,
        catalog.configurationRevision,
        catalog,
      );
      operation.status = "completed";
      operation.message = "設定を適用しました。";
      operation.configurationRevision = result.configurationRevision;
      operation.transactionId = result.transactionId;
      delete operation.error;
    } else {
      operation.status = "failed";
      operation.message =
        result.status === "rolled-back"
          ? "適用を取り消し、元の設定に復旧しました。下書きは保持されています。"
          : "適用は開始されていません。下書きから改めて適用内容を確認してください。";
      operation.error = {
        code: result.status === "rolled-back" ? "apply-rolled-back" : "apply-not-started",
        message: operation.message,
      };
    }
    operation.recoveryRequired = false;
    // Persist the result before unfreezing edits. Repeating cleanup is safe across crashes.
    await this.storeReceipt(receipt);
    const active = await this.storage.readJson<{ active: boolean; requestId: string }>(
      "apply-running.json",
    );
    if (active?.active && active.requestId === operation.requestId)
      await this.storage.writeJson("apply-running.json", {
        active: false,
        requestId: operation.requestId,
      });
  }
  private async recoverReceipt(receipt: ApplyReceipt): Promise<CustomizationOperation> {
    try {
      if (receipt.operation.status !== "running") {
        const active = await this.storage.readJson<{ active: boolean; requestId: string }>(
          "apply-running.json",
        );
        if (active?.active && active.requestId === receipt.operation.requestId)
          await this.storage.writeJson("apply-running.json", {
            active: false,
            requestId: active.requestId,
          });
        return receipt.operation;
      }
      const result = await this.engine.call<EngineApplied>("recover", {
        schemaVersion: 1,
        requestId: receipt.operation.requestId,
        transactionId: receipt.operation.transactionId,
      });
      if (result.status === "recovery-required")
        throw new CustomizationError(
          "recovery-required",
          "エンジン側の復旧を完了できませんでした。",
          409,
        );
      await this.finishReceipt(receipt, result);
    } catch (error) {
      receipt.operation.status = "running";
      receipt.operation.recoveryRequired = true;
      receipt.operation.error = {
        code: "recovery-required",
        message: error instanceof Error ? error.message : "復旧状況を確認できません。",
      };
      await this.storeReceipt(receipt);
    }
    this.config.onChange?.();
    return receipt.operation;
  }
  async recover(body: Record<string, unknown>): Promise<CustomizationOperation> {
    this.assertEditable();
    if (!localIdentifier(body.operationId))
      return fail("bad-request", "復旧する操作IDが不正です。");
    return await this.storage.withLock("apply", async () => {
      const operation = await this.operation(String(body.operationId));
      const receipt = await this.storage.readJson<ApplyReceipt>(
        `requests/${operation.requestId}.json`,
      );
      if (!receipt) return fail("operation-not-found", "適用操作の記録がありません。", 404);
      return await this.recoverReceipt(receipt);
    });
  }
  async export(body: Record<string, unknown>): Promise<CustomizationExport> {
    const draft = await this.checkedDraft(body);
    if (!Array.isArray(body.selectedItemIds) || !body.selectedItemIds.every(identifier))
      return fail("bad-request", "書き出す項目を選択してください。");
    if (body.format === "guide") {
      const output = guideExport(
        draft,
        body.selectedItemIds,
        typeof body.name === "string" ? body.name : undefined,
        typeof body.version === "string" ? body.version : undefined,
      );
      let result: CustomizationValidation;
      try {
        result = await this.engine.call<CustomizationValidation>("validate", {
          ...this.engineRequest(draft),
          selectedItemIds: body.selectedItemIds,
        });
      } catch (error) {
        if (!(error instanceof CustomizationError) || error.code !== "engine-capability-missing")
          throw error;
        output.diagnostics.push({
          severity: "warning",
          code: "engine-capability-missing",
          message:
            "基本的な形式を検証して書き出しました。参照関係と適用の互換性は、対応するエンジンで確認してください。",
        });
        return output;
      }
      if (!result.valid || result.diagnostics.some((entry) => entry.severity === "error"))
        throw new CustomizationError(
          "validation-failed",
          "選択した配布内容の参照と設定を確認してください。",
          409,
          result.diagnostics,
        );
      output.diagnostics.push(...result.diagnostics);
      return output;
    }
    if (body.format !== "plugin") return fail("bad-request", "配布形式が不正です。");
    if (
      body.harnesses !== undefined &&
      (!Array.isArray(body.harnesses) ||
        !body.harnesses.every(
          (value) =>
            typeof value === "string" &&
            ["claude", "cursor", "codex", "copilot", "kiro", "kiro-ide", "opencode"].includes(
              value,
            ),
        ))
    )
      return fail("bad-request", "対象ハーネスが不正です。");
    const result = await this.engine.call<{
      filename: string;
      mimeType: string;
      base64: string;
      omittedItemIds?: string[];
      diagnostics?: CustomizationDiagnostic[];
    }>("export", {
      ...this.engineRequest(draft),
      format: "plugin",
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.version === "string" ? { version: body.version } : {}),
      selectedItemIds: body.selectedItemIds,
      harnesses: body.harnesses as string[] | undefined,
    });
    if (result.omittedItemIds?.length && body.confirmedOmissions !== true)
      throw new CustomizationError(
        "export-omissions",
        "標準プラグインに含められない項目を確認してください。",
        409,
        result.diagnostics,
      );
    return {
      id: randomUUID(),
      filename: result.filename,
      mimeType: result.mimeType,
      encoding: "base64",
      content: result.base64,
      diagnostics: result.diagnostics ?? [],
    };
  }

  async post(action: string, input: unknown): Promise<unknown> {
    this.assertEditable();
    if (!object(input)) return fail("bad-request", "JSONオブジェクトが必要です。");
    if (
      action !== "apply" &&
      localIdentifier(input.requestId) &&
      (await this.storage.readJson(`requests/${input.requestId}.json`))
    )
      return fail("request-id-conflict", "同じrequest IDが別の適用操作に使用されています。", 409);
    switch (action) {
      case "draft/save": {
        const header = mutationHeader(input);
        const changes = parseChanges(input.changes);
        const current = await this.drafts.read();
        const catalog = current
          ? undefined
          : await this.catalog(typeof input.spaceId === "string" ? input.spaceId : undefined);
        const result = await this.drafts.save(header, changes, catalog);
        this.config.onChange?.();
        return result;
      }
      case "draft/discard":
        await this.drafts.discard(mutationHeader(input));
        this.config.onChange?.();
        return null;
      case "draft/reconcile": {
        const header = mutationHeader(input);
        const draft = await this.drafts.require();
        if (
          !Array.isArray(input.choices) ||
          !input.choices.every(
            (entry) =>
              object(entry) &&
              identifier(entry.itemId) &&
              ["draft", "current"].includes(String(entry.choice)),
          )
        )
          return fail("bad-request", "競合解消の選択が不正です。");
        const result = await this.drafts.reconcile(
          header,
          await this.catalog(draft.spaceId),
          input.choices as { itemId: string; choice: "draft" | "current" }[],
        );
        this.config.onChange?.();
        return result;
      }
      case "proposal/adopt": {
        const draft = await this.drafts.require();
        const catalog = await this.catalog(draft.spaceId);
        const result = await this.proposals.adopt(
          mutationHeader(input),
          String(input.proposalId ?? ""),
          catalog.configurationRevision,
        );
        this.config.onChange?.();
        return result;
      }
      case "proposal/undo": {
        const result = await this.drafts.undo(
          mutationHeader(input),
          String(input.operationId ?? ""),
        );
        this.config.onChange?.();
        return result;
      }
      case "import/analyze":
        return await this.packages.analyze(input.package);
      case "import/adopt": {
        if (
          !Array.isArray(input.selections) ||
          !input.selections.every(
            (entry) =>
              object(entry) &&
              identifier(entry.sourceId) &&
              (entry.targetId === null || identifier(entry.targetId)),
          )
        )
          return fail("bad-request", "取り込む項目の選択が不正です。");
        const result = await this.packages.adopt(
          mutationHeader(input),
          String(input.planId ?? ""),
          input.selections as CustomizationImportSelection[],
        );
        this.config.onChange?.();
        return result;
      }
      case "validate":
        return await this.validate(input);
      case "plan":
        return await this.plan(input);
      case "apply":
        return await this.apply(input);
      case "recover":
        return await this.recover(input);
      case "export":
        return await this.export(input);
      default:
        return fail("unknown-route", "操作が見つかりません。", 404);
    }
  }
}

export function createCustomizationService(
  config: CustomizationServiceConfig,
): CustomizationService {
  return new CustomizationService(config);
}
