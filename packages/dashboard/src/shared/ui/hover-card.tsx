import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

const hoverCardTriggerVariants = cva("", {
  variants: {
    variant: {
      default: "",
      explain:
        "flex min-w-0 cursor-help flex-col gap-1 rounded-sm border border-dashed border-transparent px-1 py-0.5 text-left wrap-anywhere hover:border-border hover:bg-muted focus-visible:border-border focus-visible:bg-muted focus-visible:outline-none",
    },
  },
  defaultVariants: { variant: "default" },
});

function HoverCardTrigger({
  className,
  variant,
  ...props
}: PreviewCardPrimitive.Trigger.Props & VariantProps<typeof hoverCardTriggerVariants>) {
  return (
    <PreviewCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      className={
        typeof className === "function"
          ? (state) => cn(hoverCardTriggerVariants({ variant }), className(state))
          : cn(hoverCardTriggerVariants({ variant }), className)
      }
      {...props}
    />
  );
}

function HoverCardContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 4,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<PreviewCardPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "z-50 w-64 max-w-viewport-gutter origin-(--transform-origin) rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
