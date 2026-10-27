import { useLayoutEffect, useRef, useState } from "react";
import { setConfirmationPresenter } from "../../../app-confirm.js";
import { Button } from "./button";
import { Dialog } from "./dialog";
interface Request {
  message: string;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
}
export function ConfirmationDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  const previous = useRef<Element | null>(null);
  const finish = (value: boolean) => {
    const resolve = pending.current;
    if (!resolve) return;
    pending.current = null;
    setRequest(null);
    resolve(value);
  };
  useLayoutEffect(() => {
    setConfirmationPresenter((next: Request) => {
      if (pending.current) return Promise.resolve(false);
      previous.current = document.activeElement;
      return new Promise<boolean>((resolve) => {
        pending.current = resolve;
        setRequest(next);
      });
    });
    return () => {
      setConfirmationPresenter(null);
      pending.current?.(false);
      pending.current = null;
    };
  }, []);
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
      role="alertdialog"
      title={request?.title || "Conferma"}
      description={request?.message || "Conferma l’operazione"}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = previous.current;
        if (target instanceof HTMLElement && target.isConnected) target.focus();
        else document.getElementById("mainContent")?.focus();
      }}
    >
      <div className="modal-actions confirm-actions">
        <Button
          variant="secondary"
          data-autofocus
          data-confirm-cancel
          onClick={() => finish(false)}
        >
          {request?.cancelLabel || "Annulla"}
        </Button>
        <Button
          data-confirm-accept
          variant={request?.danger ? "destructive" : "default"}
          onClick={() => finish(true)}
        >
          {request?.confirmLabel || "Conferma"}
        </Button>
      </div>
    </Dialog>
  );
}
