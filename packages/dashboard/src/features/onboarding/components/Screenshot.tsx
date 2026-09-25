import type { ReactNode } from "react";
import { ZoomInIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SHOT_HEIGHT, SHOT_WIDTH, type WelcomeShot } from "../content/welcome.ts";

/**
 * A real capture that explains a screen. It is a button that enlarges the
 * image, never a picture of controls that look clickable: the dialog repeats
 * the caption so the text is never only inside the image.
 */
export function Screenshot({ shot }: { shot: WelcomeShot }): ReactNode {
  return (
    <Dialog>
      <DialogTrigger
        render={
          // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the trigger injects the image alt and the sr-only label
          <button
            type="button"
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <img
          src={shot.src}
          alt={shot.alt}
          width={SHOT_WIDTH}
          height={SHOT_HEIGHT}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
        <span
          aria-hidden="true"
          className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-foreground shadow-sm"
        >
          <ZoomInIcon className="size-3.5" />
          拡大
        </span>
        <span className="sr-only">（拡大して表示）</span>
      </DialogTrigger>
      <DialogContent size="xl" data-testid={`screenshot-dialog-${shot.id}`}>
        <DialogHeader>
          <DialogTitle>{shot.title}</DialogTitle>
          <DialogDescription>
            {shot.where}
            {shot.what}
          </DialogDescription>
        </DialogHeader>
        <img
          src={shot.src}
          alt={shot.alt}
          width={SHOT_WIDTH}
          height={SHOT_HEIGHT}
          decoding="async"
          className="block h-auto w-full rounded-md border"
        />
      </DialogContent>
    </Dialog>
  );
}
