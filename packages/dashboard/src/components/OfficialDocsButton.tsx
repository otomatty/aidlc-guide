import { BookOpenIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { inVsCodeWebview, vsCodeApi } from "../services/vscode-api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";

/** Header entry that opens the official docs shell route. */
export function OfficialDocsButton(): ReactNode {
  const { docsShellOpen: open, officialDocsLocale: locale } = useAppState();
  const dispatch = useDispatch();

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              data-testid="official-docs-open"
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label="Official Docs"
              onClick={() => {
                dispatch({ type: "docs-shell", open: true });
              }}
            />
          }
        >
          <BookOpenIcon />
        </TooltipTrigger>
        <TooltipContent>Official Docs</TooltipContent>
      </Tooltip>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="aidlc-workflows の更新履歴"
        onClick={() => {
          dispatch({
            type: "docs-shell",
            open: true,
            locale,
            path: "overview/release-highlights.md",
          });
        }}
      >
        更新履歴
      </Button>
      {inVsCodeWebview() ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="check-update"
          onClick={() => {
            vsCodeApi()?.postMessage({ type: "check-update" });
          }}
        >
          更新を確認
        </Button>
      ) : null}
    </>
  );
}
