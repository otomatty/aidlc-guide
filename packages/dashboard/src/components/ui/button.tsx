import {
  type ButtonSize,
  type ButtonVariant,
  type IconButtonVariant,
  Button as M3Button,
  IconButton as M3IconButton,
} from "@m3-baseui/react-tailwind";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Legacy shadcn-oriented variants used across the dashboard. */
type LegacyVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type LegacySize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const VARIANT_MAP: Record<LegacyVariant, ButtonVariant> = {
  default: "filled",
  secondary: "tonal",
  outline: "outlined",
  ghost: "text",
  destructive: "filled",
  link: "text",
};

const ICON_VARIANT_MAP: Record<LegacyVariant, IconButtonVariant> = {
  default: "filled",
  secondary: "tonal",
  outline: "outlined",
  ghost: "standard",
  destructive: "filled",
  link: "standard",
};

const SIZE_MAP: Record<"default" | "xs" | "sm" | "lg", ButtonSize> = {
  default: "s",
  xs: "xs",
  sm: "xs",
  lg: "m",
};

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  variant?: LegacyVariant;
  size?: LegacySize;
  className?: string;
  children?: ReactNode;
};

/**
 * Compatibility Button: keeps existing call sites, renders M3 Button / IconButton.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "default", children, type = "button", ...props },
  ref,
): ReactNode {
  const isIcon = size.startsWith("icon");

  // Ripple injects a <style> into the button; keep textContent = label for a11y tests.
  if (isIcon) {
    return (
      <M3IconButton
        ref={ref}
        type={type}
        variant={ICON_VARIANT_MAP[variant]}
        ripple={false}
        data-slot="button"
        className={cn(variant === "destructive" && "bg-error text-on-error", className)}
        {...props}
      >
        {children}
      </M3IconButton>
    );
  }

  return (
    <M3Button
      ref={ref}
      type={type}
      variant={VARIANT_MAP[variant]}
      size={SIZE_MAP[size as keyof typeof SIZE_MAP] ?? "s"}
      ripple={false}
      data-slot="button"
      className={cn(
        variant === "link" && "underline underline-offset-4",
        variant === "destructive" && "bg-error text-on-error",
        className,
      )}
      {...props}
    >
      {children}
    </M3Button>
  );
});

/** @deprecated Prefer M3 variants directly; kept for existing cva imports. */
export const buttonVariants = (): string => "";
