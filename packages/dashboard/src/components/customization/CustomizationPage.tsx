import type {
  CustomizationDiagnostic,
  CustomizationDraft,
  CustomizationImportPlan,
  CustomizationImportSelection,
  CustomizationItem,
  CustomizationKind,
  CustomizationOperation,
  CustomizationPlan,
  CustomizationProposal,
} from "@aidlc-guide/shared-types";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import {
  CustomizationError,
  customizationApi,
  customizationRequestId,
  downloadCustomization,
} from "../../services/customization";
import { AiPanel } from "./AiPanel";
import { DraftController } from "./draft-controller";
import { ItemEditor } from "./ItemEditor";
import { ExportDialog, type ExportSelection, ImportDialog } from "./PackageDialogs";
import { Diagnostics, itemChanges, ReviewPanel } from "./ReviewPanel";
import {
  CATEGORIES,
  type Category,
  categoryOf,
  createItem,
  itemLocation,
  KIND_LABELS,
} from "./source-fields";
import { useCustomizationAi } from "./useCustomizationAi";

const STATUS = {
  loading: "読み込み中",
  saved: "下書き保存済み",
  dirty: "未保存の変更",
  saving: "保存中…",
  error: "保存を確認してください",
  conflict: "別画面の変更と比較が必要",
};
const mutation = (draft: CustomizationDraft) => ({
  requestId: customizationRequestId(),
  draftId: draft.id,
  expectedDraftRevision: draft.revision,
});

