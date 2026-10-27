import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { X, Copy } from "lucide-react";
import { Dialog } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { confirmDialog } from "../app-confirm.js";
import { ui, type Surface } from "./ui-service";
import type { Runtime } from "./types";

export function useEditor<T>(runtime: Runtime, surface: Surface, initial: T) {
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const baseline = useRef(JSON.stringify(initial)),
    live = useRef(value),
    saving = useRef(false),
    alive = useRef(true),
    current = useRef(runtime.requestGuard());
  live.current = value;
  const dirty = JSON.stringify(value) !== baseline.current;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useLayoutEffect(
    () =>
      ui.guard(
        surface.id,
        async () =>
          !saving.current &&
          (JSON.stringify(live.current) === baseline.current ||
            (await confirmDialog({
              message: "Scartare le modifiche non salvate?",
              confirmLabel: "Scarta",
            }))),
      ),
    [surface.id],
  );
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(live.current) !== baseline.current || saving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (saving.current || !current.current() || !alive.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      return current.current() && alive.current;
    } catch (cause) {
      if (current.current() && alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : String(
                (cause as { message?: string })?.message ||
                  "Operazione non riuscita. Riprova.",
              ),
        );
      return false;
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const canLeave = async () =>
    !saving.current &&
    (JSON.stringify(live.current) === baseline.current ||
      (await confirmDialog({
        message: "Scartare le modifiche non salvate?",
        confirmLabel: "Scarta",
      })));
  return {
    value,
    setValue,
    busy,
    error,
    setError,
    dirty,
    run,
    canLeave,
    current: () => alive.current && current.current(),
    clean: () => {
      baseline.current = JSON.stringify(live.current);
    },
    reset: (next: T) => {
      baseline.current = JSON.stringify(next);
      live.current = next;
      setValue(next);
    },
    close: () => ui.close(surface.id, true),
  };
}
export function Field({
  id,
  label,
  children,
  className = "",
}: {
  id?: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
export function Feedback({ error, id }: { error: string; id?: string }) {
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      className="row-sub"
      hidden={!error}
    >
      {error}
    </p>
  );
}
export function EditorFrame({
  surface,
  title,
  description = "",
  children,
  className = "",
  closeLabel = "Chiudi",
  titleId,
  closeId,
  dirty = false,
  busy = false,
}: {
  surface: Surface;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  titleId?: string;
  closeId?: string;
  dirty?: boolean;
  busy?: boolean;
}) {
  const close = () => void ui.close(surface.id);
  const root = useRef<HTMLElement>(null);
  const previousFocus = useRef(document.activeElement);
  useLayoutEffect(() => {
    if (surface.workspace) root.current?.focus({ preventScroll: true });
  }, [surface.id, surface.workspace]);
  if (surface.workspace)
    return (
      <section
        ref={root}
        tabIndex={-1}
        className="workspace-editor modal-back workspace-view"
        data-detail={surface.detail}
        data-page={surface.page}
        data-dirty={dirty}
        aria-busy={busy}
      >
        <div
          className={`modal ${className}`}
          data-dirty={dirty}
          role="region"
          aria-label={title}
        >
          <div className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <Button
              variant="secondary"
              size="icon"
              aria-label={closeLabel}
              id={closeId}
              disabled={busy}
              onClick={close}
            >
              <X />
            </Button>
          </div>
          {description ? <p className="row-sub">{description}</p> : null}
          {children}
        </div>
      </section>
    );
  return (
    <Dialog
      open
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = previousFocus.current;
        if (target instanceof HTMLElement && target.isConnected) target.focus();
        else document.getElementById("mainContent")?.focus();
      }}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={title}
      description={description}
      className={className}
      closeLabel={closeLabel}
      titleId={titleId}
      closeId={closeId}
      dirty={dirty}
      busy={busy}
    >
      {children}
    </Dialog>
  );
}
export function CopyText({
  text,
  label = "Copia testo",
  id,
  className,
  children,
}: {
  text: string;
  label?: string;
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState(""),
    [fallback, setFallback] = useState(false),
    area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (fallback) {
      area.current?.focus();
      area.current?.select();
    }
  }, [fallback]);
  return (
    <>
      <Button
        id={id}
        className={className}
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus("Testo copiato");
          } catch {
            setFallback(true);
            setStatus("Copia manualmente il testo selezionato.");
          }
        }}
      >
        {children || (
          <>
            <Copy size={18} />
            {label}
          </>
        )}
      </Button>
      {fallback ? (
        <textarea
          ref={area}
          data-copy-fallback
          readOnly
          aria-label="Testo da copiare"
          value={text}
        />
      ) : null}
      <Feedback error={status} />
    </>
  );
}
export function Toast() {
  const snapshot = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  return snapshot.toast ? (
    <div className="toast" role="status">
      {snapshot.toast}
    </div>
  ) : null;
}
