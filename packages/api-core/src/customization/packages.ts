import { randomUUID } from "node:crypto";
import type {
  CustomizationDraft,
  CustomizationExport,
  CustomizationGuidePackage,
  CustomizationImportPlan,
  CustomizationImportSelection,
  CustomizationItem,
  CustomizationMutation,
} from "@aidlc-guide/shared-types";
import type { CustomizationDraftStore } from "./draft-store.ts";
import {
  digest,
  fail,
  identifier,
  localDiagnostics,
  localIdentifier,
  MAX_PACKAGE_BYTES,
  object,
  parseItem,
} from "./model.ts";
import type { CustomizationStorage } from "./storage.ts";

function portable(item: CustomizationItem): CustomizationItem {
  const result = structuredClone(item);
  delete result.source;
  delete result.editable;
  delete result.spaceId;
  return result;
}
function sameImportKind(a: CustomizationItem, b: CustomizationItem): boolean {
  return (
    a.kind === b.kind &&
    (a.kind !== "knowledge" || a.target?.knowledgeType === b.target?.knowledgeType)
  );
}

export function guideExport(
  draft: CustomizationDraft,
  selectedIds: string[],
  name = "customization",
  version = "1.0.0",
): CustomizationExport {
  const selected = new Set(selectedIds);
  if (!selected.size || [...selected].some((id) => !draft.items.some((item) => item.id === id)))
    return fail("bad-request", "書き出す項目を選択してください。");
  const items = draft.items.filter((item) => selected.has(item.id)).map(portable);
  const diagnostics = localDiagnostics(items);
  if (diagnostics.some((item) => item.severity === "error"))
    return fail("validation-failed", "未完成の項目は書き出せません。");
  if (!name.trim() || name.length > 200 || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))
    return fail("bad-request", "配布名またはバージョンが不正です。");
  const value: CustomizationGuidePackage = {
    schemaVersion: 1,
    format: "aidlc-guide",
    packageId: randomUUID(),
    name,
    version,
    engineVersion: draft.engineVersion,
    items,
    contentHash: digest(JSON.stringify(items)),
  };
  const content = JSON.stringify(value, null, 2);
  if (Buffer.byteLength(content) > MAX_PACKAGE_BYTES * 1.4)
    return fail("size-limit", "配布ファイルのサイズ上限を超えています。");
  return {
    id: randomUUID(),
    filename: `${name.replace(/[^a-zA-Z0-9_-]/g, "_") || "customization"}.aidlc-guide.json`,
    mimeType: "application/json",
    encoding: "utf8",
    content,
    diagnostics,
  };
}

