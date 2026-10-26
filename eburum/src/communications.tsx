import { relativeTime, communicationDeadline } from "../app-presentation.js";
import { roleLabels } from "../app-roles.js";
import { useSearchParams } from "react-router-dom";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Plus,
  RefreshCw,
  Trash2,
  Clock3,
  LoaderCircle,
  Search,
  CalendarDays,
  MapPin,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { canPlanRole } from "../app-roles.js";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Dialog } from "./components/ui/dialog";
import { PageHeading } from "./pages";
import type { Communication, Runtime } from "./types";
import { confirmDialog } from "../app-confirm.js";
import "./communications.css";

export function CommunicationsPage({
  runtime,
  revision,
  meetings = false,
}: {
  runtime: Runtime;
  revision: number;
  meetings?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState(meetings ? "meetings" : "all"),
    [player, setPlayer] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get("compose") === "1") {
      setOpen(true);
      const next = new URLSearchParams(params);
      next.delete("compose");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);
  const reload = async () => {
    setBusy(true);
    setError("");
    try {
      await runtime.actions.fetchCommunications();
    } catch {
      setError("Aggiornamento non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  };
  const search = useDeferredValue(query).toLocaleLowerCase("it");
  useEffect(() => setFilter(meetings ? "meetings" : "all"), [meetings]);
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
        (filter !== "meetings" || message.kind === "meeting") &&
        (filter !== "general" || !message.player_id) &&
        (filter !== "unread" ||
          (message.requires_ack &&
            !(runtime.state.communication_receipts || []).some(
              (r) =>
                r.communication_id === message.id &&
                r.reader_id === runtime.state.user?.id,
            ))) &&
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
        title="Messaggi"
        description="Un unico punto per gli aggiornamenti dello staff."
      >
        <Button aria-label="Nuova comunicazione" onClick={() => setOpen(true)}>
          <Plus />
          <span className="page-add-label">Nuova comunicazione</span>
        </Button>
      </PageHeading>
      <div className="communications-workspace">
        <div className="communications-main">
          <div className="page-controls">
            <div className="communication-search">
              <Search size={18} aria-hidden="true" />
              <Input
                type="search"
                placeholder="Cerca nei messaggi"
                aria-label="Cerca comunicazione"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="communication-filters">
            <div
              className="segmented"
              role="group"
              aria-label="Filtra comunicazioni"
            >
              {[
                ["all", "Tutte"],
                ["meetings", "Riunioni"],
                ["general", "Generali"],
                ["players", "Per giocatore"],
                ["unread", "Da confermare"],
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
                <select
                  value={player}
                  onChange={(e) => setPlayer(e.target.value)}
                >
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
            <p>{rows.length} attive ·</p>
            <span
              className={
                "status-dot " +
                (runtime.state.communicationRealtimeStatus === "SUBSCRIBED"
                  ? "success"
                  : "")
              }
              aria-hidden="true"
            />
            <p>
              {runtime.state.communicationRealtimeStatus === "SUBSCRIBED"
                ? "in tempo reale"
                : ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(
                      runtime.state.communicationRealtimeStatus || "",
                    )
                  ? "connessione interrotta"
                  : "connessione agli aggiornamenti…"}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="communication-refresh"
              disabled={busy}
              onClick={() => void reload()}
              aria-label="Aggiorna comunicazioni"
              title="Aggiorna messaggi"
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            </Button>
          </div>
          {error ? (
            <div className="network-banner" role="alert">
              <p>{error}</p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void reload()}
              >
                Riprova
              </Button>
            </div>
          ) : null}
          {rows.length > 80 ? (
            <VirtualCommunications runtime={runtime} rows={rows} />
          ) : rows.length ? (
            <div className="native-communications">
              {rows.map((message) => (
                <MessageCard
                  key={message.id}
                  runtime={runtime}
                  message={message}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <MessageSquare aria-hidden="true" />
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
              <Button onClick={() => setOpen(true)}>Nuova comunicazione</Button>
            </div>
          )}
          {runtime.state.activities.some(
            (a) => a.activity_type === "Riunione",
          ) ? (
            <details className="communication-legacy-meetings">
              <summary>
                <CalendarDays size={20} aria-hidden="true" />
                <span className="legacy-meetings-title">
                  Riunioni già registrate
                </span>
                <span className="badge tone-neutral">
                  {
                    runtime.state.activities.filter(
                      (a) => a.activity_type === "Riunione",
                    ).length
                  }
                </span>
                <ChevronRight
                  size={20}
                  className="legacy-meetings-chevron"
                  aria-hidden="true"
                />
              </summary>
              <p className="sc-helper">
                Gli appuntamenti precedenti restano consultabili. Per i nuovi
                inviti usa Nuova comunicazione → Riunione.
              </p>
              <div className="sc-directory communication-meeting-list">
                {runtime.state.activities
                  .filter((a) => a.activity_type === "Riunione")
                  .sort((a, b) =>
                    b.activity_date.localeCompare(a.activity_date),
                  )
                  .map((a) => (
                    <button
                      type="button"
                      className="legacy-meeting-row"
                      key={a.id}
                      onClick={() => void runtime.actions.openActivity(a.id)}
                    >
                      <span className="sc-row-icon">
                        <CalendarDays size={20} aria-hidden="true" />
                      </span>
                      <span className="sc-row-copy">
                        <strong>{a.title}</strong>
                        <small>
                          {new Date(
                            a.activity_date + "T12:00:00",
                          ).toLocaleDateString("it-IT")}{" "}
                          · {a.start_time?.slice(0, 5) || "Orario da definire"}{" "}
                          · {a.status}
                          {a.status === "Programmato" &&
                          a.activity_date <
                            new Date().toLocaleDateString("en-CA")
                            ? " · Data trascorsa, stato da aggiornare"
                            : ""}
                        </small>
                      </span>
                      <ChevronRight
                        size={20}
                        className="sc-chevron"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
              </div>
            </details>
          ) : null}
        </div>
        <aside className="communications-aside">
          <h3>Uno spazio condiviso</h3>
          <p>
            Gli aggiornamenti sono visibili a tutti gli utenti dello staff,
            anche quando riguardano un singolo giocatore.
          </p>
          <p>
            Gli avvisi durano 1, 3 o 7 giorni dalla pubblicazione. Gli inviti
            restano visibili fino alla riunione e per la durata scelta dopo
            l’appuntamento. Alla scadenza vengono eliminati automaticamente.
          </p>
          <p>
            Le nuove comunicazioni arrivano in tempo reale. Apri Gestisci
            aggiornamenti per ripristinare una connessione interrotta.
          </p>
        </aside>
      </div>
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
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    pending = useRef(false);
  const receipts = (runtime.state.communication_receipts || []).filter(
      (r) => r.communication_id === message.id,
    ),
    acknowledged = receipts.some((r) => r.reader_id === runtime.state.user?.id);
  const mayDelete =
    runtime.state.team?.role === "admin" ||
    message.created_by === runtime.state.user?.id;
  return (
    <article
      className={
        "native-message " +
        (message.requires_ack && !acknowledged ? "is-unread" : "")
      }
    >
      <div className="message-author">
        <span className="message-avatar" aria-hidden="true">
          {(message.author_label || "Staff")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
        <span className="message-author-copy">
          <strong>{message.author_label || "Staff"}</strong>
          <small>
            {message.created_by === runtime.state.user?.id
              ? runtime.state.team
                ? roleLabels[runtime.state.team.role]
                : "Staff"
              : "Staff"}
          </small>
        </span>
        <time
          dateTime={message.created_at}
          title={runtime.actions.communicationTime(message.created_at)}
        >
          {relativeTime(message.created_at)}
        </time>
      </div>
      <div className="message-tags">
        <span className="badge tone-neutral">
          {message.kind === "meeting"
            ? "Riunione"
            : message.player_id
              ? "Per giocatore"
              : "Generale"}
        </span>
        <span className="badge tone-neutral">
          {runtime.actions.communicationAudience(message)}
        </span>
        <time
          className="row-sub"
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
      {message.kind === "meeting" && message.meeting_date ? (
        <div className="communication-meeting-info">
          <p>
            <CalendarDays size={18} />
            <time dateTime={message.meeting_date}>
              {new Date(message.meeting_date + "T12:00:00").toLocaleDateString(
                "it-IT",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                },
              )}{" "}
              · {message.meeting_time?.slice(0, 5)}
            </time>
          </p>
          <p>
            <MapPin size={18} />
            {message.meeting_location || "Luogo da definire"}
          </p>
        </div>
      ) : null}
      {message.requires_ack ? (
        <span
          className={
            "badge " + (acknowledged ? "tone-success" : "tone-warning")
          }
        >
          {acknowledged ? "Confermata" : "Da confermare"}
        </span>
      ) : null}
      <p
        className={
          "native-message-body " + (!expanded ? "message-body-preview" : "")
        }
      >
        {message.body}
      </p>
      {message.body.length > 140 ? (
        <button
          className="ghost message-expand"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Leggi meno" : "Leggi tutto"}
        </button>
      ) : null}
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
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              setError("");
              const user = runtime.state.user?.id,
                team = runtime.state.team?.owner_id,
                role = runtime.getSnapshot().role;
              try {
                if (
                  !(await confirmDialog({
                    message:
                      "Eliminare questa comunicazione per tutto lo staff?",
                    confirmLabel: "Elimina comunicazione",
                    danger: true,
                  })) ||
                  user !== runtime.state.user?.id ||
                  team !== runtime.state.team?.owner_id ||
                  role !== runtime.getSnapshot().role
                )
                  return;
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
      {message.requires_ack ? (
        <div className="communication-ack">
          <Button
            variant="secondary"
            disabled={busy || acknowledged}
            onClick={async () => {
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              setError("");
              try {
                await runtime.actions.acknowledgeCommunication(message.id);
              } catch {
                setError("Conferma non salvata. Riprova.");
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          >
            {acknowledged
              ? "Lettura confermata"
              : busy
                ? "Salvataggio…"
                : "Confermo di aver letto"}
          </Button>
          <details>
            <summary>{receipts.length} conferme di lettura</summary>
            {receipts.map((r) => (
              <p key={r.reader_id}>
                {r.reader_label} ·{" "}
                {runtime.actions.communicationTime(r.acknowledged_at)}
              </p>
            ))}
          </details>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
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
    [kind, setKind] = useState<"notice" | "meeting">("notice"),
    [meetingDate, setMeetingDate] = useState(""),
    [meetingTime, setMeetingTime] = useState(""),
    [meetingLocation, setMeetingLocation] = useState(""),
    [body, setBody] = useState(""),
    [player, setPlayer] = useState(""),
    [days, setDays] = useState(3),
    [requiresAck, setRequiresAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    pending = useRef(false);
  const dirty = !!(
    title ||
    body ||
    player ||
    days !== 3 ||
    requiresAck ||
    kind === "meeting" ||
    meetingDate ||
    meetingTime ||
    meetingLocation
  );
  const mayPlan = canPlanRole(runtime.state.team?.role || "");
  const resetMeeting = () => {
    setKind("notice");
    setMeetingDate("");
    setMeetingTime("");
    setMeetingLocation("");
  };
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
      resetMeeting();
      setTitle("");
      setBody("");
      setPlayer("");
      setDays(3);
      setRequiresAck(false);
      setError("");
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Nuova comunicazione"
      description="Avvisi e inviti in un unico spazio, visibile a tutto lo staff."
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
          if (
            kind === "meeting" &&
            (!mayPlan || !meetingDate || !meetingTime)
          ) {
            setError("Per l’invito inserisci data e ora della riunione.");
            return;
          }
          pending.current = true;
          setBusy(true);
          setError("");
          try {
            await runtime.actions.publishCommunication({
              title: title.trim(),
              body: body.trim(),
              player_id: kind === "meeting" ? null : player || null,
              retention_days: days,
              requires_ack: kind === "meeting" || requiresAck,
              kind,
              meeting_date: kind === "meeting" ? meetingDate : null,
              meeting_time: kind === "meeting" ? meetingTime : null,
              meeting_location:
                kind === "meeting" ? meetingLocation.trim() || null : null,
            });
            onOpenChange(false);
            setTitle("");
            setBody("");
            setPlayer("");
            setDays(3);
            setRequiresAck(false);
            resetMeeting();
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
          {mayPlan ? (
            <div
              className="segmented"
              role="group"
              aria-label="Tipo comunicazione"
            >
              <button
                type="button"
                aria-pressed={kind === "notice"}
                onClick={() => setKind("notice")}
              >
                Avviso
              </button>
              <button
                type="button"
                aria-pressed={kind === "meeting"}
                onClick={() => {
                  setKind("meeting");
                  setRequiresAck(true);
                }}
              >
                Riunione
              </button>
            </div>
          ) : null}
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
          {kind === "meeting" ? (
            <div className="communication-meeting-fields">
              <label htmlFor="meeting-date">
                Data
                <Input
                  id="meeting-date"
                  type="date"
                  value={meetingDate}
                  min={new Date().toLocaleDateString("sv-SE", {
                    timeZone: "Europe/Rome",
                  })}
                  required
                  onChange={(e) => setMeetingDate(e.target.value)}
                />
              </label>
              <label htmlFor="meeting-time">
                Ora
                <Input
                  id="meeting-time"
                  type="time"
                  value={meetingTime}
                  required
                  onChange={(e) => setMeetingTime(e.target.value)}
                />
              </label>
              <label htmlFor="meeting-location">
                Luogo
                <Input
                  id="meeting-location"
                  value={meetingLocation}
                  maxLength={500}
                  placeholder="Es. Sede della società"
                  onChange={(e) => setMeetingLocation(e.target.value)}
                />
              </label>
            </div>
          ) : null}
          <label htmlFor="communication-body">
            {kind === "meeting"
              ? "Ordine del giorno e indicazioni"
              : "Messaggio"}
            <textarea
              id="communication-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={5}
              required
            />
          </label>
          {kind !== "meeting" ? (
            <div className="field">
              <label htmlFor="communication-player">Riferimento</label>
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
              <small>
                Visibile a tutto lo staff, anche se riferito a un giocatore.
              </small>
            </div>
          ) : null}
          {kind !== "meeting" ? (
            <label className="communication-ack-choice">
              <input
                type="checkbox"
                checked={requiresAck}
                onChange={(e) => setRequiresAck(e.target.checked)}
              />{" "}
              Richiedi conferma di lettura
            </label>
          ) : null}
          <p className="text-sm">
            {kind === "meeting"
              ? "L’invito richiede conferma di lettura. Questa conferma indica che il messaggio è stato letto, non che la persona parteciperà."
              : "Per gli avvisi importanti. Ogni membro dello staff conferma esplicitamente; aprire il messaggio non registra una lettura."}
          </p>
          <div className="field">
            <label htmlFor="communication-days">
              {kind === "meeting" ? "Visibile dopo la riunione per" : "Durata"}
            </label>
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
            <p className="row-sub" role="status">
              {(() => {
                const expiry = communicationDeadline(
                  kind,
                  meetingDate,
                  meetingTime,
                  days,
                );
                return expiry
                  ? "Scadenza prevista: " +
                      runtime.actions.communicationTime(expiry) +
                      " (ora di Roma). La pubblicazione conferma l’orario definitivo."
                  : kind === "meeting"
                    ? "La scadenza decorre dall’appuntamento, nell’orario di Roma; data e ora definitive saranno mostrate dopo la pubblicazione."
                    : "";
              })()}
            </p>
          </div>
        </fieldset>
        <p role="status" className="text-sm text-destructive">
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
