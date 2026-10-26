import {
  CalendarDays,
  Clock3,
  MapPin,
  ArrowUpRight,
  ChevronRight,
  MessageSquare,
  ShieldCheck,
  Trophy,
  ClipboardCheck,
} from "lucide-react";
import { dayLabel, matchOutcome } from "../app-presentation.js";
import { today, fmt } from "../app-part1.js";
import {
  canOperateRole,
  canPlanRole,
  canViewExpiriesRole,
} from "../app-roles.js";
import { playerDismissals } from "../app-dismissals.js";
import { NavLink } from "react-router-dom";
import { ui } from "./ui-service";
import type { Runtime } from "./types";

export function Dashboard({ runtime }: { runtime: Runtime }) {
  const { state, actions } = runtime,
    role = state.team?.role || "",
    day = today(),
    operate = canOperateRole(role),
    plan = canPlanRole(role);
  const upcoming = state.activities
    .filter((a) => a.status === "Programmato" && a.activity_date >= day)
    .sort((a, b) =>
      (a.activity_date + (a.start_time || "")).localeCompare(
        b.activity_date + (b.start_time || ""),
      ),
    );
  const next = upcoming[0],
    latest = state.sessions
      .filter((s) => s.session_type === "Allenamento")
      .sort((a, b) => b.session_date.localeCompare(a.session_date))[0],
    attendance = state.attendance.filter((r) => r.session_id === latest?.id);
  const players = state.players.filter((p) => p.active),
    injured = new Set(
      attendance
        .filter((r) => r.status === "Infortunato")
        .map((r) => r.player_id),
    ),
    suspended = new Set(
      players
        .filter((p) => playerDismissals(p.id).some((d) => d.attention))
        .map((p) => p.id),
    );
  const clear = players.filter(
    (p) => !injured.has(p.id) && !suspended.has(p.id),
  ).length;
  const messages = actions.activeCommunications(),
    unread = messages.filter(
      (m) =>
        m.requires_ack &&
        !state.communication_receipts.some(
          (r) => r.communication_id === m.id && r.reader_id === state.user?.id,
        ),
    ).length;
  const pending = upcoming
    .filter((a) => a.activity_type === "Allenamento" && !a.session_id)
    .reduce(
      (n, a) =>
        n +
        actions.pollEntries(a).filter((x) => x.row.availability === "In attesa")
          .length,
      0,
    );
  const overdue = state.activities.filter(
    (a) =>
      a.activity_type === "Allenamento" &&
      a.status === "Programmato" &&
      !a.session_id &&
      a.activity_date <= day,
  );
  const missing = state.matches.filter(
    (m) =>
      m.match_date < day &&
      matchOutcome(m) === null &&
      !state.activities.some(
        (a) => a.match_id === m.id && a.status === "Annullato",
      ),
  );
  const docs = actions.documentSummary(),
    lastMatch = [...state.matches]
      .filter(
        (m) =>
          m.match_date <= day &&
          matchOutcome(m) !== null &&
          !state.activities.some(
            (a) => a.match_id === m.id && a.status === "Annullato",
          ),
      )
      .sort((a, b) => b.match_date.localeCompare(a.match_date))[0];
  const task = (
    Icon: typeof Trophy,
    label: string,
    detail: string,
    count: number,
    action: () => void,
  ) => (
    <button className="sc-list-row" onClick={action}>
      <span className="sc-row-icon tone-warning">
        <Icon size={20} />
      </span>
      <span className="sc-row-copy">
        <strong>{label}</strong>
        <small>{detail}</small>
        <span className="sc-small-count">{count} da verificare</span>
      </span>
      <ChevronRight size={18} />
    </button>
  );
  const stats = (values: [string | number, string, string][]) => (
    <dl className="home-stat-grid">
      {values.map(([value, label, tone]) => (
        <div key={label} data-tone={tone}>
          <dd data-home-count>{value}</dd>
          <dt>{label}</dt>
        </div>
      ))}
    </dl>
  );
  return (
    <div className="sc-surface club-office-home">
      <div className="office-heading">
        <h1>
          {state.team?.first_name
            ? `Bentornato, ${state.team.first_name}.`
            : "Bentornato"}
        </h1>
        <p>
          {new Intl.DateTimeFormat("it-IT", { dateStyle: "full" }).format(
            new Date(),
          )}
        </p>
      </div>
      <div className="sc-home-layout">
        <div className="sc-home-main">
          {next ? (
            <section className="sc-training-focus sc-home-hero">
              <div className="sc-focus-top">
                <span className="sc-light-tag">
                  <CalendarDays size={18} />
                  {next.activity_type === "Partita"
                    ? "Prossima partita"
                    : "Prossimo allenamento"}
                </span>
                <b>{dayLabel(next.activity_date, day)}</b>
              </div>
              <h2>
                {next.activity_type === "Partita"
                  ? `Eburum vs ${next.title}`
                  : next.title}
              </h2>
              <p>{fmt(next.activity_date)}</p>
              <div className="sc-focus-place">
                <Clock3 size={18} />
                {next.start_time?.slice(0, 5) || "Orario da definire"}
                <span>·</span>
                <MapPin size={18} />
                {next.location || "Campo da definire"}
              </div>
              <button
                className="sc-light-button"
                data-open-activity={next.id}
                onClick={() => void actions.openActivity(next.id)}
              >
                {next.activity_type === "Partita"
                  ? "Prepara la distinta"
                  : operate
                    ? "Gestisci presenze"
                    : "Consulta allenamento"}
                <ArrowUpRight size={18} />
              </button>
            </section>
          ) : (
            <section className="sc-empty-state sc-home-hero">
              <CalendarDays />
              <h3>Nessun impegno in programma</h3>
              <p>
                Il prossimo allenamento o la prossima partita compariranno qui.
              </p>
              {plan ? (
                <button className="primary" onClick={actions.newTraining}>
                  Programma allenamento
                </button>
              ) : null}
            </section>
          )}
          <section className="sc-home-tasks">
            <div className="sc-section-heading">
              <h2>
                {role === "president" ? "Situazione squadra" : "Da completare"}
              </h2>
            </div>
            <div className="sc-rows">
              {operate && missing.length
                ? task(
                    Trophy,
                    "Risultati da registrare",
                    `${fmt(missing[0].match_date)} · ${missing[0].opponent}`,
                    missing.length,
                    () => actions.openMatch(missing[0]),
                  )
                : null}
              {(operate || role === "president") && pending
                ? task(
                    MessageSquare,
                    "Risposte da registrare",
                    "Risposte WhatsApp ancora in attesa",
                    pending,
                    () => ui.open("priority", { kind: "poll" }),
                  )
                : null}
              {operate && overdue.length
                ? task(
                    ClipboardCheck,
                    "Presenze da confermare",
                    "Verifica gli allenamenti trascorsi",
                    overdue.length,
                    () => void actions.openActivity(overdue[0].id),
                  )
                : null}
              {unread
                ? task(
                    MessageSquare,
                    "Avvisi da confermare",
                    "Leggi e conferma gli avvisi importanti",
                    unread,
                    () => void runtime.navigate("communications"),
                  )
                : null}
              {canViewExpiriesRole(role) && docs.review
                ? task(
                    ShieldCheck,
                    "Documenti da verificare",
                    "Certificati e tesseramenti",
                    docs.review,
                    actions.expiries,
                  )
                : null}
              {!missing.length &&
              !pending &&
              !overdue.length &&
              !unread &&
              !docs.review ? (
                <div className="sc-empty-state">
                  <h3>Nessuna verifica in elenco</h3>
                  <p>Le attività controllate qui non richiedono interventi.</p>
                </div>
              ) : null}
            </div>
            {operate && state.trainingDraft ? (
              <button
                className="office-resume"
                data-resume-attendance
                onClick={actions.resumeAttendance}
              >
                Riprendi la bozza presenze
                <ChevronRight />
              </button>
            ) : null}
          </section>
          {latest ? (
            <section className="sc-last-training sc-home-last">
              <h2>Ultimo allenamento</h2>
              <p>
                {fmt(latest.session_date)} · {latest.session_type}
              </p>
              {stats([
                [
                  attendance.filter((r) => r.status === "Presente").length,
                  "Presenti",
                  "success",
                ],
                [
                  attendance.filter((r) => r.status === "Assente").length,
                  "Assenti",
                  "neutral",
                ],
                [
                  attendance.filter((r) => r.status === "Infortunato").length,
                  "Infortunati",
                  "danger",
                ],
              ])}
              <button
                className="ghost"
                onClick={() => {
                  state.registerDate = latest.session_date;
                  void runtime.navigate("register");
                }}
              >
                {operate ? "Dettagli" : "Consulta allenamento"}
                <ChevronRight size={18} />
              </button>
            </section>
          ) : null}
        </div>
        <div className="sc-home-secondary">
          <section className="office-comms">
            <span className="sr-only" data-communication-count>
              {messages.length}
            </span>
            <div className="sc-section-heading">
              <h2>Messaggi</h2>
              <button
                className="office-text-action"
                onClick={() => void runtime.navigate("communications")}
              >
                Tutte
                <ArrowUpRight size={16} />
              </button>
            </div>
            {messages.slice(0, 2).map((m) => (
              <button
                className="sc-communication-preview"
                key={m.id}
                onClick={() => void runtime.navigate("communications")}
              >
                <span className="sc-message-kind">
                  {actions.communicationAudience(m)}
                </span>
                <h3>{m.title}</h3>
                <p>{m.body.slice(0, 160)}</p>
                <small>{m.author_label || "Staff"}</small>
              </button>
            ))}
            {!messages.length ? (
              <div className="sc-communication-preview">
                <h3>Nessuna comunicazione attiva</h3>
                <p>Qui trovi gli aggiornamenti condivisi dallo staff.</p>
                <NavLink className="ghost" to="/communications?compose=1">
                  Scrivi un messaggio
                </NavLink>
              </div>
            ) : null}
          </section>
          {lastMatch ? (
            <section className="sc-home-result">
              <div className="sc-section-heading">
                <h2>Ultimo risultato</h2>
                <span>{fmt(lastMatch.match_date)}</span>
              </div>
              <button
                className="sc-fixture-preview"
                onClick={() => actions.openMatch(lastMatch)}
              >
                <span className="badge tone-neutral">{lastMatch.venue}</span>
                <div className="sc-fixture-score">
                  <span>Eburum</span>
                  <b>{lastMatch.goals_for}</b>
                </div>
                <div className="sc-fixture-score">
                  <span>{lastMatch.opponent}</span>
                  <b>{lastMatch.goals_against}</b>
                </div>
                <span className="sc-fixture-footer">
                  Risultato ed eventi
                  <ArrowUpRight size={18} />
                </span>
              </button>
            </section>
          ) : null}
          <section className="sc-home-availability">
            <h2>{operate ? "Segnalazioni rosa" : "Situazione squadra"}</h2>
            <p className="row-sub">
              {latest
                ? `Presenze rilevate il ${fmt(latest.session_date)}`
                : "Nessuna presenza confermata disponibile"}
              . Provvedimenti aperti della stagione.
            </p>
            {stats([
              [latest ? clear : "—", "Senza segnalazioni", "success"],
              [
                latest ? players.filter((p) => injured.has(p.id)).length : "—",
                "Infortunati all’ultimo allenamento",
                "danger",
              ],
              [suspended.size, "Squalifiche aperte", "warning"],
            ])}
            <button
              className="ghost wide"
              onClick={() => void runtime.navigate("players")}
            >
              Apri Rosa
              <ChevronRight size={18} />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
