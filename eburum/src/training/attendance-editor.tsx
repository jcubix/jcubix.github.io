import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { confirmDialog } from "../../app-confirm.js";
import { fmt, today } from "../../app-part1.js";
import {
  attendanceCounts,
  draftChanged,
  getTrainingDraft,
} from "../../app-part3.js";
import { canOperateRole, canPlanRole } from "../../app-roles.ts";
import { Button } from "../components/ui/button";
import { Feedback, Field } from "../operational-ui";
import type { Runtime, TrainingDraft } from "../types";
import { ui } from "../ui-service";

export function AttendanceEditor({ runtime }: { runtime: Runtime }) {
  const navigate = useNavigate();
  const [, paint] = useState(0),
    [error, setError] = useState("");
  const d = getTrainingDraft() as TrainingDraft,
    operate = canOperateRole(runtime.state.team?.role || "");
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (draftChanged(d) || d.saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [d]);
  if (!operate)
    return (
      <p>Le presenze possono essere registrate dallo staff autorizzato.</p>
    );
  const counts = attendanceCounts(d.entries.values()),
    update = () => paint((n) => n + 1),
    rows = d.players.filter((p) => {
      const row = d.entries.get(p.id)!;
      return (
        `${p.surname} ${p.name} ${p.role}`
          .toLocaleLowerCase("it")
          .includes(d.search.toLocaleLowerCase("it")) &&
        (d.filter === "all" ||
          (d.filter === "pending" &&
            !["Presente", "Assente", "Infortunato"].includes(row.status)) ||
          (d.filter === "exceptions" &&
            ["Assente", "Infortunato"].includes(row.status)))
      );
    });
  const review = () => {
    if (!d.session.session_date || d.session.session_date > today())
      return setError(
        "Le presenze effettive non possono essere registrate per una data futura. Registra invece le assenze comunicate.",
      );
    if (!d.id && !d.activityId)
      return setError("Apri un allenamento salvato per registrare le presenze");
    if (!d.players.length)
      return setError(
        "Aggiungi almeno un giocatore alla rosa prima di salvare",
      );
    if (counts.pending) {
      d.filter = "pending";
      update();
      return setError(
        `Conferma la presenza di ${counts.pending} giocatori prima di salvare`,
      );
    }
    ui.open("attendance-review", { draft: d });
  };
  return (
    <>
      <div className="section-title">
        <h2>{d.id ? "Correggi presenze" : "Presenze effettive"}</h2>
        <button
          id="backToTrainings"
          className="office-text-action"
          onClick={async () => {
            const current = runtime.requestGuard();
            if (
              d.saving ||
              (draftChanged(d) &&
                !(await confirmDialog({
                  message:
                    "Uscire dalle presenze non salvate? La bozza resta disponibile in questa sessione.",
                  confirmLabel: "Esci dalle presenze",
                })))
            )
              return;
            if (!current()) return;
            runtime.state.trainingMode = "hub";
            if (d.originPage === "register") {
              runtime.state.registerDate = d.session.session_date;
              runtime.state.registerMonth = d.session.session_date.slice(0, 7);
              runtime.state.page = "register";
              navigate(
                "/register?" +
                  new URLSearchParams({
                    date: runtime.state.registerDate,
                    month: runtime.state.registerMonth,
                  }),
                { replace: true },
              );
            }
            runtime.render();
          }}
        >
          {" "}
          {d.originPage === "register" ? "Registro" : "Allenamenti"}
        </button>
      </div>
      <section className="training-work-panel actual-presence-panel">
        <fieldset disabled={d.saving}>
          {d.activityId ? (
            <nav className="training-phase-tabs" aria-label="Fase allenamento">
              <button
                id="backToTrainingReplies"
                onClick={async () => {
                  const current = runtime.requestGuard();
                  if (
                    draftChanged(d) &&
                    !(await confirmDialog({
                      message:
                        "Scartare le modifiche alle presenze non salvate?",
                      confirmLabel: "Scarta",
                    }))
                  )
                    return;
                  if (!current()) return;
                  runtime.state.trainingMode = "hub";
                  runtime.state.trainingDraft = null;
                  runtime.render();
                  if (d.activityId)
                    await runtime.actions.openActivity(d.activityId);
                }}
              >
                Assenze comunicate
              </button>
              <button aria-current="page">Presenze effettive</button>
            </nav>
          ) : null}
          <details className="actual-session-context">
            <summary>
              {fmt(d.session.session_date)} · {d.session.session_type}
            </summary>
            <div className="form-grid">
              <Field id="td" label="Data">
                <input
                  id="td"
                  type="date"
                  readOnly={
                    (!!d.activityId && !d.id) ||
                    !canPlanRole(runtime.state.team?.role || "")
                  }
                  value={d.session.session_date}
                  onChange={(e) => {
                    d.session.session_date = e.target.value;
                    update();
                  }}
                />
              </Field>
              <Field id="tn" label="Nota sessione · Facoltativa">
                <textarea
                  id="tn"
                  maxLength={10000}
                  value={d.session.note || ""}
                  onChange={(e) => {
                    d.session.note = e.target.value || null;
                    update();
                  }}
                />
              </Field>
            </div>
          </details>
          <div
            id="trainingCounts"
            className="attendance-counts"
            aria-live="polite"
          >
            {[
              [counts.present, "Presenti"],
              [counts.absent, "Assenti"],
              [counts.injured, "Infortunati"],
              [counts.pending, "Da confermare"],
            ].map(([n, label]) => (
              <span className="attendance-count" key={label}>
                <b>{n}</b>
                {label}
              </span>
            ))}
          </div>
          <div className="training-controls">
            <Field id="trainingSearch" label="Cerca un giocatore">
              <input
                id="trainingSearch"
                type="search"
                value={d.search}
                onChange={(e) => {
                  d.search = e.target.value;
                  update();
                }}
              />
            </Field>
            <div
              className="attendance-filters"
              role="group"
              aria-label="Filtra presenze"
            >
              {[
                ["all", "Tutti"],
                ["exceptions", "Assenti / infortunati"],
                ["pending", "Da confermare"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  data-attendance-filter={key}
                  aria-pressed={d.filter === key}
                  onClick={() => {
                    d.filter = key;
                    update();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p id="trainingVisible" className="row-sub">
              {rows.length} di {d.players.length} giocatori mostrati. Il
              salvataggio include tutto l’allenamento.
            </p>
          </div>
          <div className="list" id="trainList">
            {rows.map((p) => {
              const a = d.entries.get(p.id)!;
              return (
                <article className="row attendance-row" key={p.id}>
                  <div className="row-main">
                    <b>
                      {p.surname} {p.name}
                    </b>
                    <small>
                      {p.role}
                      {!p.active ? " · Inattivo" : ""}
                    </small>
                    {d.planned ? (
                      <small className="planned-reply">
                        {d.planned.get(p.id) === "Indisponibile"
                          ? "Assenza comunicata"
                          : "Atteso all’allenamento"}
                      </small>
                    ) : null}
                    {a.note ? (
                      <p className="attendance-note">{a.note}</p>
                    ) : null}
                  </div>
                  <span className="badge tone-neutral">{a.status}</span>
                  <div className="attendance-actions">
                    <div
                      className="attendance-quick"
                      role="group"
                      aria-label={`Presenze e note di ${p.surname} ${p.name}`}
                    >
                      {["Presente", "Assente", "Infortunato"].map((status) => (
                        <button
                          key={status}
                          data-presence-player={p.id}
                          data-presence={status}
                          aria-pressed={a.status === status}
                          onClick={() => {
                            a.status = status;
                            update();
                          }}
                        >
                          {status}
                        </button>
                      ))}
                      <button
                        data-a={p.id}
                        aria-label={`Modifica presenza e nota di ${p.surname} ${p.name}`}
                        onClick={() =>
                          ui.open("attendance-note", {
                            draft: d,
                            playerId: p.id,
                            onSaved: update,
                          })
                        }
                      >
                        Nota
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </fieldset>
      </section>
      <div className="training-save">
        <Button id="saveTraining" disabled={d.saving} onClick={review}>
          {d.id ? "Riepilogo correzioni" : "Riepilogo e salva"}
        </Button>
        <Feedback
          id="trainingSaveStatus"
          error={error || "Bozza · I report si aggiornano dopo la conferma"}
        />
      </div>
    </>
  );
}
