import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { communicationExpiry } from "../app-communications.js";
import { playerDismissals } from "../app-dismissals.js";
import { isAwayMatch } from "../app-match-display.js";
import { fmt, today } from "../app-part1.js";
import { dayLabel, matchOutcome } from "../app-presentation.js";
import {
  canOperateRole,
  canPlanRole,
  canViewExpiriesRole,
} from "../app-roles.ts";
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
    nextMatch = state.matches.find((m) => m.id === next?.match_id),
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
      <header className="sc-page-heading office-heading">
        <div>
          <h1>
            {state.team?.first_name
              ? `Bentornato, ${state.team.first_name}.`
              : "Bentornato"}
          </h1>
          <p className="sc-date-line">
            {new Intl.DateTimeFormat("it-IT", { dateStyle: "full" })
              .format(new Date())
              .replace(/^./, (letter) => letter.toLocaleUpperCase("it"))}
          </p>
        </div>
      </header>
      <div className="sc-home-layout">
        <div className="sc-home-main">
          {next ? (
            <section className="sc-training-focus sc-home-hero">
              <div className="sc-focus-top">
                <span className="sc-light-tag">
                  {next.activity_type === "Partita" ? (
                    <Trophy size={16} />
                  ) : (
                    <CalendarDays size={16} />
                  )}
                  {next.activity_type === "Partita"
                    ? "Prossima partita"
                    : "Prossimo allenamento"}
                </span>
                <span>{dayLabel(next.activity_date, day)}</span>
              </div>
              <h3>
                {next.activity_type === "Partita"
                  ? `Eburum vs ${next.title}`
                  : next.title}
              </h3>
              <p>{fmt(next.activity_date)}</p>
              <div className="sc-focus-place">
                <Clock3 size={18} />
                {next.start_time?.slice(0, 5) || "Orario da definire"}
                <span>·</span>
                <MapPin size={18} />
                {next.location || "Campo da definire"}
              </div>
              {next.activity_type === "Partita" && nextMatch ? (
                <span
                  className={`badge ${isAwayMatch(nextMatch) ? "venue-away" : "venue-home"}`}
                >
                  {nextMatch.venue}
                </span>
              ) : null}
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
              {!missing.length && !overdue.length && !unread && !docs.review ? (
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
            {messages.slice(0, 3).map((m) => (
              <button
                className="sc-communication-preview"
                key={m.id}
                onClick={() => void runtime.navigate("communications")}
              >
                <div>
                  <span className="sc-category">
                    {actions.communicationAudience(m)}
                  </span>
                  <span className="sc-expiry">
                    {communicationExpiry(m.expires_at)}
                  </span>
                </div>
                <h3>{m.title}</h3>
                <p className="sc-message-body">{m.body}</p>
                <footer>
                  <span className="sc-mini-avatar">
                    {(m.author_label || "Staff")
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  {m.author_label || "Staff"}
                  <ChevronRight size={18} />
                </footer>
              </button>
            ))}
            {!messages.length ? (
              <div className="sc-communication-preview">
                <h3>Nessuna comunicazione attiva</h3>
                <p>Qui trovi gli aggiornamenti condivisi dallo staff.</p>
                <NavLink
                  className="sc-secondary"
                  to="/communications?compose=1"
                >
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
                className="sc-match-preview"
                onClick={() => actions.openMatch(lastMatch)}
              >
                <div className="sc-match-meta">
                  <span
                    className={`match-outcome outcome-${matchOutcome(lastMatch)}`}
                  >
                    {matchOutcome(lastMatch)}
                  </span>
                  <span
                    className={`badge ${isAwayMatch(lastMatch) ? "venue-away" : "venue-home"}`}
                  >
                    {lastMatch.venue}
                  </span>
                </div>
                <div className="match-scoreboard">
                  <span
                    className={`match-team ${isAwayMatch(lastMatch) ? "" : "is-own"}`}
                  >
                    {isAwayMatch(lastMatch) ? lastMatch.opponent : "Eburum"}
                  </span>
                  <strong className="match-goals">
                    {isAwayMatch(lastMatch)
                      ? lastMatch.goals_against
                      : lastMatch.goals_for}
                  </strong>
                  <span
                    className={`match-team ${isAwayMatch(lastMatch) ? "is-own" : ""}`}
                  >
                    {isAwayMatch(lastMatch) ? "Eburum" : lastMatch.opponent}
                  </span>
                  <strong className="match-goals">
                    {isAwayMatch(lastMatch)
                      ? lastMatch.goals_for
                      : lastMatch.goals_against}
                  </strong>
                </div>
                <footer>
                  Risultato ed eventi
                  <ArrowUpRight size={20} />
                </footer>
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