export class CustomizationPackages {
  constructor(
    private storage: CustomizationStorage,
    private drafts: CustomizationDraftStore,
  ) {}
  async analyze(input: unknown): Promise<CustomizationImportPlan> {
    let data: unknown = input;
    if (typeof input === "string") {
      if (Buffer.byteLength(input) > MAX_PACKAGE_BYTES * 1.4)
        return fail("size-limit", "配布ファイルのサイズ上限を超えています。");
      try {
        data = JSON.parse(input);
      } catch {
        return fail("bad-request", "設定ファイルのJSONを読み取れません。");
      }
    }
    if (
      !object(data) ||
      data.schemaVersion !== 1 ||
      data.format !== "aidlc-guide" ||
      !identifier(data.packageId) ||
      typeof data.engineVersion !== "string" ||
      !Array.isArray(data.items) ||
      data.items.length > 500
    )
      return fail("package-unsupported", "対応するGuide設定ファイルではありません。");
    if (data.contentHash !== digest(JSON.stringify(data.items)))
      return fail("package-corrupt", "設定ファイルのhashが一致しません。");
    const items = data.items.map(parseItem);
    if (new Set(items.map((item) => item.id)).size !== items.length)
      return fail("package-corrupt", "同じ項目IDが重複しています。");
    const bytes = items.reduce(
      (sum, item) => sum + Buffer.byteLength(item.content) + (item.binary?.bytes ?? 0),
      0,
    );
    if (bytes > MAX_PACKAGE_BYTES)
      return fail("size-limit", "配布内容のサイズ上限を超えています。");
    const draft = await this.drafts.require();
    const plan: CustomizationImportPlan = {
      id: randomUUID(),
      draftId: draft.id,
      draftRevision: draft.revision,
      entries: [],
      diagnostics: localDiagnostics(items),
    };
    if (data.engineVersion !== draft.engineVersion)
      plan.diagnostics.push({
        severity: "warning",
        code: "engine-version-difference",
        message: "作成元とエンジン版が異なります。適用前に互換性を検証します。",
      });
    for (const original of items) {
      const item = portable(original);
      if (
        ["rule-section", "rule-file-metadata", "artifact-template", "knowledge"].includes(
          item.kind,
        ) &&
        item.owner === "project"
      )
        item.spaceId = draft.spaceId;
      const match = draft.items.find(
        (existing) => existing.id === item.id && sameImportKind(existing, item),
      );
      const candidates = draft.items
        .filter(
          (existing) =>
            sameImportKind(existing, item) &&
            ((existing.runtimeId === item.runtimeId && item.runtimeId !== undefined) ||
              existing.title === item.title) &&
            (item.kind !== "rule-section" ||
              (existing.target?.layer === item.target?.layer &&
                existing.target?.phase === item.target?.phase)),
        )
        .map((existing) => existing.id);
      plan.entries.push({
        sourceId: original.id,
        item,
        matchId: match?.id ?? null,
        action: match ? "replace" : candidates.length ? "choose-target" : "add",
        candidates,
      });
    }
    await this.storage.writeJson(`imports/${plan.id}.json`, plan);
    return plan;
  }
  async adopt(
    header: CustomizationMutation,
    planId: string,
    selections: CustomizationImportSelection[],
  ): Promise<CustomizationDraft> {
    if (!localIdentifier(planId)) return fail("bad-request", "読み込みplan IDが不正です。");
    const replay = await this.drafts.replay(
      header,
      { header, operationId: planId, selection: selections },
      "import",
    );
    if (replay) return replay;
    const plan = await this.storage.readJson<CustomizationImportPlan>(`imports/${planId}.json`);
    if (!plan) return fail("import-not-found", "読み込み計画がありません。", 404);
    if (header.draftId !== plan.draftId || header.expectedDraftRevision !== plan.draftRevision)
      return fail("import-stale", "下書きが変わりました。読み込み内容を再比較してください。", 409);
    const draft = await this.drafts.require(plan.draftId, plan.draftRevision);
    if (
      !selections.length ||
      new Set(selections.map((entry) => entry.sourceId)).size !== selections.length
    )
      return fail("bad-request", "取り込む項目を選択してください。");
    const targets = new Set<string>();
    const changes = selections.map((selection) => {
      const entry = plan.entries.find((item) => item.sourceId === selection.sourceId);
      if (!entry) return fail("bad-request", "選択項目が見つかりません。");
      const item = structuredClone(entry.item);
      if (selection.targetId !== null) {
        const prior = draft.items.find(
          (existing) => existing.id === selection.targetId && sameImportKind(existing, item),
        );
        if (!prior || targets.has(prior.id))
          return fail("bad-request", "置換先が不正または重複しています。");
        targets.add(prior.id);
        return {
          operation: "replace" as const,
          item: {
            ...item,
            id: prior.id,
            owner: prior.owner,
            pluginId: prior.pluginId,
            spaceId: prior.spaceId,
            source: prior.source,
          },
        };
      }
      item.id = draft.items.some((existing) => existing.id === item.id) ? randomUUID() : item.id;
      return { operation: "create" as const, item };
    });
    const destinations = new Map(
      selections.map((selection, index) => [selection.sourceId, changes[index]?.item.id]),
    );
    for (const [index, change] of changes.entries()) {
      if (change.item.target?.knowledgeType !== "document-reference") continue;
      let reference: unknown;
      try {
        reference = JSON.parse(change.item.content);
      } catch {
        continue;
      }
      if (!object(reference)) continue;
      const mapped =
        typeof reference.sourceItemId === "string"
          ? destinations.get(reference.sourceItemId)
          : undefined;
      if (mapped) reference.sourceItemId = mapped;
      else {
        const prior = draft.items.find(
          (item) =>
            item.id === selections[index]?.targetId &&
            item.target?.knowledgeType === "document-reference",
        );
        if (prior) {
          // Explicitly choosing a local reference chooses its local DocumentKB identity.
          try {
            reference = JSON.parse(prior.content);
          } catch {
            continue;
          }
        } else {
          // Source-project document IDs never silently resolve against the receiving project.
          reference.documentId = "unresolved-import";
          reference.sourceItemId = `unresolved-import:${randomUUID()}`;
        }
      }
      change.item.content = `${JSON.stringify(reference, null, 2)}\n`;
    }
    return await this.drafts.adopt(header, planId, changes, "import", selections);
  }
}
