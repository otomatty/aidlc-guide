import { CircleHelpIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppState, useDispatch } from "../store/context.tsx";

/** Header entry that opens the in-app usage guides route. */
export function GuidesButton(): ReactNode {
  const open = useAppState().guidesOpen;
  const dispatch = useDispatch();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            data-testid="guides-open"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="使い方"
            onClick={() => {
              dispatch({ type: "guides", open: true });
            }}
          />
        }
      >
        <CircleHelpIcon />
      </TooltipTrigger>
      <TooltipContent>使い方</TooltipContent>
    </Tooltip>
  );
}
