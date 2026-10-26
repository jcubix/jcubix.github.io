import { useState, useRef } from "react";
import { RectangleVertical } from "lucide-react";
import { Button } from "./components/ui/button";
import { EditorFrame, Field, Feedback, useEditor } from "./operational-ui";
import { ui, type Surface } from "./ui-service";
import type { Runtime, MatchEvent } from "./types";
import { disciplineSeason, playerDiscipline } from "../app-discipline.js";
import {
  dismissalEvents,
  dismissalState,
  playerDismissals,
  reloadDismissals,
} from "../app-dismissals.js";
import { fmt, today, teamOwner, sortPlayers } from "../app-part1.js";
import { canOperateRole } from "../app-roles.js";
import { confirmDialog } from "../app-confirm.js";

export function DismissalRecords({
  runtime,
  playerId,
}: {
  runtime: Runtime;
  playerId: string;
}) {
  const records = playerDismissals(playerId),
    operate = canOperateRole(runtime.state.team?.role || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  if (!records.length) return null;
  return (
    <section className="dismissal-section">
      <h4>Espulsioni e squalifiche</h4>
      {records.map((d) => (
        <article className="dismissal-record" key={d.event.id}>
          <div className="dismissal-heading">
            <b>
              {fmt(d.event.match_date)} ·{" "}
              {d.event.opponent || "Gara registrata"}
            </b>
            <span className={`badge ${d.tone}`}>{d.label}</span>
          </div>
          <p className="row-sub">
            {d.event.minute == null
              ? "Minuto non indicato"
              : `${d.event.minute}′`}
            {d.event.match_date < disciplineSeason().from
              ? " · Stagione precedente"
              : ""}
            {d.sanction?.kind === "matches"
              ? ` · ${d.valid.length}/${d.sanction.match_count} giornate confermate`
              : ""}
          </p>
          {d.sanction?.note ? (
            <p className="dismissal-note">
              {d.sanction.voided ? "Indicazione precedente: " : ""}
              {d.sanction.note}
            </p>
          ) : null}
          {operate ? (
            <div className="dismissal-actions">
              <Button
                variant="secondary"
                data-sanction-event={d.event.id}
                onClick={() => ui.open("sanction", { eventId: d.event.id })}
              >
                {d.sanction?.voided
                  ? "Consulta o riattiva"
                  : d.sanction
                    ? "Modifica provvedimento"
                    : "Registra provvedimento"}
              </Button>
              {d.sanction &&
              !d.sanction.voided &&
              d.sanction.kind === "matches" &&
              d.remaining > 0 &&
              !d.review.length &&
              d.event.activity_status !== "Annullato" ? (
                <Button
                  variant="secondary"
                  data-dismissal-serve={d.event.id}
                  onClick={() =>
                    ui.open("dismissal-clearance", { eventId: d.event.id })
                  }
                >
                  Conferma gara scontata
                </Button>
              ) : null}
            </div>
          ) : null}
          {d.clearances.length ? (
            <details className="field-space">
              <summary>Gare confermate ({d.clearances.length})</summary>
              <div className="dismissal-served-list">
                {d.clearances.map((c) => (
                  <div key={c.id}>
                    <span>
                      {fmt(c.match_date)} · {c.opponent || "Gara registrata"}
                      <small>
                        {d.valid.includes(c)
                          ? "Scontata"
                          : "Conferma da verificare"}
                      </small>
                    </span>
                    {operate ? (
                      <Button
                        variant="secondary"
                        data-dismissal-undo={c.id}
                        disabled={busy}
                        onClick={async () => {
                          if (lock.current) return;
                          lock.current = true;
                          setBusy(true);
                          const current = runtime.requestGuard();
                          try {
                            if (
                              !(await confirmDialog({
                                title: "Annulla gara scontata",
                                message:
                                  "Annullare questa conferma? La giornata tornerà da scontare.",
                                confirmLabel: "Annulla conferma",
                                danger: true,
                              })) ||
                              !current() ||
                              !canOperateRole(runtime.state.team?.role || "")
                            )
                              return;
                            const { error } = await runtime.db
                              .from("dismissal_clearances")
                              .delete()
                              .eq("id", c.id)
                              .eq("user_id", teamOwner());
                            if (error) throw error;
                            await reloadDismissals(current);
                          } catch (cause) {
                            if (current()) setError((cause as Error).message);
                          } finally {
                            lock.current = false;
                            setBusy(false);
                          }
                        }}
                      >
                        Annulla conferma
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </article>
      ))}
      <Feedback error={error} />
    </section>
  );
}
export function Discipline({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { playerId } = surface.data as { playerId?: string | null },
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    season = disciplineSeason();
  const players = sortPlayers(runtime.state.players)
    .filter(
      (p) =>
        p.active ||
        p.id === playerId ||
        playerDiscipline(p.id).total > 0 ||
        playerDismissals(p.id).length > 0,
    )
    .sort((a, b) => {
      const x = playerDiscipline(a.id),
        y = playerDiscipline(b.id);
      return (
        Number(y.redAttention) - Number(x.redAttention) ||
        y.pending.length - x.pending.length ||
        Number(y.diffida) - Number(x.diffida) ||
        y.total - x.total
      );
    })
    .filter(
      (p) =>
        (!playerId || p.id === playerId) &&
        `${p.surname} ${p.name}`
          .toLocaleLowerCase("it")
          .includes(search.toLocaleLowerCase("it")),
    )
    .filter((p) => {
      const d = playerDiscipline(p.id);
      return (
        filter === "all" ||
        (filter === "reds" && playerDismissals(p.id).length > 0) ||
        (filter === "attention" &&
          (d.diffida || d.pending.length || d.review.length || d.redAttention))
      );
    });
  const unassigned = dismissalEvents().filter((e) => !e.player_id).length;
  return (
    <EditorFrame
      surface={surface}
      title="Cartellini e diffide"
      titleId="disciplineTitle"
      description={`Stagione ${season.key}`}
      closeLabel="Chiudi cartellini"
    >
      <details className="discipline-rules">
        <summary>Come leggere i cartellini</summary>
        <p>
          Regola impostata: ogni 5 ammonizioni, una gara da saltare. A 4, 9, 14…
          gialli il giocatore è a un cartellino dalla prossima soglia. Le
          partite annullate sono escluse. Per le espulsioni registra il
          provvedimento del comunicato ufficiale.
        </p>
      </details>
      <Field id="disciplineSearch" label="Cerca giocatore">
        <input
          id="disciplineSearch"
          type="search"
          placeholder="Nome o cognome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      <div
        className="workflow-switch field-space"
        role="group"
        aria-label="Filtro cartellini"
      >
        {[
          ["all", "Tutti"],
          ["attention", "Da verificare"],
          ["reds", "Espulsioni"],
        ].map(([key, label]) => (
          <button
            key={key}
            data-discipline-filter={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <p id="unassignedDismissals" className="notice" hidden={!unassigned}>
        {unassigned} espulsioni senza giocatore associato. Completa l’evento
        nella scheda della partita.
      </p>
      <div id="disciplineList" className="list">
        {players.map((p) => {
          const d = playerDiscipline(p.id),
            redOnly = filter === "reds";
          return (
            <article className="discipline-card" key={p.id}>
              <h3>
                {p.surname} {p.name}
              </h3>
              <p className="row-sub">
                {p.role}
                {p.active ? "" : " · Inattivo"}
              </p>
              <div
                className="discipline-totals"
                aria-label={
                  redOnly ? "Espulsioni visibili" : "Cartellini della stagione"
                }
              >
                {redOnly ? null : (
                  <div className="discipline-total">
                    <span className="discipline-symbol discipline-symbol-yellow">
                      <RectangleVertical size={20} />
                    </span>
                    <strong>{d.total}</strong>
                    <span>{d.total === 1 ? "Giallo" : "Gialli"}</span>
                  </div>
                )}
                <div className="discipline-total">
                  <span className="discipline-symbol discipline-symbol-red">
                    <RectangleVertical size={20} />
                  </span>
                  <strong>{redOnly ? d.dismissals.length : d.reds}</strong>
                  <span>
                    {(redOnly ? d.dismissals.length : d.reds) === 1
                      ? "Rosso"
                      : "Rossi"}
                  </span>
                </div>
              </div>
              {!redOnly && (d.total || d.confirmed.length) ? (
                <section className="discipline-yellows">
                  <h4>Ammonizioni e diffide</h4>
                  <div
                    className="discipline-progress"
                    role="img"
                    aria-label={`${d.current} ammonizioni su 5 verso la prossima soglia`}
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={i < d.current ? "filled" : ""}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="row-sub">
                    {d.current}/5 verso la prossima soglia
                    {d.diffida ? " · Diffida: manca un giallo" : ""}
                  </p>
                  {d.pending.map((e) => (
                    <div className="row" key={e.id}>
                      <span>
                        Soglia raggiunta il{" "}
                        {fmt(d.matches.get(e.match_id)?.match_date)}
                      </span>
                      {canOperateRole(runtime.state.team?.role || "") ? (
                        <Button
                          variant="secondary"
                          data-clearance={e.id}
                          data-clearance-event={e.id}
                          data-clearance-player={p.id}
                          onClick={() =>
                            ui.open("yellow-clearance", {
                              playerId: p.id,
                              eventId: e.id,
                            })
                          }
                        >
                          Conferma gara scontata
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {d.confirmed.map((c) => (
                    <div className="row" key={c.id}>
                      <span>
                        {d.valid.includes(c)
                          ? "Gara scontata"
                          : "Conferma da verificare"}{" "}
                        ·{" "}
                        {d.matches.get(c.served_match_id)?.opponent ||
                          "Gara registrata"}
                      </span>
                      {canOperateRole(runtime.state.team?.role || "") ? (
                        <YellowUndo runtime={runtime} id={c.id} />
                      ) : null}
                    </div>
                  ))}
                </section>
              ) : null}
              <DismissalRecords runtime={runtime} playerId={p.id} />
              {!redOnly && d.events.length ? (
                <details className="discipline-history">
                  <summary>Storico cartellini ({d.events.length})</summary>
                  {d.events.map((e) => (
                    <div className="discipline-event" key={e.id}>
                      <span
                        className={`badge ${e.event_type === "Espulsione" ? "b-red" : "b-yellow"}`}
                      >
                        {e.event_type}
                      </span>
                      <div>
                        <b>
                          {fmt(d.matches.get(e.match_id)?.match_date)} ·{" "}
                          {d.matches.get(e.match_id)?.opponent}
                        </b>
                        <p>
                          {e.minute == null
                            ? "Minuto non indicato"
                            : e.minute + "′"}
                          {e.detail ? " · " + e.detail : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </details>
              ) : null}
            </article>
          );
        })}
      </div>
    </EditorFrame>
  );
}
function YellowUndo({ runtime, id }: { runtime: Runtime; id: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  return (
    <>
      <Button
        variant="secondary"
        disabled={busy}
        data-undo-clearance={id}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          const current = runtime.requestGuard();
          try {
            if (
              !(await confirmDialog({
                message: "Annullare la conferma della gara scontata?",
                confirmLabel: "Annulla conferma",
                danger: true,
              })) ||
              !current() ||
              !canOperateRole(runtime.state.team?.role || "")
            )
              return;
            const { error } = await runtime.db
              .from("disciplinary_clearances")
              .delete()
              .eq("id", id)
              .eq("user_id", teamOwner());
            if (error) throw error;
            if (current()) await runtime.actions.reload();
          } catch (cause) {
            if (current()) setError((cause as Error).message);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        Annulla conferma
      </Button>
      <Feedback error={error} />
    </>
  );
}
export function Sanction({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { eventId } = surface.data as { eventId: string },
    event = dismissalEvents().find((e) => e.id === eventId),
    existing = event ? dismissalState(event).sanction : undefined,
    persisted = useRef(false);
  const editor = useEditor(runtime, surface, {
    kind: existing?.kind || "matches",
    match_count: String(existing?.match_count || 1),
    suspended_until: existing?.suspended_until || "",
    note: existing?.note || "",
  });
  if (!event || !canOperateRole(runtime.state.team?.role || "")) return null;
  const save = (voided = false) =>
    editor.run(async () => {
      if (voided && !existing) throw Error("Provvedimento non disponibile");
      if (
        voided &&
        !(await confirmDialog({
          title: "Annulla provvedimento",
          message:
            "Annullare questo provvedimento? Espulsione e conferme resteranno nello storico.",
          confirmLabel: "Annulla provvedimento",
          danger: true,
        }))
      )
        return;
      if (!editor.current()) return;
      const v = editor.value,
        count = v.kind === "matches" ? Number(v.match_count) : null,
        until = v.kind === "until" ? v.suspended_until : null;
      if (
        !voided &&
        ((v.kind === "matches" &&
          (!Number.isInteger(count) || count! < 1 || count! > 100)) ||
          (v.kind === "until" && (!until || until < event.match_date)))
      )
        throw Error(
          "Inserisci da 1 a 100 giornate, oppure una data non precedente alla gara.",
        );
      if (!persisted.current) {
        const { error } = await runtime.db.rpc("save_dismissal_sanction", {
          p_event_id: eventId,
          p_revision: existing?.revision ?? null,
          p_values: {
            kind: voided ? existing!.kind : v.kind,
            match_count: voided ? existing!.match_count : count,
            suspended_until: voided ? existing!.suspended_until : until,
            note: voided ? existing!.note : v.note.trim() || null,
            voided,
          },
        });
        if (error) throw error;
        persisted.current = true;
        editor.clean();
      }
      try {
        if (await reloadDismissals(editor.current)) await editor.close();
      } catch {
        throw Error(
          "Provvedimento salvato. Lettura non riuscita: premi Ricarica dati.",
        );
      }
    });
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title="Provvedimento per espulsione"
      titleId="sanctionTitle"
      closeLabel="Chiudi provvedimento"
    >
      <p>
        {fmt(event.match_date)} · {event.opponent}
      </p>
      <p className="row-sub">
        Inserisci la durata stabilita dal comunicato ufficiale. La scadenza per
        data è inclusa.
      </p>
      <form
        id="sanctionForm"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={editor.busy || persisted.current}>
          <Field id="sanctionKind" label="Tipo di squalifica">
            <select
              id="sanctionKind"
              value={editor.value.kind}
              onChange={(e) =>
                editor.setValue({ ...editor.value, kind: e.target.value })
              }
            >
              <option value="matches">Giornate da scontare</option>
              <option value="until">Fino a una data</option>
            </select>
          </Field>
          {editor.value.kind === "matches" ? (
            <Field id="sanctionGames" label="Giornate">
              <input
                id="sanctionGames"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                required
                value={editor.value.match_count}
                onChange={(e) =>
                  editor.setValue({
                    ...editor.value,
                    match_count: e.target.value,
                  })
                }
              />
            </Field>
          ) : (
            <Field id="sanctionUntil" label="Squalificato fino al (compreso)">
              <input
                id="sanctionUntil"
                type="date"
                min={event.match_date}
                required
                value={editor.value.suspended_until}
                onChange={(e) =>
                  editor.setValue({
                    ...editor.value,
                    suspended_until: e.target.value,
                  })
                }
              />
            </Field>
          )}
          <Field id="sanctionNote" label="Riferimento al comunicato / note">
            <textarea
              id="sanctionNote"
              maxLength={2000}
              value={editor.value.note}
              onChange={(e) =>
                editor.setValue({ ...editor.value, note: e.target.value })
              }
            />
          </Field>
        </fieldset>
        <div className="modal-actions">
          <Button type="submit" disabled={editor.busy}>
            {persisted.current ? "Ricarica dati" : "Salva provvedimento"}
          </Button>
          {existing && !existing.voided ? (
            <Button
              id="voidSanction"
              variant="destructive"
              disabled={editor.busy || persisted.current}
              onClick={() => void save(true)}
            >
              Annulla provvedimento
            </Button>
          ) : null}
        </div>
        <Feedback id="sanctionFeedback" error={editor.error} />
      </form>
    </EditorFrame>
  );
}
export function DisciplineClearance({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const data = surface.data as { eventId: string; playerId?: string },
    yellow = surface.kind === "yellow-clearance",
    redEvent = dismissalEvents().find((e) => e.id === data.eventId),
    yellowEvent = runtime.state.events.find((e) => e.id === data.eventId),
    event = yellow ? yellowEvent : redEvent,
    playerId = yellow ? data.playerId : event?.player_id,
    persisted = useRef(false),
    editor = useEditor(runtime, surface, { match: "", confirmed: false });
  if (!event || !playerId || !canOperateRole(runtime.state.team?.role || ""))
    return null;
  const date = yellow
    ? runtime.state.matches.find((m) => m.id === (event as MatchEvent).match_id)
        ?.match_date
    : redEvent?.match_date;
  const choices = runtime.state.matches.filter(
    (m) =>
      m.match_date > (date || "") &&
      m.match_date <= today() &&
      !runtime.state.disciplinary_clearances.some(
        (c) => c.player_id === playerId && c.served_match_id === m.id,
      ) &&
      !runtime.state.dismissal_clearances.some(
        (c) => c.player_id === playerId && c.match_id === m.id,
      ) &&
      m.goals_for != null &&
      m.goals_against != null &&
      !runtime.state.activities.some(
        (a) => a.match_id === m.id && a.status === "Annullato",
      ) &&
      !runtime.state.roster.some(
        (r) =>
          r.player_id === playerId &&
          r.minutes_played > 0 &&
          runtime.state.activities.some(
            (a) => a.id === r.activity_id && a.match_id === m.id,
          ),
      ),
  );
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title="Conferma gara scontata"
      closeLabel="Chiudi gara scontata"
    >
      <p>
        Espulsione / soglia del {fmt(date || "")}. Una gara può coprire una sola
        squalifica.
      </p>
      <form
        id={yellow ? "clearanceForm" : "dismissalClearanceForm"}
        onSubmit={(e) => {
          e.preventDefault();
          void editor.run(async () => {
            if (
              !choices.some((m) => m.id === editor.value.match) ||
              !editor.value.confirmed
            )
              throw Error(
                "Seleziona la gara e conferma che è stata saltata per squalifica.",
              );
            if (!persisted.current) {
              const result = yellow
                ? await runtime.db.from("disciplinary_clearances").insert({
                    user_id: teamOwner(),
                    player_id: playerId,
                    season_start: disciplineSeason().from,
                    threshold_event_id: data.eventId,
                    served_match_id: editor.value.match,
                  })
                : await runtime.db.rpc("confirm_dismissal_match", {
                    p_event_id: data.eventId,
                    p_match_id: editor.value.match,
                  });
              if (result.error) throw result.error;
              persisted.current = true;
              editor.clean();
            }
            try {
              if (yellow) {
                if (!(await runtime.actions.reload()))
                  throw Error("Lettura non riuscita");
              } else await reloadDismissals(editor.current);
              if (editor.current()) await editor.close();
            } catch {
              throw Error(
                "Conferma salvata. Lettura non riuscita: premi Ricarica dati.",
              );
            }
          });
        }}
      >
        <fieldset disabled={editor.busy || persisted.current}>
          <Field
            id={yellow ? "servedMatch" : "dismissalServedMatch"}
            label="Gara saltata"
          >
            <select
              id={yellow ? "servedMatch" : "dismissalServedMatch"}
              required
              value={editor.value.match}
              onChange={(e) =>
                editor.setValue({ ...editor.value, match: e.target.value })
              }
            >
              <option value="">Seleziona una gara</option>
              {choices.map((m) => (
                <option key={m.id} value={m.id}>
                  {fmt(m.match_date)} · {m.opponent}
                </option>
              ))}
            </select>
          </Field>
          <label className="reminder-option field-space">
            <input
              id="dismissalServedConfirmed"
              type="checkbox"
              required
              checked={editor.value.confirmed}
              onChange={(e) =>
                editor.setValue({
                  ...editor.value,
                  confirmed: e.target.checked,
                })
              }
            />
            Confermo che il giocatore ha saltato la gara per questa squalifica.
          </label>
        </fieldset>
        <Button type="submit" disabled={editor.busy || !choices.length}>
          {persisted.current ? "Ricarica dati" : "Conferma giornata scontata"}
        </Button>
        <Feedback id="dismissalClearanceFeedback" error={editor.error} />
      </form>
    </EditorFrame>
  );
}