export default function CustomizationPage({
  open,
  hostMode,
  refreshVersion = 0,
  scrollContainer,
  onSettings,
}: {
  open: boolean;
  hostMode: boolean;
  refreshVersion?: number;
  scrollContainer?: RefObject<HTMLDivElement | null>;
  onSettings?: () => void;
}) {
  const [controller] = useState(() => new DraftController(customizationApi));
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [category, setCategory] = useState<Category>("rules");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<CustomizationKind>("rule-section");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("edit");
  const tabScroll = useRef<Record<string, number>>({ edit: 0, ai: 0 });
  const [width, setWidth] = useState(760);
  const container = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const retry = useRef<(() => Promise<void>) | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [plan, setPlan] = useState<CustomizationPlan | null>(null);
  const [operation, setOperation] = useState<CustomizationOperation | null>(null);
  const [importPlan, setImportPlan] = useState<CustomizationImportPlan | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirm, setConfirm] = useState<"discard" | "remove" | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [configurationCompare, setConfigurationCompare] = useState(false);
  const [keepIds, setKeepIds] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<CustomizationDiagnostic[]>([]);
  const [lastAdopted, setLastAdopted] = useState<{ id: string; revision: number } | null>(null);
  const readOnly = hostMode || view.catalog?.hostMode === true;
  const narrow = width < 760;
  function selectTab(value: unknown) {
    const next = String(value);
    if (narrow && scrollContainer?.current)
      tabScroll.current[tab] = scrollContainer.current.scrollTop;
    setTab(next);
  }
  useLayoutEffect(() => {
    if (narrow && scrollContainer?.current)
      scrollContainer.current.scrollTop = tabScroll.current[tab] ?? 0;
  }, [narrow, tab, scrollContainer]);
  const sidebar = width >= 1040;
  const dirty = view.dirtyIds.length > 0 || view.status === "saving";
  const applying = operation?.status === "running";
  const disabled = readOnly || busy || uncertain || applying;
  const flush = useCallback(() => controller.flush(), [controller]);
  const ai = useCustomizationAi(view.draft, open, readOnly, flush);
  const categoryItems = view.items.filter((item) => categoryOf(item.kind) === category);
  const filtered = categoryItems.filter((item) =>
    `${item.title} ${item.runtimeId ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const changed = itemChanges(view.draft?.baseItems ?? view.catalog?.items ?? [], view.items);
  const configurationChanged = Boolean(
    view.draft &&
      view.catalog &&
      view.draft.baseConfigurationRevision !== view.catalog.configurationRevision,
  );
  const compareIds = configurationCompare
    ? itemChanges(view.items, view.catalog?.items ?? [])
    : view.dirtyIds;
  const compareItems = configurationCompare ? view.catalog?.items : view.remote?.items;

  useEffect(() => {
    controller.activate();
    void controller.load();
    return () => controller.dispose();
  }, [controller]);
  useEffect(() => {
    if (readOnly) return;
    let live = true;
    void customizationApi
      .pendingOperation()
      .then((value) => {
        if (live && value) setOperation(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [readOnly]);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect.width;
      if (size && size > 0) setWidth(size);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the shared socket's change/reconnect revision triggers a refresh.
  useEffect(() => {
    if (!open || busy || applying || uncertain) return;
    let live = true;
    let pending = false;
    const refresh = () => {
      if (pending || busyRef.current) return;
      pending = true;
      void controller
        .refresh()
        .then(() => {
          if (live) setRefreshError(null);
        })
        .catch((cause) => {
          if (live)
            setRefreshError(cause instanceof Error ? cause.message : "下書きを再確認できません。");
        })
        .finally(() => {
          pending = false;
        });
    };
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 10000);
    refresh();
    return () => {
      live = false;
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [open, controller, refreshVersion, busy, applying, uncertain]);
  const operationId = operation?.status === "running" ? operation.id : null;
  useEffect(() => {
    if (!operationId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await customizationApi.operation(operationId);
        if (!live) return;
        setOperation(next);
        if (next.status === "running") timer = setTimeout(() => void poll(), 750);
        else if (next.status === "completed") {
          setNotice("設定を適用しました。");
          await controller.load();
        }
      } catch (cause) {
        if (live) {
          setError(cause instanceof Error ? cause.message : "適用結果を確認できません。");
          timer = setTimeout(() => void poll(), 3000);
        }
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [operationId, controller]);

  async function run(task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setRefreshError(null);
    setNotice(null);
    try {
      await task();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "処理を完了できませんでした。入力は保持しています。",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  // Store the exact request closure before sending, including its ID and revision.
  async function reliable<T>(
    request: () => Promise<T>,
    accept: (value: T) => void | Promise<void>,
  ) {
    const perform = async () => {
      try {
        const value = await request();
        retry.current = null;
        setUncertain(false);
        await accept(value);
      } catch (cause) {
        if (
          cause instanceof CustomizationError &&
          cause.reason === "request-already-completed" &&
          cause.requestId
        ) {
          const receipt = await customizationApi.request(cause.requestId);
          if (receipt?.status === "completed") {
            if (receipt.operation) setOperation(receipt.operation);
            await controller.refresh();
            retry.current = null;
            setUncertain(false);
            setNotice(
              `この操作は下書き ${receipt.draftRevision ?? ""} で完了しています。最新の内容を表示しました。`,
            );
            return;
          }
        }
        if (
          !(cause instanceof CustomizationError) ||
          ["response-unknown", "unavailable"].includes(cause.reason)
        ) {
          retry.current = perform;
          setUncertain(true);
        } else {
          retry.current = null;
          setUncertain(false);
        }
        throw cause;
      }
    };
    await perform();
  }
  function chooseCategory(value: Category) {
    setCategory(value);
    setSearch("");
    setNewKind(CATEGORIES.find((entry) => entry.id === value)?.kinds[0] ?? "rule-section");
  }
  function show(id: string) {
    const item = view.items.find((value) => value.id === id);
    if (item) {
      chooseCategory(categoryOf(item.kind));
      setSelectedId(id);
      setTab("edit");
      setPlan(null);
    }
  }
  function add() {
    if (!view.catalog || disabled) return;
    const item = createItem(
      newKind,
      view.draft?.spaceId ?? view.catalog.spaceId,
      view.items.find((value) => value.kind === "plugin")?.runtimeId,
    );
    controller.edit(item);
    setSelectedId(item.id);
    setSearch("");
  }
  async function review() {
    const saved = await flush();
    setDiagnostics([]);
    setOperation(null);
    setPlan(await customizationApi.plan(mutation(saved)));
  }
  async function apply() {
    if (!plan) return;
    const saved = await flush();
    if (saved.id !== plan.draftId || saved.revision !== plan.draftRevision)
      throw new Error("下書きが変わりました。変更を確認し直してください。");
    const body = {
      ...mutation(saved),
      planId: plan.id,
      configurationRevision: plan.configurationRevision,
    };
    await reliable(
      () => customizationApi.apply(body),
      async (value) => {
        setOperation(value);
        if (value.status === "completed") {
          await controller.load();
          setNotice("設定を適用しました。");
        }
      },
    );
  }
  async function importFile(file: File) {
    if (file.size > 25 * 1024 * 1024) throw new Error("設定ファイルは25 MB以下にしてください。");
    const text = await file.text();
    let content: unknown;
    try {
      content = JSON.parse(text);
    } catch {
      throw new Error(
        "設定ファイルのJSONを読み取れません。Guideから書き出した有効なJSONファイルを選択してください。",
      );
    }
    const saved = await flush();
    setImportPlan(await customizationApi.importAnalyze({ ...mutation(saved), package: content }));
  }
  async function importAdopt(selections: CustomizationImportSelection[]) {
    if (!importPlan) return;
    const saved = await flush();
    if (saved.id !== importPlan.draftId || saved.revision !== importPlan.draftRevision)
      throw new Error("下書きが変わりました。ファイルを読み込み直してください。");
    const body = { ...mutation(saved), planId: importPlan.id, selections };
    await reliable(
      () => customizationApi.importAdopt(body),
      (value) => {
        controller.acceptDraft(value);
        setImportPlan(null);
        setNotice(`${selections.length}項目を下書きへ取り込みました。`);
      },
    );
  }
  async function exportFile(selection: ExportSelection) {
    const saved = await flush();
    const body = { ...mutation(saved), ...selection };
    await reliable(
      () => customizationApi.export(body),
      (file) => {
        downloadCustomization(file);
        setDiagnostics(file.diagnostics);
        setExportOpen(false);
        setNotice(`${file.filename}を書き出しました。`);
      },
    );
  }
  async function adopt(proposal: CustomizationProposal) {
    const saved = await flush();
    if (saved.id !== proposal.draftId || saved.revision !== proposal.draftRevision)
      throw new Error("提案後に下書きが変わりました。現在の内容から再提案してください。");
    const body = { ...mutation(saved), proposalId: proposal.id };
    await reliable(
      () => customizationApi.adopt(body),
      (value) => {
        controller.acceptDraft(value);
        setLastAdopted({ id: proposal.id, revision: value.revision });
        setNotice("AIの提案を下書きへ取り込みました。適用前に編集できます。");
      },
    );
  }
  async function undo() {
    if (!lastAdopted) return;
    const saved = await flush();
    if (saved.revision !== lastAdopted.revision)
      throw new Error("採用後に編集されています。項目ごとの「変更前に戻す」を使ってください。");
    const body = { ...mutation(saved), operationId: lastAdopted.id };
    await reliable(
      () => customizationApi.undo(body),
      (value) => {
        controller.acceptDraft(value);
        setLastAdopted(null);
      },
    );
  }
  async function addDocument(file: File) {
    if (!view.catalog) return;
    if (file.size > 10 * 1024 * 1024) throw new Error("文書原本は10 MB以下にしてください。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    let raw = "";
    for (let index = 0; index < bytes.length; index += 8192)
      raw += String.fromCharCode(...bytes.subarray(index, index + 8192));
    const item: CustomizationItem = {
      ...createItem("knowledge", view.draft?.spaceId ?? view.catalog.spaceId),
      title: file.name,
      target: { knowledgeType: "document-source", filename: file.name, audience: "all" },
      binary: {
        base64: btoa(raw),
        bytes: file.size,
        sha256: Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
        mimeType: file.type || "application/octet-stream",
      },
    };
    controller.edit(item);
    setSelectedId(item.id);
    setSearch("");
  }

  return (
    <div
      ref={container}
      className="flex min-w-0 flex-col gap-5 p-4"
      data-testid="customization-page"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">カスタマイズ</h1>
            <p className="text-sm text-muted-foreground">
              開発ルールや工程を下書きで整え、変更を確認して適用します。
            </p>
          </div>
          <Badge variant="outline">
            {readOnly
              ? "共有閲覧"
              : view.draft
                ? STATUS[view.status]
                : view.status === "saved"
                  ? "現在の設定"
                  : STATUS[view.status]}
          </Badge>
        </div>
        {view.catalog ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{view.catalog.workspaceName}</span>
            <Field orientation="horizontal" className="w-auto">
              <FieldLabel htmlFor="customization-space">対象スペース</FieldLabel>
              <NativeSelect
                id="customization-space"
                value={view.draft?.spaceId ?? view.catalog.spaceId}
                disabled={disabled || Boolean(view.draft) || dirty}
                onChange={(event) => void run(() => controller.load(event.target.value))}
              >
                {view.catalog.spaces.map((space) => (
                  <NativeSelectOption key={space} value={space}>
                    {space}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {view.draft ? (
              <span className="text-xs text-muted-foreground">
                下書き {view.draft.revision} · {changed.length}項目の変更
              </span>
            ) : null}
          </div>
        ) : null}
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={disabled || !view.catalog}
              onClick={() =>
                void run(async () => {
                  await flush();
                })
              }
            >
              下書きを保存
            </Button>
            <Button disabled={disabled || !view.catalog} onClick={() => void run(review)}>
              変更を確認
            </Button>
            <Button
              variant="outline"
              disabled={disabled || !view.catalog}
              onClick={() => importInput.current?.click()}
            >
              読み込む
            </Button>
            <Button
              variant="outline"
              disabled={disabled || !view.catalog}
              onClick={() => {
                setError(null);
                setExportOpen(true);
              }}
            >
              書き出す
            </Button>
            <Button
              variant="ghost"
              disabled={disabled || (!view.draft && !dirty)}
              onClick={() => setConfirm("discard")}
            >
              下書きを破棄
            </Button>
            {lastAdopted && view.draft?.revision === lastAdopted.revision && !dirty ? (
              <Button variant="ghost" disabled={disabled} onClick={() => void run(undo)}>
                直前のAI採用を取り消す
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>
      <input
        ref={importInput}
        type="file"
        accept=".json,.aidlc-guide.json"
        className="hidden"
        aria-label="Guide設定ファイル"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void run(() => importFile(file));
        }}
      />
      <input
        ref={documentInput}
        type="file"
        accept=".pdf,.docx,.md,.txt"
        className="hidden"
        aria-label="文書原本"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void run(() => addDocument(file));
        }}
      />
      {readOnly ? (
        <Alert>
          <AlertDescription>
            共有用ブラウザでは現在の設定を閲覧できます。編集とAIへの依頼はローカルのGuideから行ってください。
          </AlertDescription>
        </Alert>
      ) : null}
      {view.catalog && !view.catalog.capabilities.available ? (
        <Alert>
          <AlertDescription>
            <p>
              {view.catalog.capabilities.reason ?? "対応するワークフローエンジンを確認できません。"}
            </p>
            {onSettings ? (
              <Button variant="outline" onClick={onSettings}>
                設定を開く
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {error || view.error || refreshError ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{error ?? view.error ?? refreshError}</p>
            {uncertain ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const task = retry.current;
                  if (task) void run(task);
                }}
              >
                同じ操作の受付を再確認
              </Button>
            ) : view.status === "error" && view.catalog ? (
              <Button
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    await flush();
                  })
                }
              >
                保存を再確認
              </Button>
            ) : !view.catalog ? (
              <Button variant="outline" onClick={() => void run(() => controller.load())}>
                再読み込み
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
      {configurationChanged ? (
        <Alert>
          <AlertDescription>
            <p>
              下書きの作成後に、適用済みの設定が更新されました。現在の設定と比較してから適用してください。
            </p>
            <Button
              variant="outline"
              disabled={disabled || view.status === "conflict"}
              onClick={() =>
                void run(async () => {
                  await flush();
                  await controller.refresh();
                  setConfigurationCompare(true);
                  setKeepIds(changed);
                  setConflictOpen(true);
                })
              }
            >
              現在の設定と比較する
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {operation?.recoveryRequired ? (
        <Alert>
          <AlertDescription>
            <p>{operation.message ?? "中断した適用の結果を確認してください。"}</p>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await customizationApi.recover(operation.id);
                  setOperation(next);
                  if (next.status === "completed") await controller.load();
                })
              }
            >
              適用結果を確認・復旧
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {view.status === "conflict" ? (
        <Alert>
          <AlertDescription>
            <p>別画面の変更を読み直し、自分の入力を残す項目を選んでください。</p>
            <Button
              variant="outline"
              onClick={() =>
                void run(async () => {
                  await controller.compare();
                  setConfigurationCompare(false);
                  setKeepIds([...view.dirtyIds]);
                  setConflictOpen(true);
                })
              }
            >
              変更を比較する
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <Diagnostics
        diagnostics={[...(view.catalog?.diagnostics ?? []), ...diagnostics]}
        onShow={show}
      />
      {!sidebar ? (
        <Field>
          <FieldLabel htmlFor="customization-category">カテゴリ</FieldLabel>
          <NativeSelect
            id="customization-category"
            value={category}
            onChange={(event) => chooseCategory(event.target.value as Category)}
          >
            {CATEGORIES.map((entry) => (
              <NativeSelectOption key={entry.id} value={entry.id}>
                {entry.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      <Tabs
        value={tab}
        onValueChange={selectTab}
        className={
          sidebar
            ? "grid min-w-0 grid-cols-[160px_minmax(0,1fr)_320px] items-start gap-4"
            : !narrow && !readOnly
              ? "grid min-w-0 grid-cols-[minmax(0,1fr)_320px] items-start gap-4"
              : "flex min-w-0 flex-col gap-4"
        }
      >
        {sidebar ? (
          <nav aria-label="カスタマイズのカテゴリ" className="flex flex-col gap-1">
            {CATEGORIES.map((entry) => (
              <Button
                key={entry.id}
                variant={category === entry.id ? "secondary" : "ghost"}
                className="justify-start"
                aria-current={category === entry.id ? "page" : undefined}
                onClick={() => chooseCategory(entry.id)}
              >
                {entry.label}
              </Button>
            ))}
          </nav>
        ) : null}
        <TabsList
          hidden={!narrow || readOnly}
          style={!narrow || readOnly ? { display: "none" } : undefined}
          aria-label="カスタマイズの表示"
        >
          <TabsTrigger value="edit">編集</TabsTrigger>
          <TabsTrigger value="ai">AIチャット</TabsTrigger>
        </TabsList>
        <TabsPanel
          value="edit"
          keepMounted
          hidden={narrow && tab !== "edit" && !readOnly}
          inert={narrow && tab !== "edit" && !readOnly}
          className="min-w-0 w-full"
        >
          <div className="flex flex-col gap-4">
            <h2 className="font-medium">
              {CATEGORIES.find((entry) => entry.id === category)?.label}
            </h2>
            <Field>
              <FieldLabel htmlFor="customization-search">項目を探す</FieldLabel>
              <Input
                id="customization-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="表示名・識別子"
              />
            </Field>
            {!readOnly ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field className="min-w-36 flex-1">
                  <FieldLabel htmlFor="customization-new-kind">追加する項目</FieldLabel>
                  <NativeSelect
                    id="customization-new-kind"
                    value={newKind}
                    onChange={(event) => setNewKind(event.target.value as CustomizationKind)}
                  >
                    {CATEGORIES.find((entry) => entry.id === category)?.kinds.map((kind) => (
                      <NativeSelectOption key={kind} value={kind}>
                        {KIND_LABELS[kind]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Button variant="outline" disabled={disabled || !view.catalog} onClick={add}>
                  追加
                </Button>
                {category === "knowledge" ? (
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={() => documentInput.current?.click()}
                  >
                    文書を追加
                  </Button>
                ) : null}
              </div>
            ) : null}
            {filtered.length ? (
              <Field>
                <FieldLabel htmlFor="customization-item">
                  編集する項目（{filtered.length}件）
                </FieldLabel>
                <NativeSelect
                  id="customization-item"
                  value={selected?.id ?? ""}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {filtered.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {changed.includes(item.id) ? "● " : ""}
                      {item.title} · {itemLocation(item)} · {KIND_LABELS[item.kind]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ) : (
              <p className="text-sm text-muted-foreground">
                {search
                  ? "検索に一致する項目はありません。"
                  : "このカテゴリの設定はまだありません。"}
              </p>
            )}
            {selected ? (
              <ItemEditor
                key={selected.id}
                item={selected}
                items={view.items}
                disabled={disabled}
                diagnostics={diagnostics}
                onChange={(item) => controller.edit(item)}
                onReset={() => {
                  const original = (view.draft?.baseItems ?? view.catalog?.items ?? []).find(
                    (item) => item.id === selected.id,
                  );
                  if (original) controller.edit(original);
                  else controller.remove(selected.id);
                }}
                onRemove={() => {
                  if (selected.owner === "core" && selected.originalContent !== undefined)
                    controller.edit({ ...selected, content: selected.originalContent });
                  else setConfirm("remove");
                }}
              />
            ) : null}
          </div>
        </TabsPanel>
        <TabsPanel
          value="ai"
          keepMounted
          hidden={readOnly || (narrow && tab !== "ai")}
          inert={readOnly || (narrow && tab !== "ai")}
          className="min-w-0 w-full rounded-lg border bg-card p-4"
        >
          {!readOnly ? (
            <AiPanel
              ai={ai}
              draft={view.draft}
              items={view.items}
              configurationRevision={view.catalog?.configurationRevision}
              selectedId={selected?.id ?? null}
              dirty={dirty}
              busy={disabled || view.status === "conflict"}
              onAdopt={(proposal) => void run(() => adopt(proposal))}
              onShow={show}
            />
          ) : null}
        </TabsPanel>
      </Tabs>
      <ReviewPanel
        plan={plan}
        draft={view.draft}
        dirty={dirty}
        operation={operation}
        busy={busy || uncertain}
        error={error}
        onClose={() => setPlan(null)}
        onApply={() => void run(apply)}
        onShow={show}
      />
      <ImportDialog
        key={importPlan?.id ?? "no-import"}
        plan={importPlan}
        items={view.items}
        draft={view.draft}
        dirty={dirty}
        busy={busy || uncertain}
        error={error}
        onClose={() => setImportPlan(null)}
        onAdopt={(selections) => void run(() => importAdopt(selections))}
      />
      <ExportDialog
        open={exportOpen}
        items={view.items}
        busy={busy || uncertain}
        error={error}
        onClose={() => setExportOpen(false)}
        onExport={(selection) => void run(() => exportFile(selection))}
      />
      <Dialog
        open={confirm !== null}
        onOpenChange={(value) => {
          if (!value) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "discard" ? "下書きを破棄しますか？" : "この項目を削除予定にしますか？"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "discard"
                ? "保存済みと未保存の下書きの変更を破棄します。適用済みの設定は残ります。"
                : `${selected?.title ?? "選択項目"}を下書きから除きます。現在の設定からの削除は適用時に行います。`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              戻る
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (confirm === "discard") await controller.discard();
                  else if (selected) controller.remove(selected.id);
                  setConfirm(null);
                })
              }
            >
              {confirm === "discard" ? "下書きを破棄する" : "削除予定にする"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {configurationCompare ? "現在の設定と比較" : "別画面の変更と比較"}
            </DialogTitle>
            <DialogDescription>
              チェックした項目は自分の入力を残します。その他は比較先の保存された内容を使います。
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {compareIds.map((id) => (
              <div key={id} className="flex flex-col gap-2">
                <Field orientation="horizontal">
                  <Checkbox
                    id={`conflict-${id}`}
                    checked={keepIds.includes(id)}
                    onCheckedChange={(checked) =>
                      setKeepIds((values) =>
                        checked ? [...values, id] : values.filter((value) => value !== id),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`conflict-${id}`}>
                    {view.items.find((item) => item.id === id)?.title ?? "削除した項目"}{" "}
                    の入力を残す
                  </FieldLabel>
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p>{configurationCompare ? "現在の設定" : "別画面の保存内容"}</p>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs">
                      {compareItems?.find((item) => item.id === id)?.content ?? "（項目なし）"}
                    </pre>
                  </div>
                  <div>
                    <p>自分の入力</p>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs">
                      {view.items.find((item) => item.id === id)?.content ?? "（削除）"}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </FieldGroup>
          {error ? <p role="alert">{error}</p> : null}
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (configurationCompare) {
                  const saved = await flush();
                  const body = {
                    ...mutation(saved),
                    choices: compareIds.map((itemId) => ({
                      itemId,
                      choice: keepIds.includes(itemId) ? ("draft" as const) : ("current" as const),
                    })),
                  };
                  await reliable(
                    () => customizationApi.reconcile(body),
                    (value) => controller.acceptDraft(value),
                  );
                } else await controller.resolveConflict(new Set(keepIds));
                setConflictOpen(false);
              })
            }
          >
            選んだ内容で編集を続ける
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
