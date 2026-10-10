import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, m } from "motion/react";
import { Plus, RefreshCw, Trash2, Clock3, LoaderCircle } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Dialog } from "./components/ui/dialog";
import { PageHeading } from "./pages";
import type { Communication, Runtime } from "./types";

export function CommunicationsPage({
  runtime,
  revision,
}: {
  runtime: Runtime;
  revision: number;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [player, setPlayer] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  const search = useDeferredValue(query).toLocaleLowerCase("it");
  // The clock only expires already loaded messages; remote changes use Realtime.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const rows = runtime.actions
    .activeCommunications()
    .filter(
      (message) =>
        Date.parse(message.expires_at) > now &&
        (filter !== "players" ||
          (message.player_id && (!player || message.player_id === player))) &&
        (filter !== "expiring" ||
          Date.parse(message.expires_at) - now <= 86400000) &&
        [
          message.title,
          message.body,
          message.author_label,
          runtime.actions.communicationAudience(message),
        ]
          .join(" ")
          .toLocaleLowerCase("it")
          .includes(search),
    );
  void revision;
  return (
    <>
      <PageHeading
        title="Comunicazioni"
        description="Un unico punto per gli aggiornamenti dello staff."
      >
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Nuova comunicazione
        </Button>
      </PageHeading>
      <div className="page-controls">
        <Input
          type="search"
          placeholder="Cerca nei messaggi"
          aria-label="Cerca comunicazione"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await runtime.actions.fetchCommunications();
            } catch {
              setError("Aggiornamento non riuscito. Riprova.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw className={busy ? "animate-spin" : ""} />
          Aggiorna
        </Button>
      </div>
      <div className="communication-filters">
        <div
          className="segmented"
          role="group"
          aria-label="Filtra comunicazioni"
        >
          {[
            ["all", "Tutte"],
            ["players", "Per giocatore"],
            ["expiring", "In scadenza"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {filter === "players" ? (
          <label className="communication-player-filter">
            Giocatore
            <select value={player} onChange={(e) => setPlayer(e.target.value)}>
              {[""].map((value) => (
                <option key={value} value={value}>
                  Tutti i giocatori
                </option>
              ))}
              {runtime.state.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.surname} {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="communication-list-status">
        <p>
          {rows.length}{" "}
          {rows.length === 1 ? "comunicazione attiva" : "comunicazioni attive"}
        </p>
        <p>
          {runtime.state.communicationRealtimeStatus === "SUBSCRIBED"
            ? "Aggiornamenti in tempo reale"
            : ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(
                  runtime.state.communicationRealtimeStatus || "",
                )
              ? "Aggiornamenti interrotti. Premi Aggiorna."
              : "Connessione agli aggiornamenti…"}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      ) : null}
      {rows.length > 80 ? (
        <VirtualCommunications runtime={runtime} rows={rows} />
      ) : rows.length ? (
        <div className="native-communications">
          <AnimatePresence initial={false}>
            {rows.map((message) => (
              <m.div
                key={message.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <MessageCard runtime={runtime} message={message} />
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="empty">
          <h3>
            {query || filter !== "all"
              ? "Nessuna comunicazione trovata"
              : "Nessuna comunicazione attiva"}
          </h3>
          <p>
            {query || filter !== "all"
              ? "Cambia la ricerca o il filtro."
              : "Pubblica un aggiornamento per condividerlo con lo staff."}
          </p>
        </div>
      )}
      <CommunicationEditor
        runtime={runtime}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
function VirtualCommunications({
  runtime,
  rows,
}: {
  runtime: Runtime;
  rows: Communication[];
}) {
  const container = useRef<HTMLDivElement>(null),
    [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const measure = () =>
      setOffset(
        (container.current?.getBoundingClientRect().top || 0) + window.scrollY,
      );
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rows]);
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 240,
    overscan: 5,
    scrollMargin: offset,
    getItemKey: (index) => rows[index].id,
  });
  return (
    <div
      ref={container}
      className="virtual-communications"
      style={{ height: virtualizer.getTotalSize(), position: "relative" }}
    >
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            transform: `translateY(${row.start - offset}px)`,
            paddingBottom: 16,
          }}
        >
          <MessageCard runtime={runtime} message={rows[row.index]} />
        </div>
      ))}
    </div>
  );
}
function MessageCard({
  runtime,
  message,
}: {
  runtime: Runtime;
  message: Communication;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    pending = useRef(false);
  const mayDelete =
    runtime.state.team?.role === "admin" ||
    message.created_by === runtime.state.user?.id;
  return (
    <article className="native-message">
      <div className="native-message-top">
        <strong>{runtime.actions.communicationAudience(message)}</strong>
        <time
          dateTime={message.expires_at}
          title={
            "Scadenza: " + runtime.actions.communicationTime(message.expires_at)
          }
        >
          <Clock3 size={16} />
          {runtime.actions.communicationExpiry(message.expires_at)}
        </time>
      </div>
      <h3>{message.title}</h3>
      <p className="native-message-body">{message.body}</p>
      <div className="native-message-footer">
        <div>
          <span>
            {message.author_label || "Staff"} ·{" "}
            {runtime.actions.communicationTime(message.created_at)}
          </span>
          <span>
            Scadenza: {runtime.actions.communicationTime(message.expires_at)}
          </span>
        </div>
        {mayDelete ? (
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={"Elimina comunicazione: " + message.title}
            onClick={async () => {
              if (
                pending.current ||
                !confirm("Eliminare questa comunicazione per tutto lo staff?")
              )
                return;
              pending.current = true;
              setBusy(true);
              setError("");
              try {
                await runtime.actions.deleteCommunication(message.id);
              } catch {
                setError("Eliminazione non riuscita. Riprova.");
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </article>
  );
}
function CommunicationEditor({
  runtime,
  open,
  onOpenChange,
}: {
  runtime: Runtime;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [player, setPlayer] = useState(""),
    [days, setDays] = useState(3),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    pending = useRef(false);
  const dirty = !!(title || body || player || days !== 3);
  useEffect(() => {
    if (!open) return;
    runtime.setNavigationGuard(
      () =>
        !pending.current &&
        (!dirty || confirm("Scartare la comunicazione non pubblicata?")),
    );
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      runtime.setNavigationGuard(null);
      window.removeEventListener("beforeunload", unload);
    };
  }, [runtime, open, dirty]);
  const close = (next: boolean) => {
    if (
      !next &&
      (pending.current ||
        (dirty && !confirm("Scartare la comunicazione non pubblicata?")))
    )
      return;
    onOpenChange(next);
    if (!next) {
      setTitle("");
      setBody("");
      setPlayer("");
      setDays(3);
      setError("");
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Nuova comunicazione"
      description="Visibile a tutto lo staff. Viene eliminata automaticamente alla scadenza."
    >
      <form
        className="grid gap-5"
        data-dirty={dirty}
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending.current) return;
          if (!title.trim() || !body.trim()) {
            setError("Inserisci titolo e testo della comunicazione.");
            return;
          }
          pending.current = true;
          setBusy(true);
          setError("");
          try {
            await runtime.actions.publishCommunication({
              title: title.trim(),
              body: body.trim(),
              player_id: player || null,
              retention_days: days,
            });
            onOpenChange(false);
            setTitle("");
            setBody("");
            setPlayer("");
            setDays(3);
          } catch {
            setError(
              "Pubblicazione non riuscita. Il testo è conservato: riprova.",
            );
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="grid gap-5">
          <label htmlFor="communication-title">
            Titolo
            <Input
              id="communication-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
            />
          </label>
          <label htmlFor="communication-body">
            Messaggio
            <textarea
              id="communication-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={5}
              required
            />
          </label>
          <label htmlFor="communication-player">
            Riferimento
            <select
              id="communication-player"
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
            >
              <option value="">Comunicazione generale</option>
              {runtime.state.players
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.surname} {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label htmlFor="communication-days">
            Durata
            <select
              id="communication-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[1, 3, 7].map((day) => (
                <option key={day} value={day}>
                  {day} {day === 1 ? "giorno" : "giorni"}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <p role="status" className="text-sm text-red-200">
          {error}
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => close(false)}
          >
            Annulla
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" />
                Pubblicazione…
              </>
            ) : (
              "Pubblica comunicazione"
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
