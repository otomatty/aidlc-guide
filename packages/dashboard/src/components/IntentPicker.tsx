import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppState } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";

export const INTENT_SWITCH_HINT =
  "切り替えは Claude Code で `/aidlc intent <名前>` を実行してください（この画面からは切り替えられません）。";

export function IntentPicker(): ReactNode {
  const state = useAppState();
  const intents = viewValue(state.intents);
  const active = intents?.active ?? viewValue(state.workflow)?.project ?? null;
  const all = intents?.all ?? [];
  const shouldAutoOpen =
    intents !== null && intents.active === null && all.length > 0;
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) setOpen(true);
  }, [shouldAutoOpen]);

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
        {active ?? "アクティブなし"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="intent-dialog">
          <DialogHeader>
            <DialogTitle>インテント一覧</DialogTitle>
            <DialogDescription>
              ワークスペース内のインテント一覧（読み取り専用）
            </DialogDescription>
          </DialogHeader>
          {all.length === 0 ? (
            <p className="text-muted-foreground">
              インテントは見つかりませんでした。
            </p>
          ) : (
            <ul className="intent-list" data-testid="intent-list">
              {all.map((name) => {
                const isActive = name === intents?.active;
                return (
                  <li
                    className="intent-list__item"
                    key={name}
                    data-active={isActive}
                  >
                    <span aria-hidden="true">{isActive ? "✔" : "○"}</span>{" "}
                    {name}
                    {isActive ? (
                      <span className="text-muted-foreground">
                        （アクティブ）
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-muted-foreground">{INTENT_SWITCH_HINT}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
