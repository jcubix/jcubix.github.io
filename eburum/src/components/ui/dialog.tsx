import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./button";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  role = "dialog",
  onCloseAutoFocus,
  className = "",
  closeLabel = "Chiudi",
  titleId,
  closeId,
  dirty = false,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  role?: "dialog" | "alertdialog";
  onCloseAutoFocus?: (event: Event) => void;
  className?: string;
  closeLabel?: string;
  titleId?: string;
  closeId?: string;
  dirty?: boolean;
  busy?: boolean;
}) {
  const [viewport, setViewport] = useState<{ height: number; top: number }>();
  useEffect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    const resize = () =>
      setViewport({
        height: visual?.height ?? window.innerHeight,
        top: visual?.offsetTop ?? 0,
      });
    resize();
    visual?.addEventListener("resize", resize);
    visual?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      visual?.removeEventListener("resize", resize);
      visual?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modern-dialog-overlay fixed inset-0 z-40 bg-background/85" />
        {/* Content owns the positioner so its exit can finish before unmounting. */}
        <DialogPrimitive.Content
          role={role}
          onOpenAutoFocus={(event) => {
            const target = (
              event.currentTarget as HTMLElement
            ).querySelector<HTMLElement>("[data-autofocus]");
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          {...(titleId ? { "aria-labelledby": titleId } : {})}
          onCloseAutoFocus={onCloseAutoFocus}
          className="modern-dialog-viewport"
          style={{
            pointerEvents: "none",
            ...(viewport && { top: viewport.top, height: viewport.height }),
          }}
        >
          <div
            data-state={open ? "open" : "closed"}
            data-dirty={dirty}
            aria-busy={busy}
            className={
              "modern-dialog z-50 max-h-full w-full max-w-xl overflow-y-auto rounded-[var(--radius-card)] border border-border bg-popover p-5 text-foreground sm:p-7 " +
              className
            }
          >
            <div className="modern-dialog-head flex items-start justify-between gap-4">
              <DialogPrimitive.Title
                {...(titleId ? { id: titleId } : {})}
                className="text-xl font-bold"
              >
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={closeLabel}
                  id={closeId}
                  disabled={busy}
                >
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="mb-6 mt-2 text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
