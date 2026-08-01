import { BookOpenIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppState, useDispatch } from "../store/context.tsx";

/** Header entry that opens the official docs shell route. */
export function OfficialDocsButton(): ReactNode {
  const open = useAppState().docsShellOpen;
  const dispatch = useDispatch();

  return (
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
  );
}
