import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "./components/ui/button";
import type { Runtime } from "./types";
export function PwaStatus({ runtime }: { runtime: Runtime }) {
  const [online, setOnline] = useState(navigator.onLine),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true,
      changing = false;
    const reload = () => {
      if (changing) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    void navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        if (!active) return;
        if (registration.waiting) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              active &&
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setWaiting(worker);
          });
        });
      })
      .catch(() => {
        /* Online access remains available when offline installation fails. */
      });
    const activate = (event: Event) => {
      changing = true;
      (event as CustomEvent<ServiceWorker>).detail.postMessage(
        "ACTIVATE_UPDATE",
      );
    };
    window.addEventListener("eburum-activate-update", activate);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
      window.removeEventListener("eburum-activate-update", activate);
    };
  }, []);
  if (online && !waiting) return null;
  return (
    <div className="pwa-status" role="status">
      {!online ? (
        <>
          <WifiOff size={18} />
          <p>Sei offline. Le modifiche richiedono una connessione.</p>
        </>
      ) : (
        <>
          <p>Aggiornamento disponibile</p>
          <Button
            variant="secondary"
            size="sm"
            disabled={
              runtime.state.trainingDraft?.saving ||
              !!document.querySelector('[aria-busy="true"]')
            }
            onClick={() => {
              if (
                runtime.state.trainingDraft?.saving ||
                document.querySelector('[aria-busy="true"]')
              )
                return;
              if (
                runtime.actions.hasAttendanceDraft() ||
                document.querySelector('[data-dirty="true"]')
              ) {
                if (!confirm("Ricaricare e scartare le modifiche non salvate?"))
                  return;
              }
              window.dispatchEvent(
                new CustomEvent("eburum-activate-update", { detail: waiting }),
              );
            }}
          >
            <RefreshCw />
            Ricarica
          </Button>
        </>
      )}
    </div>
  );
}
