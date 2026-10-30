import { Fragment } from "react";
import { fmt } from "../../app-part1.js";
import { dismissalAlert } from "../../app-dismissals.js";
import { callupMessage } from "../../app-operations.js";
import { Button } from "../components/ui/button";
import { ActionBar, CopyText, Feedback, Field } from "../operational-ui";
import type { RosterRow } from "../types";
import { ui } from "../ui-service";
import { useMatchEditor } from "./use-match-editor";
export function MatchOrganization({
  model,
}: {
  model: ReturnType<typeof useMatchEditor>;
}) {
  const {
    a,
    called,
    callup,
    editor,
    m,
    onlyCalled,
    plan,
    players,
    saveOrganization,
    search,
    setCallup,
    setOnlyCalled,
    setSearch,
    starters,
    surface,
    tab,
    technical,
    v,
  } = model;

  return (
    <form
      id="activityForm"
      hidden={tab === "results"}
      onSubmit={(e) => {
        e.preventDefault();
        void saveOrganization();
      }}
    >
      <fieldset disabled={editor.busy}>
        <section
          id="match-panel-details"
          role={a.id ? "tabpanel" : undefined}
          aria-labelledby={a.id ? "match-tab-details" : undefined}
          aria-label={a.id ? undefined : "Organizzazione"}
          data-activity-panel="details"
          hidden={tab !== "details"}
        >
          <fieldset disabled={!plan}>
            <div className="form-grid">
              {(
                [
                  ["title", "Titolo / avversario", "text", "activityName"],
                  ["activity_date", "Data", "date", "activityDate"],
                  ["start_time", "Inizio", "time", "activityStart"],
                  ["end_time", "Fine", "time", "activityEnd"],
                  ["venue", "Dove si gioca", "select", "activityVenue"],
                  ["location", "Campo / luogo", "text", "activityLocation"],
                  [
                    "meeting_time",
                    "Ora ritrovo",
                    "time",
                    "activityMeetingTime",
                  ],
                  [
                    "meeting_place",
                    "Luogo ritrovo",
                    "text",
                    "activityMeetingPlace",
                  ],
                ] as const
              ).map(([key, label, type, id]) => (
                <Field id={id} label={label} key={key}>
                  {key === "venue" ? (
                    <select
                      id={id}
                      value={v.activity.venue}
                      onChange={(e) =>
                        editor.setValue({
                          ...v,
                          activity: { ...v.activity, venue: e.target.value },
                        })
                      }
                    >
                      <option>Casa</option>
                      <option>Trasferta</option>
                    </select>
                  ) : (
                    <input
                      id={id}
                      type={type}
                      required={key === "title" || key === "activity_date"}
                      maxLength={
                        key === "location" || key === "meeting_place"
                          ? 500
                          : 160
                      }
                      value={v.activity[key]}
                      onChange={(e) =>
                        editor.setValue({
                          ...v,
                          activity: { ...v.activity, [key]: e.target.value },
                        })
                      }
                    />
                  )}
                  {key === "activity_date" && v.activity.activity_date ? (
                    <small>{fmt(v.activity.activity_date)}</small>
                  ) : null}
                </Field>
              ))}
              {a.id ? (
                <Field id="activityState" label="Stato">
                  <select
                    id="activityState"
                    value={v.activity.status}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        activity: { ...v.activity, status: e.target.value },
                      })
                    }
                  >
                    {["Programmato", "Concluso", "Annullato"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
            <Field id="activityNote" label="Indicazioni per lo staff">
              <textarea
                id="activityNote"
                maxLength={10000}
                value={v.activity.organization_note}
                onChange={(e) =>
                  editor.setValue({
                    ...v,
                    activity: {
                      ...v.activity,
                      organization_note: e.target.value,
                    },
                  })
                }
              />
            </Field>
          </fieldset>
        </section>
        <section
          id="match-panel-roster"
          role="tabpanel"
          aria-labelledby="match-tab-roster"
          data-activity-panel="roster"
          hidden={tab !== "roster"}
        >
          <p id="matchReadiness" className="notice">
            {called.length} convocati · {starters.length}/11 titolari
            {starters.length !== 11 ? " · Formazione da completare" : ""}
          </p>
          <Field id="rosterSearch" label="Cerca giocatore">
            <input
              id="rosterSearch"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <div
            className="workflow-switch"
            role="group"
            aria-label="Filtra convocazioni"
          >
            <button
              type="button"
              data-roster-filter="all"
              aria-pressed={!onlyCalled}
              onClick={() => setOnlyCalled(false)}
            >
              Rosa
            </button>
            <button
              type="button"
              data-roster-filter="called"
              aria-pressed={onlyCalled}
              onClick={() => setOnlyCalled(true)}
            >
              Convocati
            </button>
          </div>
          <p id="rosterCounts" className="attendance-counts">
            {called.length} convocati · {starters.length} titolari ·{" "}
            {called.filter((r) => r.lineup === "Panchina").length} panchina
          </p>
          <div id="activityRoster" className="list">
            {players
              .filter((p) =>
                `${p.surname} ${p.name} ${p.role}`
                  .toLocaleLowerCase("it")
                  .includes(search.toLocaleLowerCase("it")),
              )
              .filter(
                (p) =>
                  !onlyCalled ||
                  v.rows.find((r) => r.player_id === p.id)?.called,
              )
              .map((p, index, visible) => {
                const row = v.rows.find((r) => r.player_id === p.id)!,
                  patch = (values: Partial<RosterRow>) =>
                    editor.setValue({
                      ...v,
                      rows: v.rows.map((r) =>
                        r.player_id === p.id ? { ...r, ...values } : r,
                      ),
                    });
                return (
                  <Fragment key={p.id}>
                    {index === 0 || visible[index - 1].role !== p.role ? (
                      <h4 className="roster-role">{p.role}</h4>
                    ) : null}
                    <article className="roster-person">
                      <label>
                        <input
                          type="checkbox"
                          data-called={p.id}
                          disabled={!plan}
                          checked={row.called}
                          onChange={(e) =>
                            patch({
                              called: e.target.checked,
                              ...(!e.target.checked
                                ? {
                                    lineup: "Non impiegato",
                                    minutes_played: 0,
                                    position: null,
                                  }
                                : {}),
                            })
                          }
                        />
                        <span>
                          <b>
                            {p.surname} {p.name}
                          </b>
                          <small>{p.role}</small>
                          {dismissalAlert(p.id, v.activity.activity_date) ? (
                            <small className="roster-suspension">
                              {dismissalAlert(p.id, v.activity.activity_date)}
                            </small>
                          ) : null}
                        </span>
                      </label>
                      <div className="roster-quick-controls">
                        <select
                          aria-label={`Impiego di ${p.surname} ${p.name}`}
                          data-roster-lineup={p.id}
                          disabled={!plan || !row.called}
                          value={row.lineup}
                          onChange={(e) => {
                            if (
                              e.target.value === "Titolare" &&
                              starters.length >= 11
                            )
                              return editor.setError("Al massimo 11 titolari");
                            patch({ lineup: e.target.value });
                          }}
                        >
                          {["Non impiegato", "Titolare", "Panchina"].map(
                            (value) => (
                              <option key={value}>{value}</option>
                            ),
                          )}
                        </select>
                        <Button
                          variant="secondary"
                          data-roster-edit={p.id}
                          disabled={!plan}
                          onClick={() =>
                            ui.open("roster", {
                              player: p,
                              row,
                              onSaved: patch,
                              automatic: !!m?.minutes_auto,
                              duration: m?.duration_minutes || 90,
                              limited: !plan,
                            })
                          }
                        >
                          Dettagli
                        </Button>
                      </div>
                      <small className="row-sub">
                        {row.called
                          ? `Convocato · ${row.lineup} · ${row.minutes_played} min`
                          : "Non convocato"}
                      </small>
                    </article>
                  </Fragment>
                );
              })}
          </div>
          <details className="field-space">
            <summary>Formazione e note tecniche</summary>
            {technical ? (
              <>
                <Field id="formation" label="Modulo">
                  <input
                    id="formation"
                    disabled={!plan}
                    maxLength={30}
                    value={v.technical.formation}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        technical: {
                          ...v.technical,
                          formation: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <div
                  className="formation-preview"
                  aria-label="Formazione titolare"
                >
                  {[
                    "Attaccante",
                    "Centrocampista",
                    "Difensore",
                    "Portiere",
                  ].map((role) => (
                    <div className="pitch-line" key={role}>
                      {starters
                        .filter(
                          (r) =>
                            players.find((p) => p.id === r.player_id)?.role ===
                            role,
                        )
                        .map((r) => {
                          const p = players.find((p) => p.id === r.player_id)!;
                          return (
                            <span className="pitch-player" key={r.player_id}>
                              <b>{p.shirt_number ?? "•"}</b>
                              <span>{p.surname}</span>
                              <small>{r.position || role}</small>
                            </span>
                          );
                        })}
                    </div>
                  ))}
                </div>
                <Field id="technicalNote" label="Osservazioni tecniche">
                  <textarea
                    id="technicalNote"
                    maxLength={10000}
                    value={v.technical.note}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        technical: { ...v.technical, note: e.target.value },
                      })
                    }
                  />
                </Field>
              </>
            ) : null}
          </details>
          <section className="callup-copy field-space">
            <h3>Comunicazione ai convocati</h3>
            <p className="row-sub">
              Il testo comprende organizzazione e nomi dei convocati. Puoi
              rivederlo prima di copiarlo.
            </p>
            <Button
              variant="secondary"
              id="previewCallup"
              onClick={() =>
                setCallup(
                  (editor.dirty || !a.id
                    ? "BOZZA · organizzazione e convocazioni non ancora salvate\n\n"
                    : "") +
                    callupMessage(
                      { ...a, ...v.activity, activity_type: "Partita" },
                      v.rows,
                      players,
                    ),
                )
              }
            >
              Prepara convocazione
            </Button>
            {callup !== null ? (
              <div id="callupPreview">
                <textarea
                  id="callupText"
                  rows={9}
                  aria-label="Testo convocazione da rivedere"
                  value={callup}
                  onChange={(e) => setCallup(e.target.value)}
                />
                <CopyText
                  id="copyCallup"
                  text={callup}
                  label="Copia convocazione"
                />
              </div>
            ) : null}
          </section>
        </section>
        <ActionBar
          className="modal-actions workspace-save"
          hidden={tab === "results"}
        >
          <Button
            id="cancelActivity"
            variant="secondary"
            disabled={editor.busy}
            onClick={() => void ui.close(surface.id)}
          >
            Annulla
          </Button>
          <Button
            type="submit"
            form="activityForm"
            disabled={editor.busy}
            aria-label={!plan ? "Salva osservazioni tecniche" : undefined}
          >
            {a.id ? "Salva" : "Crea partita"}
          </Button>
        </ActionBar>
      </fieldset>
      <Feedback id="activityFeedback" error={editor.error} />
    </form>
  );
}
