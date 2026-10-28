import {
  ArrowLeftRight,
  CircleDot,
  Pencil,
  Plus,
  RectangleVertical,
} from "lucide-react";
import { Fragment } from "react";
import { confirmDialog } from "../../app-confirm.js";
import { teamOwner } from "../../app-part1.js";
import { eventTone } from "../../app-part4.js";
import { matchReview } from "../../app-workflow-tools.js";
import { Button } from "../components/ui/button";
import { Feedback, Field } from "../operational-ui";
import { ui } from "../ui-service";
import { EventEditor } from "./event-editor";
import { useMatchEditor } from "./use-match-editor";
export function MatchResults({
  model,
}: {
  model: ReturnType<typeof useMatchEditor>;
}) {
  const {
    a,
    called,
    composer,
    editor,
    eventGuard,
    events,
    m,
    onEventType,
    openComposer,
    plan,
    players,
    reload,
    reloadError,
    resultFields,
    role,
    runtime,
    saveResult,
    selected,
    setComposer,
    setSelected,
    tab,
    v,
  } = model;

  return (
    <section
      id="match-panel-results"
      role="tabpanel"
      aria-labelledby="match-tab-results"
      data-activity-panel="results"
      hidden={tab !== "results"}
    >
      <div className="match-score-fields">
        {resultFields.map(({ id, label, key }, i) => (
          <Fragment key={key}>
            {i > 0 ? (
              <span className="match-score-separator" aria-hidden="true">
                :
              </span>
            ) : null}
            <Field id={id} label={label}>
              <input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                disabled={editor.busy || !!composer}
                placeholder="—"
                value={v.result[key]}
                onChange={(e) =>
                  editor.setValue({
                    ...v,
                    result: { ...v.result, [key]: e.target.value },
                  })
                }
              />
            </Field>
          </Fragment>
        ))}
      </div>
      <div className="match-live-grid">
        <div className="match-live-main">
          <div className="section-title match-events-heading">
            <h3>
              Eventi <span id="matchEventCount">({events.length})</span>
            </h3>
            <div className="match-event-actions">
              {(
                [
                  {
                    id: "addGoal",
                    type: "Gol",
                    team: "own",
                    label: "Gol Eburum",
                    Icon: CircleDot,
                  },
                  {
                    id: "addOpponentGoal",
                    type: "Gol",
                    team: "opponent",
                    label: "Gol avversari",
                    Icon: CircleDot,
                  },
                  {
                    id: "addYellow",
                    type: "Ammonizione",
                    label: "Ammonizione",
                    Icon: RectangleVertical,
                  },
                  {
                    id: "addSubstitution",
                    type: "Sostituzione",
                    label: "Sostituzione",
                    Icon: ArrowLeftRight,
                  },
                  {
                    id: "addMatchEvent",
                    type: "Nota",
                    label: "Altro evento",
                    Icon: Plus,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  id={item.id}
                  disabled={editor.busy || !!reloadError}
                  aria-pressed={
                    !!selected &&
                    selected.type === item.type &&
                    (item.type !== "Gol" ||
                      selected.team ===
                        ("team" in item ? item.team : undefined))
                  }
                  onClick={() =>
                    void openComposer({
                      type: item.type,
                      team: "team" in item ? item.team : undefined,
                    })
                  }
                >
                  <item.Icon size={18} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="match-event-composer">
            {composer ? (
              <EventEditor
                key={
                  (composer.event?.id || "new") +
                  composer.type +
                  (composer.team || "")
                }
                inline
                runtime={runtime}
                surface={{
                  id: -2,
                  kind: "event",
                  data: {
                    matchId: a.match_id,
                    type: composer.type,
                    event: composer.event,
                    context: { team: composer.team },
                  },
                }}
                onGuard={(guard) => {
                  eventGuard.current = guard;
                }}
                onType={onEventType}
                onClose={() => {
                  setComposer(null);
                  setSelected(null);
                }}
                onSaved={reload}
              />
            ) : null}
          </div>
          <div id="matchEventList" className="event-list match-timeline">
            {events.map((e) => (
              <article
                className={
                  "event-item" +
                  (e.event_type === "Gol" && !e.player_id
                    ? " opponent-goal"
                    : "")
                }
                key={e.id}
              >
                <div className="event-minute">
                  {e.minute == null ? "—" : `${e.minute}′`}
                </div>
                <div className="event-content" data-event-type={e.event_type}>
                  <span className={`badge ${eventTone(e)}`}>
                    {e.event_type === "Gol" && !e.player_id
                      ? "Gol avversario"
                      : e.event_type}
                  </span>
                  <b>
                    {e.event_type === "Gol" && !e.player_id
                      ? "Squadra avversaria"
                      : `${e.event_type === "Sostituzione" ? "Entra " : ""}${runtime.state.players.find((p) => p.id === e.player_id)?.surname || "Giocatore storico"} ${runtime.state.players.find((p) => p.id === e.player_id)?.name || ""}`}
                  </b>
                  {e.outgoing_player_id ? (
                    <small>
                      Esce{" "}
                      {
                        runtime.state.players.find(
                          (p) => p.id === e.outgoing_player_id,
                        )?.surname
                      }{" "}
                      {
                        runtime.state.players.find(
                          (p) => p.id === e.outgoing_player_id,
                        )?.name
                      }
                    </small>
                  ) : null}
                  {e.detail ? <p>{e.detail}</p> : null}
                </div>
                <button
                  className="ghost event-edit"
                  data-unified-event={e.id}
                  aria-label={`Modifica ${e.event_type}${e.minute == null ? "" : ` al ${e.minute}° minuto`}`}
                  disabled={editor.busy || !!reloadError}
                  onClick={() =>
                    void openComposer({
                      type: e.event_type,
                      event: e,
                      team:
                        e.event_type === "Gol"
                          ? e.player_id
                            ? "own"
                            : "opponent"
                          : undefined,
                    })
                  }
                >
                  <Pencil size={18} />
                </button>
              </article>
            ))}
          </div>
          <div className="match-game-notes">
            <Field id="matchNote" label="Note della partita">
              <textarea
                id="matchNote"
                maxLength={10000}
                placeholder="Osservazioni sulla gara…"
                disabled={editor.busy || !!composer}
                value={v.result.note}
                onChange={(e) =>
                  editor.setValue({
                    ...v,
                    result: { ...v.result, note: e.target.value },
                  })
                }
              />
            </Field>
          </div>
        </div>
        <div className="match-live-side">
          <details className="match-settings">
            <summary>
              Durata e calcolo minuti{" "}
              <span className="row-sub">
                {v.result.duration_minutes}′ ·{" "}
                {v.result.minutes_auto ? "Automatici" : "Manuali"}
              </span>
            </summary>
            <Field id="matchDuration" label="Durata della gara (minuti)">
              <input
                id="matchDuration"
                type="number"
                inputMode="numeric"
                min={1}
                max={130}
                disabled={!plan || !!composer || editor.busy}
                value={v.result.duration_minutes}
                onChange={(e) =>
                  editor.setValue({
                    ...v,
                    result: {
                      ...v.result,
                      duration_minutes: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field id="matchMinutesMode" label="Minuti giocati">
              <select
                id="matchMinutesMode"
                disabled={!plan || !!composer || editor.busy}
                value={v.result.minutes_auto ? "auto" : "manual"}
                onChange={(e) =>
                  editor.setValue({
                    ...v,
                    result: {
                      ...v.result,
                      minutes_auto: e.target.value === "auto",
                    },
                  })
                }
              >
                <option value="auto">Automatici dagli eventi</option>
                <option value="manual">Inseriti dallo staff</option>
              </select>
            </Field>
            <Field id="matchVenue" label="Dove si gioca">
              <select
                id="matchVenue"
                disabled={!plan || !!composer || editor.busy}
                value={v.result.venue}
                onChange={(e) =>
                  editor.setValue({
                    ...v,
                    result: { ...v.result, venue: e.target.value },
                  })
                }
              >
                <option>Casa</option>
                <option>Trasferta</option>
              </select>
            </Field>
          </details>
          <details className="match-minutes">
            <summary>Minuti giocati</summary>
            <div id="matchMinutesList">
              {called.map((row) => (
                <p key={row.player_id}>
                  {players.find((p) => p.id === row.player_id)?.surname} ·{" "}
                  {row.minutes_played} min
                </p>
              ))}
            </div>
          </details>
        </div>
      </div>
      {reloadError ? (
        <div role="alert">
          {reloadError}
          <Button variant="secondary" onClick={() => void editor.run(reload)}>
            Ricarica dati
          </Button>
        </div>
      ) : null}
      <details className="match-review">
        <summary>Riepilogo e controllo finale</summary>
        <ul>
          {m
            ? matchReview(m, v.rows, events).map((issue) => (
                <li key={issue}>{issue}</li>
              ))
            : null}
        </ul>
        <Button
          variant="secondary"
          onClick={() => ui.open("history", { id: a.id, kind: "activity" })}
        >
          Storico modifiche
        </Button>
      </details>
      {role === "admin" ? (
        <details className="match-danger">
          <summary>Altre azioni</summary>
          <Button
            id="removeUnifiedMatch"
            variant="destructive"
            disabled={editor.busy}
            onClick={() =>
              void editor.run(async () => {
                if (
                  !m ||
                  !(await confirmDialog({
                    message:
                      "Eliminare definitivamente la partita, convocazioni ed eventi collegati?",
                    confirmLabel: "Elimina partita",
                    danger: true,
                  }))
                )
                  return;
                if (!editor.current() || runtime.state.team?.role !== "admin")
                  return;
                const { error } = await runtime.db
                  .from("matches")
                  .delete()
                  .eq("id", m.id)
                  .eq("user_id", teamOwner());
                if (error) throw error;
                if (editor.current()) {
                  await editor.close();
                  await runtime.actions.reloadAffected({
                    kind: "match",
                    id: m.id,
                  });
                }
              })
            }
          >
            Elimina partita
          </Button>
        </details>
      ) : null}
      <div className="match-save-row workspace-save">
        <Button
          id="saveMatchResult"
          disabled={editor.busy || !!composer || !!reloadError}
          onClick={() => void saveResult()}
        >
          Salva partita
        </Button>
        <Feedback id="matchResultStatus" error={editor.error} />
      </div>
    </section>
  );
}
