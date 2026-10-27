import { useEffect, useRef, useState } from "react";
import {
  Check,
  X,
  Minus,
  ArrowUpRight,
  Plus,
  ClipboardList,
  CalendarDays,
  Presentation,
  ChevronRight,
} from "lucide-react";
import { Button } from "./components/ui/button";
import {
  Field,
  Feedback,
  EditorFrame,
  CopyText,
  useEditor,
} from "./operational-ui";
import { NavLink, useNavigate } from "react-router-dom";
import { ui, type Surface } from "./ui-service";
import type {
  Runtime,
  Activity,
  RosterRow,
  TrainingDraft,
  Attendance,
} from "./types";
import { sortPlayers, fmt, today } from "../app-part1.js";
import { canOperateRole, canPlanRole, canTechnicalRole } from "../app-roles.js";
import { startActualAttendance } from "../app-workflows.js";
import {
  attendanceCounts,
  draftChanged,
  draftRows,
  getTrainingDraft,
} from "../app-part3.js";
import { attendanceMessage } from "../app-workflow-tools.js";
import { confirmDialog } from "../app-confirm.js";

type PlanValues = {
  title: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  location: string;
  status: string;
  organization_note: string;
  replies: Record<string, string>;
};
export function TrainingScreen({ runtime }: { runtime: Runtime }) {
  const activities = [...runtime.state.activities]
    .filter((a) => a.activity_type === "Allenamento")
    .sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  const [scope, setScope] = useState(
      () =>
        new URLSearchParams(location.hash.split("?")[1]).get("scope") ||
        (activities.some(
          (a) =>
            a.status === "Programmato" &&
            !a.session_id &&
            a.activity_date >= today(),
        )
          ? "upcoming"
          : "actual"),
    ),
    [selected, setSelected] = useState(
      () =>
        new URLSearchParams(location.hash.split("?")[1]).get("activity") || "",
    );
  const filtered = activities.filter(
    (a) =>
      a.status === "Programmato" &&
      !a.session_id &&
      (scope === "actual"
        ? a.activity_date <= today()
        : a.activity_date >= today()),
  );
  const current = filtered.find((a) => a.id === selected) || filtered[0];
  const change = async (value: string, id?: string) => {
    if (!(await runtime.canLeaveInline())) return;
    setScope(value);
    if (id) setSelected(id);
  };
  if (runtime.state.trainingMode === "actual")
    return <AttendanceEditor runtime={runtime} />;
  return (
    <div className="sc-surface">
      <div className="sc-page-heading page-heading">
        <div>
          <h1>Allenamenti</h1>
          <p>Programma, presenze e storico</p>
        </div>
        {canPlanRole(runtime.state.team?.role || "") ? (
          <Button
            className="sc-add"
            aria-label="Nuovo allenamento"
            onClick={runtime.actions.newTraining}
          >
            <Plus />
            <span className="sr-only">Allenamento</span>
          </Button>
        ) : null}
      </div>
      <div
        className="training-scope segmented"
        role="group"
        aria-label="Allenamenti"
      >
        <button
          aria-pressed={scope === "upcoming"}
          onClick={() => void change("upcoming")}
        >
          Prossimi
        </button>
        <button
          aria-pressed={scope === "actual"}
          onClick={() => void change("actual")}
        >
          Da confermare
          <span className="filter-count">
            {
              activities.filter(
                (a) =>
                  a.status === "Programmato" &&
                  !a.session_id &&
                  a.activity_date <= today(),
              ).length
            }
          </span>
        </button>
      </div>
      {filtered.length > 1 ? (
        <Field id="trainingActivity" label="Allenamento">
          <select
            id="trainingActivity"
            value={current?.id || ""}
            onChange={(e) => void change(scope, e.target.value)}
          >
            {filtered.map((a) => (
              <option key={a.id} value={a.id}>
                {fmt(a.activity_date)} · {a.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {current ? (
        <>
          <div className="sc-activity-line">
            <div className="sc-date-tile">
              <b>{Number(current.activity_date.slice(8))}</b>
              <small>
                {new Intl.DateTimeFormat("it-IT", { month: "short" })
                  .format(new Date(current.activity_date + "T12:00:00"))
                  .toLocaleUpperCase("it")}
              </small>
            </div>
            <div>
              <h2>{current.title}</h2>
              <p>
                {current.start_time?.slice(0, 5)}
                {current.location ? ` · ${current.location}` : ""}
              </p>
              <div
                className="training-reply-bars"
                aria-label="Risposte WhatsApp"
              >
                {[
                  ["Disponibile", "Sì", "text-success"],
                  ["Indisponibile", "No", "text-destructive"],
                  ["In attesa", "In attesa", ""],
                ].map(([value, label, tone]) => (
                  <span key={value} className={tone}>
                    {label}{" "}
                    {
                      runtime.actions
                        .pollEntries(current)
                        .filter((r) => r.row.availability === value).length
                    }
                  </span>
                ))}
              </div>
            </div>
            <span className="office-status sc-status">{current.status}</span>
          </div>
          {canTechnicalRole(runtime.state.team?.role || "") ? (
            <NavLink
              className="utility-link training-whiteboard-link"
              to={`/whiteboard?activity=${encodeURIComponent(current.id)}`}
            >
              <Presentation size={18} />
              Crea lavagna per l’allenamento
            </NavLink>
          ) : null}
          <section
            className="sc-inline-training"
            aria-label="Gestione allenamento"
          >
            <PlanningEditor
              key={current.id}
              runtime={runtime}
              surface={{
                id: -1,
                kind: "planning",
                data: {
                  activity: current,
                  rows: runtime.state.roster.filter(
                    (r) => r.activity_id === current.id,
                  ),
                },
              }}
              inline
            />
          </section>
        </>
      ) : (
        <div className="sc-empty-state">
          <h3>Nessun allenamento in questo elenco</h3>
          <p>Consulta il Registro per gli allenamenti precedenti.</p>
          <Button
            variant="secondary"
            onClick={() => void runtime.navigate("register")}
          >
            Apri Registro
          </Button>
        </div>
      )}
      <NavLink className="utility-link training-register-link" to="/register">
        <CalendarDays size={20} />
        <span className="utility-copy">
          <b>Registro degli allenamenti</b>
          <small>
            Presenze, note e schede degli allenamenti passati o annullati
          </small>
        </span>
        <ChevronRight size={18} />
      </NavLink>
    </div>
  );
}
export function PlanningEditor({
  runtime,
  surface,
  inline = false,
}: {
  runtime: Runtime;
  surface: Surface;
  inline?: boolean;
}) {
  const data = surface.data as {
      activity: Partial<Activity>;
      rows?: RosterRow[];
    },
    a = useRef(data.activity).current,
    rows = data.rows || [];
  const ids = new Set(rows.map((r) => r.player_id)),
    players = sortPlayers(
      runtime.state.players.filter((p) => p.active || ids.has(p.id)),
    ),
    revision = useRef(a.revision ?? null),
    request = useRef(a.request_id || crypto.randomUUID());
  const initial: PlanValues = {
    title: a.title || "Allenamento",
    activity_date: a.activity_date || today(),
    start_time: a.start_time?.slice(0, 5) || "",
    end_time: a.end_time?.slice(0, 5) || "",
    location: a.location || "",
    status: a.status || "Programmato",
    organization_note: a.organization_note || "",
    replies: Object.fromEntries(
      players.map((p) => [
        p.id,
        rows.find((r) => r.player_id === p.id)?.availability || "In attesa",
      ]),
    ),
  };
  const editor = useEditor(runtime, surface, initial),
    baselineReplies = useRef(initial.replies),
    [phase, setPhase] = useState(a.session_id ? "actual" : "poll"),
    [search, setSearch] = useState(""),
    [pendingOnly, setPendingOnly] = useState(false);
  const operate = canOperateRole(runtime.state.team?.role || ""),
    plan = canPlanRole(runtime.state.team?.role || ""),
    training = a.activity_type !== "Riunione";
  useEffect(() => {
    if (!inline) return;
    runtime.setNavigationGuard(editor.canLeave);
    return () => runtime.setNavigationGuard(null);
  }, [runtime, inline]);
  const v = editor.value,
    pending = players.filter((p) => v.replies[p.id] === "In attesa"),
    count = Object.keys(v.replies).filter(
      (id) => v.replies[id] !== baselineReplies.current[id],
    ).length;
  const save = () =>
    editor.run(async () => {
      if (!operate) throw Error("Modifica riservata allo staff autorizzato");
      if (!v.title.trim() || !v.activity_date)
        throw Error("Inserisci titolo e data");
      if (v.start_time && v.end_time && v.end_time <= v.start_time)
        throw Error("La fine deve essere successiva all’inizio");
      const { replies, ...fields } = v;
      const { data: saved, error } = await runtime.db.rpc(
        "save_team_activity",
        {
          p_activity: {
            ...fields,
            title: fields.title.trim(),
            activity_type: training ? "Allenamento" : "Riunione",
            start_time: v.start_time || null,
            end_time: v.end_time || null,
            location: v.location.trim() || null,
            organization_note: v.organization_note.trim() || null,
            meeting_time: a.meeting_time || null,
            meeting_place: a.meeting_place || null,
            request_id: request.current,
          },
          p_roster: (training
            ? players.map((p) => ({
                player_id: p.id,
                availability: replies[p.id],
                response_note:
                  rows.find((r) => r.player_id === p.id)?.response_note || null,
              }))
            : rows
          ).map((r) => ({
            ...r,
            called: false,
            lineup: "Non impiegato",
            position: null,
            minutes_played: 0,
          })),
          p_id: a.id || null,
          p_revision: revision.current,
          p_technical: null,
        },
      );
      if (error) throw error;
      if (!saved?.id) throw Error("Risposta del salvataggio non valida");
      if (!editor.current()) return;
      revision.current = saved.revision;
      baselineReplies.current = { ...replies };
      editor.reset({ ...v });
      if (!inline) await editor.close();
      await runtime.actions.reload();
      if (!inline && !a.id && training)
        await runtime.actions.openActivity(saved.id);
      ui.notify(
        training
          ? a.id
            ? "Allenamento e risposte salvati"
            : "Allenamento creato"
          : "Riunione salvata",
      );
    });
  const actual = async () => {
    if (editor.busy || !operate) return;
    if (editor.dirty)
      return editor.setError(
        "Salva le modifiche e le risposte prima di aprire le presenze",
      );
    if (!a.id) return editor.setError("Salva prima l’allenamento");
    const opened = await startActualAttendance(
      runtime.state.activities.find((row) => row.id === a.id) || a,
    );
    if (opened && !inline) await editor.close();
  };
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
          Risposte WhatsApp
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
            Le risposte WhatsApp restano separate dal registro: conferma le
            presenze solo dopo aver verificato chi ha partecipato.
          </p>
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
                  aria-label="Filtra risposte"
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
                    Non risposto{" "}
                    <span id="pendingReplyNumber">{pending.length}</span>
                  </button>
                </div>
                <p className="sc-helper">
                  Trascrivi il sondaggio WhatsApp. Queste sono risposte
                  previste, non presenze effettive.
                </p>
                <div id="trainingReplies" className="sc-player-list">
                  {players
                    .filter(
                      (p) =>
                        (!pendingOnly || v.replies[p.id] === "In attesa") &&
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
                            {v.replies[p.id] === "Disponibile"
                              ? "Ha risposto sì"
                              : v.replies[p.id] === "Indisponibile"
                                ? "Ha risposto no"
                                : "Non ha risposto"}
                          </small>
                        </span>
                        <div
                          className="sc-reply-buttons"
                          role="group"
                          aria-label={`Risposta di ${p.name} ${p.surname}`}
                        >
                          {(
                            [
                              ["Disponibile", "Sì", Check, "yes"],
                              ["Indisponibile", "No", X, "no"],
                              ["In attesa", "Non risposto", Minus, "pending"],
                            ] as const
                          ).map(([value, label, Icon, tone]) => (
                            <button
                              key={value}
                              type="button"
                              disabled={!operate}
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
                                });
                                editor.setError("");
                              }}
                            >
                              <Icon size={18} />
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                </div>
              </section>
              <aside className="sc-training-aside">
                <h3>Il punto sulle risposte</h3>
                <div
                  id="planningReplySummary"
                  className="sc-count-strip"
                  aria-live="polite"
                >
                  {[
                    ["Disponibile", "Sì"],
                    ["Indisponibile", "No"],
                    ["In attesa", "In attesa"],
                  ].map(([value, label]) => (
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
                  label="Copia nomi da sollecitare"
                  text={[
                    `ALLENAMENTO EBURUM · ${fmt(v.activity_date)}`,
                    editor.dirty || !a.id
                      ? "BOZZA · risposte non ancora salvate"
                      : "Risposte salvate",
                    `Non hanno risposto (${pending.length})`,
                    ...pending.map((p) => `• ${p.surname} ${p.name}`),
                    pending.length
                      ? "Da sollecitare a votare al sondaggio WhatsApp."
                      : "Tutti hanno risposto.",
                  ].join("\n")}
                >
                  Copia nomi da sollecitare
                  <ClipboardList size={18} />
                </CopyText>
                <p className="sc-helper">
                  Il sondaggio resta su WhatsApp. La dashboard aiuta lo staff a
                  registrarlo.
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
                Storico risposte e organizzazione
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
              aria-label={`${count} ${count === 1 ? "risposta" : "risposte"} da salvare`}
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
        "Le presenze effettive non possono essere registrate per una data futura. Usa il sondaggio.",
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
                Risposte WhatsApp
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
                        WhatsApp:{" "}
                        {d.planned.get(p.id) === "Disponibile"
                          ? "Sì"
                          : d.planned.get(p.id) === "Indisponibile"
                            ? "No"
                            : "Non risposto"}
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
export function AttendanceNote({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { draft, playerId, onSaved } = surface.data as {
      draft: TrainingDraft;
      playerId: string;
      onSaved: () => void;
    },
    p = draft.players.find((p) => p.id === playerId)!,
    a = draft.entries.get(playerId)!;
  const editor = useEditor(runtime, surface, { ...a });
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={`${p.surname} ${p.name}`}
      closeLabel="Chiudi presenza"
    >
      <div className="status-grid">
        {["Presente", "Assente", "Infortunato"].map((status) => (
          <button
            key={status}
            data-status={status}
            aria-pressed={editor.value.status === status}
            onClick={() => editor.setValue({ ...editor.value, status })}
          >
            {status}
          </button>
        ))}
      </div>
      <p>La risposta WhatsApp si modifica nella scheda dell’allenamento.</p>
      <Field id="note" label="Nota">
        <textarea
          id="note"
          maxLength={10000}
          value={editor.value.note || ""}
          onChange={(e) =>
            editor.setValue({ ...editor.value, note: e.target.value || null })
          }
        />
      </Field>
      <Button
        id="ok"
        onClick={() => {
          if (
            !["Presente", "Assente", "Infortunato"].includes(
              editor.value.status,
            )
          )
            return editor.setError("Scegli Presente, Assente o Infortunato");
          draft.entries.set(playerId, editor.value);
          void editor.close();
          onSaved();
        }}
      >
        Conferma presenza
      </Button>
      <Feedback id="attendanceError" error={editor.error} />
    </EditorFrame>
  );
}
export function AttendanceReview({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { draft: d } = surface.data as { draft: TrainingDraft },
    editor = useEditor(runtime, surface, {}),
    [conflict, setConflict] = useState(false),
    rows = draftRows(d) as Attendance[],
    counts = attendanceCounts(rows),
    before = JSON.parse(d.baseline) as { rows: Attendance[] },
    changed = rows.filter(
      (row) =>
        JSON.stringify(row) !==
        JSON.stringify(before.rows.find((r) => r.player_id === row.player_id)),
    ),
    shown = d.id
      ? changed
      : rows.filter((r) => r.status !== "Presente" || r.note);
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      titleId="reviewTitle"
      title={d.id ? "Riepilogo correzioni" : "Riepilogo sessione"}
      className="attendance-review"
      closeLabel="Torna alla bozza"
    >
      <p>
        <b>{d.session.session_type}</b> · {fmt(d.session.session_date)}
      </p>
      <div className="attendance-counts">
        {[
          [counts.present, "Presenti"],
          [counts.absent, "Assenti"],
          [counts.injured, "Infortunati"],
        ].map(([n, label]) => (
          <span className="attendance-count" key={label}>
            <b>{n}</b>
            {label}
          </span>
        ))}
      </div>
      <p className="notice">
        Confermi le presenze effettive di tutta la sessione. Risposte al
        sondaggio: {rows.filter((r) => r.notified === true).length} risposto ·{" "}
        {rows.filter((r) => r.notified === false).length} non risposto ·{" "}
        {rows.filter((r) => r.notified === null).length} da verificare.
      </p>
      {shown.map((row) => (
        <article className="review-person" key={row.player_id}>
          <b>
            {d.players.find((p) => p.id === row.player_id)?.surname}{" "}
            {d.players.find((p) => p.id === row.player_id)?.name}
          </b>
          <span>{row.status}</span>
          <p>{row.note}</p>
        </article>
      ))}
      <p className="row-sub">
        Verranno salvate le presenze di tutti i {d.players.length} giocatori,
        anche quelli nascosti dalla ricerca.
      </p>
      <div className="modal-actions">
        <Button
          id="backToDraft"
          variant="secondary"
          disabled={editor.busy}
          onClick={() => void ui.close(surface.id)}
        >
          Torna alla bozza
        </Button>
        <Button
          id="confirmTraining"
          disabled={editor.busy}
          onClick={() =>
            void (async () => {
              if (conflict) {
                await editor.close();
                runtime.state.registerDate = d.session.session_date;
                runtime.state.trainingMode = "hub";
                await runtime.navigate("register");
                ui.notify(
                  "Riapri la sessione aggiornata; la tua bozza resta disponibile",
                );
                return;
              }
              await editor.run(async () => {
                if (!canOperateRole(runtime.state.team?.role || ""))
                  throw Error("Operazione non consentita");
                if (
                  !d.session.session_date ||
                  d.session.session_date > today() ||
                  !d.players.length ||
                  counts.pending
                )
                  throw Error("Controlla la data e conferma tutte le presenze");
                const activity = runtime.state.activities.find(
                  (a) => a.id === d.activityId,
                );
                if (activity?.status === "Annullato")
                  throw Error("L’allenamento è annullato");
                d.saving = true;
                runtime.render();
                try {
                  const payload = {
                    p_session: { ...d.session },
                    p_attendance: rows,
                    p_session_id: d.id,
                    p_expected_revision: d.id ? d.revision : null,
                    p_request_id: d.id ? null : d.requestId,
                  };
                  const linked =
                    d.activityId &&
                    activity?.activity_date === d.session.session_date;
                  const { data, error } = await runtime.db.rpc(
                    linked
                      ? "save_training_attendance"
                      : "save_attendance_session",
                    linked
                      ? {
                          ...payload,
                          p_activity_id: d.activityId,
                          p_activity_revision: d.activityRevision,
                        }
                      : payload,
                  );
                  if (error) {
                    if (["40001", "PT409"].includes(error.code))
                      setConflict(true);
                    if (error.code === "23505")
                      throw Error(
                        "Esiste già una sessione con questa data e tipo. Correggila dal Registro.",
                      );
                    throw error;
                  }
                  if (!data?.session?.id)
                    throw Error("Risposta del salvataggio non valida");
                  if (!editor.current()) return;
                  runtime.state.trainingDraft = null;
                  runtime.state.registerDate = data.session.session_date;
                  runtime.state.trainingMode = "hub";
                  await editor.close();
                  await runtime.navigate("register");
                  const loaded = await runtime.actions.reload();
                  ui.notify(
                    loaded
                      ? d.id
                        ? "Correzioni salvate"
                        : "Sessione salvata"
                      : "Salvataggio riuscito. Riprova il caricamento della squadra.",
                  );
                } finally {
                  d.saving = false;
                  runtime.render();
                }
              });
            })()
          }
        >
          {conflict ? "Riapri dal Registro" : "Conferma e salva"}
        </Button>
      </div>
      <Feedback id="reviewStatus" error={editor.error} />
    </EditorFrame>
  );
}
