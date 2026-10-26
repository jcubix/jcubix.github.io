import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border border-[var(--control-border)] bg-[var(--surface-muted)] text-[var(--text)] hover:bg-[var(--surface-hover)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--text)] hover:bg-[var(--surface-hover)]",
        destructive:
          "border border-destructive bg-destructive/15 text-destructive hover:bg-destructive/25",
      },
      size: { default: "px-4 py-3", sm: "px-3 py-2", icon: "size-11 p-0" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
