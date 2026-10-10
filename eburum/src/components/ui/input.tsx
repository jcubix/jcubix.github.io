import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full min-w-0 rounded-xl border border-border bg-input px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
