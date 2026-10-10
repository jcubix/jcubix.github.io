import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-background/85" />
        <DialogPrimitive.Content className="modern-dialog fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh_-_32px)] w-[calc(100%_-_32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-popover p-5 text-foreground sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-xl font-bold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="secondary" size="icon" aria-label="Chiudi">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="mb-6 mt-2 text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
