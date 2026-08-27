import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { refetchAll } from "../services/api.ts";
import { selectIntent } from "../services/select-intent.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";

const HOST_SWITCH_HINT = "表示の切替はドライバー側から";

export function IntentPicker(): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  const intents = viewValue(state.intents);
  const selected = intents?.selected ?? null;
  const all = intents?.all ?? [];
  const shouldAutoOpen = intents !== null && selected === null && all.length > 0;
  const [open, setOpen] = useState(shouldAutoOpen);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shouldAutoOpen) setOpen(true);
  }, [shouldAutoOpen]);

  const hostMode = state.hostMode;
  const label = selected ?? "未選択";

  const onSelect = async (name: string): Promise<void> => {
    setError(null);
    setPending(name);
    const result = await selectIntent(name);
    setPending(null);
    if (!result.ok) {
      setError("切り替えに失敗しました");
      return;
    }
    setOpen(false);
    await refetchAll(dispatch);
  };

  return (
    <div data-testid="intent-picker">
      <Button
        type="button"
        variant="outline"
        data-testid="intent-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="intent-dialog">
          <DialogHeader>
            <DialogTitle>インテント一覧</DialogTitle>
            <DialogDescription>
              {hostMode ? HOST_SWITCH_HINT : "表示するインテントを選んでください"}
            </DialogDescription>
          </DialogHeader>
          {all.length === 0 ? (
            <p className="text-muted-foreground">インテントは見つかりませんでした。</p>
          ) : (
            <ul
              className="m-0 flex max-h-[min(50vh,20rem)] list-none flex-col gap-1 overflow-y-auto p-0"
              data-testid="intent-list"
            >
              {all.map((name) => {
                const isSelected = name === selected;
                const content = (
                  <>
                    <span aria-hidden="true">{isSelected ? "✔" : "○"}</span> {name}
                    {isSelected ? <span className="text-muted-foreground">（表示中）</span> : null}
                  </>
                );
                return (
                  <li
                    className="rounded-lg border px-3 py-2 text-sm data-[selected=true]:border-primary data-[selected=true]:bg-muted data-[selected=true]:font-semibold"
                    key={name}
                    data-selected={isSelected}
                    data-active={isSelected}
                  >
                    {hostMode ? (
                      content
                    ) : (
                      <button
                        type="button"
                        className="flex w-full items-center gap-1 text-left"
                        disabled={pending !== null}
                        onClick={() => {
                          void onSelect(name);
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {error !== null ? <p className="text-destructive">{error}</p> : null}
          {hostMode ? <p className="text-muted-foreground">{HOST_SWITCH_HINT}</p> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
