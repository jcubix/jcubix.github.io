import { useCallback, useEffect, useRef, useState } from "react";
import { fmt, teamOwner } from "../app-part1.js";
import { activityPollPending } from "../app-workflows.js";
import { Button } from "./components/ui/button";
import { EditorFrame, Feedback } from "./operational-ui";
import type { Runtime } from "./types";
import { ui, type Surface } from "./ui-service";

interface HistoryRow {
  id: string;
  entity: string;
  action: string;
  player_id?: string;
  actor_id?: string;
  actor_label?: string;
  changed_at: string;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
}
export function History({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { id, kind } = surface.data as { id: string; kind: string },
    [rows, setRows] = useState<HistoryRow[]>([]),
    [more, setMore] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    offset = useRef(0),
    lock = useRef(false),
    alive = useRef(true);
  const labels: Record<string, string> = {
    status: "Stato",
    notified: "Risposta al sondaggio",
    note: "Nota",
    session_date: "Data",
    session_type: "Tipo",
    title: "Titolo",
    activity_date: "Data",
    start_time: "Inizio",
    end_time: "Fine",
    location: "Campo",
    organization_note: "Indicazioni",
    meeting_time: "Ritrovo",
    meeting_place: "Luogo ritrovo",
    goals_for: "Gol Eburum",
    goals_against: "Gol avversari",
    venue: "Campo gara",
    duration_minutes: "Durata",
    minutes_auto: "Minuti automatici",
    called: "Convocato",
    lineup: "Impiego",
    position: "Posizione",
    minutes_played: "Minuti",
    availability: "Risposta WhatsApp",
    response_note: "Nota risposta",
    event_type: "Evento",
    minute: "Minuto",
    player_id: "Giocatore",
    outgoing_player_id: "Giocatore uscito",
    detail: "Dettaglio",
  };
  const value = (key: string, v: unknown) =>
    v == null || v === ""
      ? "Non indicato"
      : typeof v === "boolean"
        ? v
          ? "Sì"
          : "No"
        : ["player_id", "outgoing_player_id"].includes(key)
          ? runtime.state.players.find((p) => p.id === v)?.surname ||
            "Giocatore storico"
          : String(v);
  const load = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const current = runtime.requestGuard();
    try {
      let query = runtime.db
        .from(kind === "activity" ? "activity_history" : "attendance_history")
        .select("*")
        .eq("user_id", teamOwner())
        .eq(kind === "activity" ? "activity_id" : "session_id", id);
      if (kind !== "activity") query = query.eq("action", "UPDATE");
      const { data, error } = await query
        .order("changed_at", { ascending: false })
        .order("id")
        .range(offset.current, offset.current + 19);
      if (error) throw error;
      if (!alive.current || !current()) return;
      setRows((old) => [...old, ...data]);
      offset.current += data.length;
      setMore(data.length === 20);
    } catch (cause) {
      if (alive.current && current()) setError((cause as Error).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }, [runtime, kind, id]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  return (
    <EditorFrame
      surface={surface}
      title="Storico modifiche"
      titleId="historyTitle"
      closeId="closeHistory"
      description="Le correzioni vengono tracciate da questo aggiornamento. Le modifiche precedenti non sono ricostruibili."
      closeLabel="Chiudi storico"
    >
      <div
        id={kind === "activity" ? "activityHistoryList" : "historyList"}
        className="list"
        aria-live="polite"
      >
        {rows.map((h) => (
          <article className="history-change" key={h.id}>
            <b>
              {h.entity === "session"
                ? "Dati sessione"
                : runtime.state.players.find((p) => p.id === h.player_id)
                    ?.surname ||
                  (
                    {
                      activities: "Organizzazione",
                      activity_roster: "Risposta / convocazione",
                      matches: "Risultato",
                      match_events: "Evento",
                    } as Record<string, string>
                  )[h.entity] ||
                  "Modifica"}
            </b>
            <p className="row-sub">
              {h.actor_label ||
                (h.actor_id === runtime.state.user?.id
                  ? runtime.state.user?.email
                  : "Sistema")}{" "}
              ·{" "}
              {new Intl.DateTimeFormat("it-IT", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(h.changed_at))}
            </p>
            {Object.entries(labels)
              .filter(
                ([key]) =>
                  JSON.stringify(h.before_data?.[key]) !==
                  JSON.stringify(h.after_data?.[key]),
              )
              .map(([key, label]) => (
                <div className="history-field" key={key}>
                  <strong>{label}</strong>
                  <span>
                    {value(key, h.before_data?.[key])} →{" "}
                    {value(key, h.after_data?.[key])}
                  </span>
                </div>
              ))}
          </article>
        ))}
        {!rows.length && !busy && !error ? (
          <p>Nessuna modifica registrata dall’attivazione dello storico.</p>
        ) : null}
      </div>
      {busy ? <p role="status">Caricamento…</p> : null}
      <Feedback error={error} />
      {more || error ? (
        <Button
          id={kind === "activity" ? "moreActivityHistory" : "loadMoreHistory"}
          disabled={busy}
          variant="secondary"
          onClick={() => void load()}
        >
          {error ? "Riprova" : "Carica precedenti"}
        </Button>
      ) : null}
    </EditorFrame>
  );
}
export function Priorities({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { kind } = surface.data as { kind: string },
    activities = runtime.state.activities.filter(
      (a) =>
        a.activity_type === "Allenamento" &&
        a.status === "Programmato" &&
        activityPollPending(a) > 0,
    );
  return (
    <EditorFrame
      surface={surface}
      title="Risposte WhatsApp da registrare"
      closeLabel="Chiudi priorità"
    >
      <div className="list">
        {activities.map((a) => (
          <button
            className="priority-row"
            data-priority-activity={a.id}
            key={a.id}
            onClick={async () => {
              await ui.close(surface.id, true);
              await runtime.actions.openActivity(a.id);
            }}
          >
            <span>
              <b>{a.title}</b>
              <small>
                {fmt(a.activity_date)} ·{" "}
                {kind === "poll"
                  ? activityPollPending(a) + " risposte in attesa"
                  : "Stato da aggiornare"}
              </small>
            </span>
          </button>
        ))}
      </div>
    </EditorFrame>
  );
}
