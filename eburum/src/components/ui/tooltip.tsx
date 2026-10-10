import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={10}
          className="z-50 max-w-60 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-foreground"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-border" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
export const TooltipProvider = TooltipPrimitive.Provider;
