import type {
  CustomizationCatalog,
  CustomizationChange,
  CustomizationDraft,
  CustomizationItem,
  CustomizationMutation,
  CustomizationSaveRequest,
} from "@aidlc-guide/shared-types";
import {
  type CustomizationApi,
  CustomizationError,
  customizationRequestId,
} from "../../services/customization";

export interface DraftView {
  catalog: CustomizationCatalog | null;
  draft: CustomizationDraft | null;
  items: CustomizationItem[];
  status: "loading" | "saved" | "dirty" | "saving" | "error" | "conflict";
  error: string | null;
  dirtyIds: string[];
  remote: CustomizationDraft | null;
}

type Pending = { sequence: number; change: CustomizationChange };
const idOf = (change: CustomizationChange) =>
  change.operation === "remove" ? change.itemId : change.item.id;

/** One queue for forms and explicit proposal/import adoption, independent of page tabs. */
export class DraftController {
  private view: DraftView = {
    catalog: null,
    draft: null,
    items: [],
    status: "loading",
    error: null,
    dirtyIds: [],
    remote: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Map<string, Pending>();
  private sequence = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<CustomizationDraft> | undefined;
  private attempt: { body: CustomizationSaveRequest; pending: Pending[] } | undefined;
  private disposed = false;
  private discardAttempt: CustomizationMutation | undefined;
  private generation = 0;
  constructor(
    private readonly api: CustomizationApi,
    private readonly autosaveMs = 800,
  ) {}
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<DraftView>) {
    if (this.disposed) return;
    this.view = { ...this.view, ...patch, dirtyIds: [...this.pending.keys()] };
    for (const listener of this.listeners) listener();
  }
  private overlay(base: CustomizationItem[]) {
    const items = new Map(base.map((item) => [item.id, item]));
    for (const { change } of this.pending.values()) {
      if (change.operation === "remove") items.delete(change.itemId);
      else items.set(change.item.id, change.item);
    }
    return [...items.values()];
  }
  async load(space?: string): Promise<void> {
    const generation = ++this.generation;
    try {
      let catalog = await this.api.catalog(space);
      const draft = catalog.hostMode ? null : await this.api.draft();
      if (draft && draft.spaceId !== catalog.spaceId)
        catalog = await this.api.catalog(draft.spaceId);
      if (this.disposed || generation !== this.generation) return;
      this.publish({
        catalog,
        draft,
        items: this.overlay(draft?.items ?? catalog.items),
        status: this.pending.size ? "dirty" : "saved",
        error: null,
      });
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.publish({ status: "error", error: this.message(error) });
    }
  }
  private message(error: unknown) {
    return error instanceof Error
      ? error.message
      : "処理を完了できませんでした。入力は保持しています。";
  }
  edit(item: CustomizationItem) {
    if (this.view.catalog?.hostMode) return;
    const exists = (this.view.draft?.items ?? this.view.catalog?.items ?? []).some(
      (value) => value.id === item.id,
    );
    this.enqueue({ operation: exists ? "replace" : "create", item });
  }
  remove(itemId: string) {
    if (this.view.catalog?.hostMode) return;
    if (
      this.pending.get(itemId)?.change.operation === "create" &&
      !this.attempt?.pending.some((entry) => idOf(entry.change) === itemId)
    ) {
      // A create already sent to the server must be followed by a persisted removal.
      this.pending.delete(itemId);
      if (!this.pending.size) clearTimeout(this.timer);
      this.publish({
        items: this.overlay(this.view.draft?.items ?? this.view.catalog?.items ?? []),
        status:
          this.view.status === "conflict"
            ? "conflict"
            : this.pending.size
              ? "dirty"
              : this.saving
                ? "saving"
                : "saved",
        error: this.pending.size ? this.view.error : null,
      });
      return;
    }
    this.enqueue({ operation: "remove", itemId });
  }
  private enqueue(change: CustomizationChange) {
    this.pending.set(idOf(change), { sequence: ++this.sequence, change });
    this.publish({
      items: this.overlay(this.view.draft?.items ?? this.view.catalog?.items ?? []),
      status: this.view.status === "conflict" ? "conflict" : "dirty",
    });
    clearTimeout(this.timer);
    if (this.view.status !== "conflict")
      this.timer = setTimeout(() => {
        void this.flush().catch(() => {});
      }, this.autosaveMs);
  }
  async flush(): Promise<CustomizationDraft> {
    clearTimeout(this.timer);
    if (this.view.catalog?.hostMode)
      throw new CustomizationError("read-only-mode", "共有閲覧中は編集できません。");
    if (this.view.status === "conflict")
      throw new CustomizationError("draft-conflict", "別画面の変更と比較してから続けてください。");
    if (this.saving) {
      await this.saving;
      return this.pending.size ? this.flush() : this.requireDraft();
    }
    if (!this.pending.size && this.view.draft) return this.view.draft;
    if (!this.view.catalog) throw new Error("設定を読み込んでから編集してください。");
    this.generation++;
    const run = async () => {
      while (this.pending.size || !this.view.draft || this.attempt) {
        const draft = this.view.draft;
        const attempt = this.attempt ?? {
          body: {
            requestId: customizationRequestId(),
            ...(draft ? { draftId: draft.id } : {}),
            expectedDraftRevision: draft?.revision ?? 0,
            spaceId: this.view.catalog?.spaceId,
            changes: [...this.pending.values()].map((value) => value.change),
          },
          pending: [...this.pending.values()],
        };
        this.attempt = attempt;
        this.publish({ status: "saving", error: null });
        try {
          const saved = await this.api.save(attempt.body);
          for (const sent of attempt.pending) {
            const id = idOf(sent.change);
            if (this.pending.get(id)?.sequence === sent.sequence) this.pending.delete(id);
          }
          this.attempt = undefined;
          this.publish({
            draft: saved,
            items: this.overlay(saved.items),
            status: this.pending.size ? "dirty" : "saved",
            error: null,
          });
        } catch (error) {
          if (error instanceof CustomizationError && error.reason === "request-already-completed") {
            const receipt = await this.api.request(attempt.body.requestId);
            if (receipt?.status === "completed") {
              for (const sent of attempt.pending)
                if (this.pending.get(idOf(sent.change))?.sequence === sent.sequence)
                  this.pending.delete(idOf(sent.change));
              this.attempt = undefined;
              const current = receipt.currentDraft ?? null;
              this.publish({
                draft: current,
                remote: current,
                items: this.overlay(current?.items ?? this.view.catalog?.items ?? []),
                status: this.pending.size ? "conflict" : "saved",
                error: this.pending.size
                  ? "前の保存は完了しています。その後の別画面の変更と、自分の追加の入力を比較してください。"
                  : null,
              });
              if (this.pending.size)
                throw new CustomizationError(
                  "draft-conflict",
                  "保存後に下書きが変わりました。自分の追加の入力を残して比較してください。",
                );
              continue;
            }
          }
          const conflict =
            error instanceof CustomizationError &&
            (error.reason === "draft-conflict" || error.reason === "configuration-changed");
          // A known rejection may be retried with fresh input. An uncertain response
          // keeps the exact request ID and body until its outcome is established.
          if (
            error instanceof CustomizationError &&
            error.reason !== "response-unknown" &&
            error.reason !== "unavailable"
          )
            this.attempt = undefined;
          this.publish({ status: conflict ? "conflict" : "error", error: this.message(error) });
          throw error;
        }
      }
      return this.requireDraft();
    };
    this.saving = run();
    try {
      return await this.saving;
    } finally {
      this.saving = undefined;
    }
  }
  private requireDraft() {
    if (!this.view.draft) throw new Error("下書きが見つかりません。");
    return this.view.draft;
  }
  async refresh(): Promise<void> {
    if (!this.view.catalog || this.view.catalog.hostMode || this.saving || this.attempt) return;
    const generation = this.generation;
    const [remote, catalog] = await Promise.all([
      this.api.draft(),
      this.api.catalog(this.view.draft?.spaceId ?? this.view.catalog.spaceId),
    ]);
    if (this.disposed || generation !== this.generation || this.saving || this.attempt) return;
    if (
      remote?.id === this.view.draft?.id &&
      remote &&
      this.view.draft &&
      remote.revision < this.view.draft.revision
    )
      return;
    if (catalog.configurationRevision !== this.view.catalog.configurationRevision)
      this.publish({ catalog, ...(!remote && !this.pending.size ? { items: catalog.items } : {}) });
    if (remote?.id === this.view.draft?.id && remote?.revision === this.view.draft?.revision)
      return;
    if (this.pending.size) {
      this.publish({
        remote,
        status: "conflict",
        error: "別の画面で下書きが更新されました。自分の入力を残して比較できます。",
      });
      return;
    }
    this.acceptDraft(remote);
  }
  async compare(): Promise<CustomizationDraft | null> {
    const remote = await this.api.draft();
    this.publish({ remote, status: "conflict" });
    return remote;
  }
  async resolveConflict(keepIds: Set<string>): Promise<void> {
    if (this.saving || this.attempt)
      throw new Error("保存結果を確認してから競合を解消してください。");
    const remote = await this.api.draft();
    for (const [id] of this.pending) if (!keepIds.has(id)) this.pending.delete(id);
    const baseItems = remote?.items ?? this.view.catalog?.items ?? [];
    // An item newly introduced in the other view must now be replaced, not created.
    for (const pending of this.pending.values())
      if (pending.change.operation !== "remove")
        pending.change.operation = baseItems.some((item) => item.id === idOf(pending.change))
          ? "replace"
          : "create";
    this.publish({
      draft: remote,
      remote: null,
      items: this.overlay(baseItems),
      status: this.pending.size ? "dirty" : "saved",
      error: null,
    });
    if (this.pending.size) await this.flush();
  }
  acceptDraft(draft: CustomizationDraft | null) {
    if (this.pending.size || this.saving)
      throw new Error("未保存の変更があります。保存を完了してから続けてください。");
    this.generation++;
    this.publish({
      draft,
      items: draft?.items ?? this.view.catalog?.items ?? [],
      status: "saved",
      error: null,
      remote: null,
    });
  }
  async discard(): Promise<void> {
    clearTimeout(this.timer);
    if (this.saving) await this.saving;
    if (this.attempt)
      throw new Error("保存結果が不明です。同じ操作の結果を再確認してから破棄してください。");
    const draft = await this.api.draft();
    if (draft && !this.discardAttempt)
      this.discardAttempt = {
        requestId: customizationRequestId(),
        draftId: draft.id,
        expectedDraftRevision: draft.revision,
      };
    if (this.discardAttempt) {
      const request = this.discardAttempt;
      try {
        await this.api.discard(request);
        this.discardAttempt = undefined;
      } catch (error) {
        if (error instanceof CustomizationError && error.reason === "request-already-completed") {
          const receipt = await this.api.request(request.requestId);
          if (receipt?.status !== "completed") throw error;
          this.discardAttempt = undefined;
          this.pending.clear();
          this.acceptDraft(receipt.currentDraft ?? null);
          return;
        }
        if (
          error instanceof CustomizationError &&
          !["response-unknown", "unavailable"].includes(error.reason)
        )
          this.discardAttempt = undefined;
        throw error;
      }
    }
    this.pending.clear();
    this.publish({
      draft: null,
      items: this.view.catalog?.items ?? [],
      status: "saved",
      error: null,
      remote: null,
    });
  }
  activate() {
    this.disposed = false;
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    clearTimeout(this.timer);
    this.listeners.clear();
  }
}
