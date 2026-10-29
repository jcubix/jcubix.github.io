import { ArrowUpRight, Check, ClipboardList, Minus, X } from "lucide-react";
import { fmt, today } from "../../app-part1.js";
import { attendanceMessage } from "../../app-workflow-tools.js";
import { Button } from "../components/ui/button";
import { CopyText, EditorFrame, Feedback, Field } from "../operational-ui";
import { ui } from "../ui-service";
import { usePlanningEditor } from "./use-planning-editor";
export function PlanningEditor(props: Parameters<typeof usePlanningEditor>[0]) {
  const model = usePlanningEditor(props);
  const {
    a,
    actual,
    count,
    editor,
    inline,
    legacy,
    operate,
    pending,
    pendingOnly,
    phase,
    plan,
    players,
    runtime,
    save,
    search,
    setPendingOnly,
    setPhase,
    setSearch,
    surface,
    training,
    v,
  } = model;
  const content = (
    <div className="training-work-panel">
      <nav
        className="training-phase-tabs"
        aria-label="Fase allenamento"
        hidden={!a.id || !training}
      >
        <button
          data-training-phase="replies"
          aria-current={phase === "poll" ? "page" : undefined}
          onClick={() => setPhase("poll")}
        >
          {legacy ? "Risposte WhatsApp · storico" : "Assenze comunicate"}
        </button>
        <button
          data-training-phase="actual"
          aria-current={phase === "actual" ? "page" : undefined}
          onClick={() => setPhase("actual")}
        >
          Presenze effettive
        </button>
      </nav>
      {training ? (
        <section
          className="training-actual-entry"
          hidden={phase !== "actual" || !a.id}
        >
          <h3>{a.session_id ? "Presenze confermate" : "Presenze effettive"}</h3>
          <p>
            Gli attesi non sono ancora presenze registrate. Verifica chi ha
            partecipato e conferma il registro dopo l’allenamento.
          </p>
          <Feedback id="planningActualError" error={editor.error} />
          <Button
            id="planningAttendance"
            disabled={
              !operate ||
              editor.busy ||
              a.activity_date! > today() ||
              a.status === "Annullato"
            }
            onClick={() => void actual()}
          >
            {a.session_id ? "Correggi presenze" : "Conferma presenze"}
          </Button>
          {a.session_id ? (
            <>
              <div className="training-confirmed-summary">
                {["Presente", "Assente", "Infortunato"].map((status) => (
                  <section key={status}>
                    <h4>{status}</h4>
                    <p>
                      {runtime.state.attendance
                        .filter(
                          (r) =>
                            r.session_id === a.session_id &&
                            r.status === status,
                        )
                        .map((r) => {
                          const p = runtime.state.players.find(
                            (p) => p.id === r.player_id,
                          );
                          return p
                            ? `${p.surname} ${p.name}`
                            : "Giocatore archiviato";
                        })
                        .join(", ") || "Nessuno"}
                    </p>
                  </section>
                ))}
              </div>
              <CopyText
                id="copyActualAttendance"
                text={attendanceMessage(
                  a,
                  runtime.state.attendance.filter(
                    (r) => r.session_id === a.session_id,
                  ),
                  runtime.state.players,
                  fmt,
                )}
                label="Copia presenze"
              />
              <Button
                id="actualHistory"
                variant="secondary"
                onClick={() =>
                  ui.open("history", { kind: "session", id: a.session_id })
                }
              >
                Storico modifiche
              </Button>
            </>
          ) : null}
        </section>
      ) : null}
      <form
        id="planningForm"
        data-dirty={editor.dirty}
        aria-busy={editor.busy}
        hidden={phase === "actual" && training}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={editor.busy}>
          {training && a.id ? (
            <div className="training-replies sc-training-layout">
              <section>
                <div
                  className="sc-segmented"
                  role="group"
                  aria-label={
                    legacy ? "Filtra risposte storiche" : "Filtra giocatori"
                  }
                >
                  <button
                    type="button"
                    id="allReplyFilter"
                    aria-pressed={!pendingOnly}
                    onClick={() => setPendingOnly(false)}
                  >
                    Tutti
                  </button>
                  <button
                    type="button"
                    id="pendingReplyFilter"
                    aria-pressed={pendingOnly}
                    onClick={() => setPendingOnly(!pendingOnly)}
                  >
                    {legacy ? "Non risposto" : "Assenze comunicate"}{" "}
                    <span id="pendingReplyNumber">{pending.length}</span>
                  </button>
                </div>
                <p className="sc-helper">
                  {legacy
                    ? "Risposte del metodo precedente, conservate per consultazione."
                    : "Segna solo chi ha comunicato un’assenza. Gli altri sono attesi; le presenze effettive si confermano dopo l’allenamento."}
                </p>
                <div id="trainingReplies" className="sc-player-list">
                  {players
                    .filter(
                      (p) =>
                        (!pendingOnly ||
                          v.replies[p.id] ===
                            (legacy ? "In attesa" : "Indisponibile")) &&
                        `${p.surname} ${p.name} ${p.role}`
                          .toLocaleLowerCase("it")
                          .includes(search.toLocaleLowerCase("it")),
                    )
                    .map((p) => (
                      <article className="sc-reply-row" key={p.id}>
                        <span className="sc-person-avatar" aria-hidden="true">
                          {p.name[0]}
                          {p.surname[0]}
                        </span>
                        <span className="sc-person-copy">
                          <b>
                            {p.name} {p.surname}
                          </b>
                          <small>
                            {legacy
                              ? v.replies[p.id] === "Disponibile"
                                ? "Aveva risposto sì"
                                : v.replies[p.id] === "Indisponibile"
                                  ? "Aveva risposto no"
                                  : "Risposta non registrata"
                              : v.replies[p.id] === "Indisponibile"
                                ? "Assenza comunicata"
                                : "Atteso all’allenamento"}
                          </small>
                        </span>
                        <div
                          className="sc-reply-buttons"
                          role="group"
                          aria-label={`${legacy ? "Risposta storica" : "Previsione"} di ${p.name} ${p.surname}`}
                        >
                          {(legacy
                            ? ([
                                ["Disponibile", "Sì", Check, "yes"],
                                ["Indisponibile", "No", X, "no"],
                                ["In attesa", "Non risposto", Minus, "pending"],
                              ] as const)
                            : ([
                                ["Disponibile", "Atteso", Check, "expected"],
                                [
                                  "Indisponibile",
                                  "Assenza comunicata",
                                  X,
                                  "no",
                                ],
                              ] as const)
                          ).map(([value, label, Icon, tone]) => (
                            <button
                              key={value}
                              type="button"
                              disabled={!operate || !!a.session_id}
                              className={
                                v.replies[p.id] === value ? "sc-" + tone : ""
                              }
                              data-training-player={p.id}
                              data-training-reply={value}
                              aria-label={`${p.name} ${p.surname}: ${label}`}
                              aria-pressed={v.replies[p.id] === value}
                              onClick={() => {
                                editor.setValue({
                                  ...v,
                                  replies: { ...v.replies, [p.id]: value },
                                  notes: {
                                    ...v.notes,
                                    [p.id]:
                                      value === "Disponibile"
                                        ? ""
                                        : v.notes[p.id],
                                  },
                                });
                                editor.setError("");
                              }}
                            >
                              <Icon size={18} />
                            </button>
                          ))}
                        </div>
                        {!legacy && v.replies[p.id] === "Indisponibile" ? (
                          <Field
                            className="training-absence-note"
                            id={`absence-${p.id}`}
                            label="Motivo · Facoltativo"
                          >
                            <input
                              id={`absence-${p.id}`}
                              maxLength={10000}
                              disabled={!operate || !!a.session_id}
                              value={v.notes[p.id]}
                              onChange={(e) =>
                                editor.setValue({
                                  ...v,
                                  notes: { ...v.notes, [p.id]: e.target.value },
                                })
                              }
                              placeholder="Es. lavoro, visita medica…"
                            />
                          </Field>
                        ) : null}
                      </article>
                    ))}
                </div>
              </section>
              <aside className="sc-training-aside">
                <h3>
                  {legacy
                    ? "Risposte del vecchio sondaggio"
                    : "Prima dell’allenamento"}
                </h3>
                <div
                  id="planningReplySummary"
                  className={`sc-count-strip ${!legacy ? "training-absence-summary" : ""}`}
                  aria-live="polite"
                >
                  {(legacy
                    ? [
                        ["Disponibile", "Sì"],
                        ["Indisponibile", "No"],
                        ["In attesa", "In attesa"],
                      ]
                    : [
                        ["Disponibile", "Attesi"],
                        ["Indisponibile", "Assenze comunicate"],
                      ]
                  ).map(([value, label]) => (
                    <span key={value}>
                      <b>
                        {
                          players.filter((p) => v.replies[p.id] === value)
                            .length
                        }
                      </b>
                      {label}
                    </span>
                  ))}
                </div>
                <CopyText
                  className="sc-primary border-0"
                  id="copyTrainingReminder"
                  label={
                    legacy
                      ? "Copia riepilogo storico"
                      : "Copia assenze comunicate"
                  }
                  text={[
                    `ALLENAMENTO EBURUM · ${fmt(v.activity_date)}`,
                    editor.dirty || !a.id
                      ? "BOZZA · modifiche non ancora salvate"
                      : "Dati salvati",
                    `${legacy ? "Risposte non registrate" : "Assenze comunicate"} (${pending.length})`,
                    ...pending.map(
                      (p) =>
                        `• ${p.surname} ${p.name}${v.notes[p.id] ? " · " + v.notes[p.id] : ""}`,
                    ),
                    legacy
                      ? "Riepilogo del metodo precedente."
                      : "Gli altri giocatori sono attesi. Presenze da confermare dopo l’allenamento.",
                  ].join("\n")}
                >
                  {legacy
                    ? "Copia riepilogo storico"
                    : "Copia assenze comunicate"}
                  <ClipboardList size={18} />
                </CopyText>
                <p className="sc-helper">
                  {legacy
                    ? "Questi dati restano consultabili; non viene richiesto un nuovo sondaggio."
                    : "Una comunicazione di assenza è una previsione: il registro viene aggiornato soltanto alla conferma dello staff."}
                </p>
                <button
                  type="button"
                  id="openActualPhase"
                  className="sc-secondary"
                  onClick={() => setPhase("actual")}
                >
                  Presenze effettive
                  <ArrowUpRight size={18} />
                </button>
                <details className="field-space">
                  <summary>Cerca giocatore</summary>
                  <Field id="replySearch" label="Cerca giocatore">
                    <input
                      id="replySearch"
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </Field>
                </details>
              </aside>
            </div>
          ) : null}
          <details
            className="planning-details field-space"
            open={!a.id || !training}
          >
            <summary>
              Organizzazione{a.id ? ` · ${fmt(a.activity_date!)}` : ""}
            </summary>
            <fieldset disabled={!plan}>
              <div className="form-grid">
                {(
                  [
                    ["title", "Titolo", "text", "planningName"],
                    ["activity_date", "Data", "date", "planningDate"],
                    ["start_time", "Inizio", "time", "planningStart"],
                    ["end_time", "Fine", "time", "planningEnd"],
                    ["location", "Luogo", "text", "planningLocation"],
                  ] as const
                ).map(([key, label, type, id]) => (
                  <Field key={key} id={id} label={label}>
                    <input
                      id={id}
                      type={type}
                      required={key === "title" || key === "activity_date"}
                      maxLength={key === "location" ? 500 : 160}
                      value={v[key]}
                      onChange={(e) =>
                        editor.setValue({ ...v, [key]: e.target.value })
                      }
                    />
                  </Field>
                ))}
                <Field id="planningState" label="Stato">
                  <select
                    id="planningState"
                    value={v.status}
                    onChange={(e) =>
                      editor.setValue({ ...v, status: e.target.value })
                    }
                  >
                    {["Programmato", "Concluso", "Annullato"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <p id="planningTimeError" role="status" className="row-sub">
                {v.start_time && v.end_time && v.end_time <= v.start_time
                  ? "La fine deve essere successiva all’inizio"
                  : ""}
              </p>
              <Field
                id="planningNote"
                label={
                  training
                    ? "Indicazioni per l’allenamento"
                    : "Indicazioni per lo staff"
                }
              >
                <textarea
                  id="planningNote"
                  maxLength={10000}
                  value={v.organization_note}
                  onChange={(e) =>
                    editor.setValue({ ...v, organization_note: e.target.value })
                  }
                />
              </Field>
            </fieldset>
            {a.id ? (
              <Button
                variant="secondary"
                onClick={() =>
                  ui.open("history", { id: a.id, kind: "activity" })
                }
              >
                Storico modifiche e organizzazione
              </Button>
            ) : null}
          </details>
          <div className="modal-actions planning-save">
            <Button
              id="cancelPlanning"
              variant="secondary"
              hidden={inline}
              onClick={() => void ui.close(surface.id)}
            >
              Annulla
            </Button>
            <span
              id="planningChanges"
              className="badge tone-neutral planning-change-count"
              hidden={!count}
              role="status"
              aria-live="polite"
              aria-label={`${count} ${count === 1 ? "modifica" : "modifiche"} da salvare`}
            >
              {count}
            </span>
            <Button
              type="submit"
              id="savePlanning"
              disabled={!operate || editor.busy || (!!a.id && !editor.dirty)}
            >
              {a.id ? "Salva" : "Crea allenamento"}
            </Button>
            <Feedback id="planningFeedback" error={editor.error} />
          </div>
        </fieldset>
      </form>
    </div>
  );
  return inline ? (
    content
  ) : (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={
        a.id
          ? a.title || "Allenamento"
          : training
            ? "Nuovo allenamento"
            : "Nuova riunione"
      }
      closeLabel="Chiudi allenamento"
      className="training-planning"
      titleId="planningTitle"
      closeId="closePlanning"
    >
      {content}
    </EditorFrame>
  );
}
