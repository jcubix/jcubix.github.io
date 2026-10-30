import { useEffect, useState } from "react";
import { fmt, today } from "../../app-part1.js";
import { editAttendanceSession } from "../../app-part3.js";
import { canOperateRole } from "../../app-roles.ts";
import { Button } from "../components/ui/button";
import type { Runtime } from "../types";
import { ui } from "../ui-service";

export function Register({ runtime }: { runtime: Runtime }) {
  const { state } = runtime,
    trainings = state.activities.filter(
      (a) =>
        a.activity_type === "Allenamento" &&
        (a.activity_date <= today() ||
          a.status !== "Programmato" ||
          a.session_id),
    ),
    dates = [
      ...new Set([
        ...state.sessions.map((s) => s.session_date),
        ...trainings.map((a) => a.activity_date),
      ]),
    ]
      .sort()
      .reverse();
  const query = new URLSearchParams(location.hash.split("?")[1]);
  const initial =
      query.get("date") || state.registerDate || dates[0] || today(),
    [selected, setSelected] = useState(initial),
    [month, setMonth] = useState(
      query.get("month") || state.registerMonth || initial.slice(0, 7),
    );
  useEffect(() => {
    state.registerDate = selected;
    state.registerMonth = month;
  }, [selected, month, state]);
  const year = Number(month.slice(0, 4)),
    index = Number(month.slice(5, 7)) - 1,
    days = new Date(year, index + 1, 0).getDate(),
    blanks = (new Date(year, index, 1).getDay() + 6) % 7;
  const changeMonth = (delta: number) => {
    const d = new Date(year, index + delta, 15),
      next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonth(next);
    state.registerMonth = next;
  };
  const sessions = state.sessions.filter((s) => s.session_date === selected),
    activities = trainings.filter(
      (a) =>
        a.activity_date === selected ||
        sessions.some((s) => s.id === a.session_id),
    );
  return (
    <>
      <div className="section-title">
        <div>
          <h1>Registro</h1>
          <div className="muted">
            Presenze e schede degli allenamenti per data
          </div>
        </div>
        <span className="badge b-blue">{state.sessions.length} sessioni</span>
      </div>
      <div className="register-layout">
        <div className="card calendar-card">
          <div className="calendar-head">
            <Button
              id="calPrev"
              variant="secondary"
              aria-label="Mese precedente"
              onClick={() => changeMonth(-1)}
            >
              ‹
            </Button>
            <div>
              <h3 id="calTitle" className="row-title" aria-live="polite">
                {new Intl.DateTimeFormat("it-IT", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(year, index, 15))}
              </h3>
              <p className="row-sub">
                I giorni evidenziati contengono attività
              </p>
            </div>
            <Button
              id="calNext"
              variant="secondary"
              aria-label="Mese successivo"
              onClick={() => changeMonth(1)}
            >
              ›
            </Button>
          </div>
          <div className="calendar-week" aria-hidden="true">
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day, i) => (
              <span key={i}>{day}</span>
            ))}
          </div>
          <div id="calendarGrid" className="calendar-grid">
            {Array.from({ length: blanks }, (_, i) => (
              <span key={"blank" + i} className="calendar-day blank" />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = `${month}-${String(i + 1).padStart(2, "0")}`,
                active = dates.includes(day);
              return (
                <button
                  key={day}
                  data-date={day}
                  className={`calendar-day ${active ? "has-activity" : ""} ${selected === day ? "selected" : ""}`}
                  aria-pressed={selected === day}
                  aria-label={
                    new Intl.DateTimeFormat("it-IT", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(day + "T12:00:00")) +
                    (active ? " · attività registrata" : "")
                  }
                  onClick={() => {
                    setSelected(day);
                    state.registerDate = day;
                  }}
                >
                  <span>{i + 1}</span>
                  {active ? <i aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="legend-activity" /> Attività registrata
            </span>
            <span>
              <i className="legend-selected" /> Giorno selezionato
            </span>
          </div>
          <Button
            variant="secondary"
            id="calendarToday"
            onClick={() => {
              const day = today();
              setSelected(day);
              setMonth(day.slice(0, 7));
            }}
          >
            Oggi
          </Button>
        </div>
        <div id="registerDetail" data-selected={selected}>
          {sessions.map((session) => {
            const rows = state.attendance.filter(
              (r) => r.session_id === session.id,
            );
            return (
              <article className="card session-detail" key={session.id}>
                <div className="session-detail-head">
                  <div>
                    <div className="row-title" role="heading" aria-level={3}>
                      {session.session_type}
                    </div>
                    <div className="row-sub">
                      {fmt(session.session_date)}
                      {session.note ? ` · ${session.note}` : ""}
                    </div>
                  </div>
                  <div className="session-summary">
                    {["Presente", "Assente", "Infortunato"].map((status) => (
                      <span
                        className={`badge ${status === "Presente" ? "b-green" : status === "Assente" ? "b-red" : "b-blue"}`}
                        key={status}
                      >
                        {rows.filter((r) => r.status === status).length}{" "}
                        {status[0]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="register-groups">
                  {["Presente", "Assente", "Infortunato"].map((status) => (
                    <section className="register-group" key={status}>
                      <div className="register-group-head">
                        <span>
                          {status === "Presente"
                            ? "Presenti"
                            : status === "Assente"
                              ? "Assenti"
                              : "Infortunati"}
                        </span>
                        <span
                          className={`badge ${status === "Presente" ? "b-green" : status === "Assente" ? "b-red" : "b-blue"}`}
                        >
                          {rows.filter((r) => r.status === status).length}
                        </span>
                      </div>
                      {rows.some((r) => r.status === status) ? (
                        <div className="register-people">
                          {rows
                            .filter((r) => r.status === status)
                            .map((row) => (
                              <div className="person-chip" key={row.player_id}>
                                <b>
                                  {state.players.find(
                                    (p) => p.id === row.player_id,
                                  )?.surname || "Giocatore storico"}{" "}
                                  {
                                    state.players.find(
                                      (p) => p.id === row.player_id,
                                    )?.name
                                  }
                                </b>
                                {row.note ? <small>{row.note}</small> : null}
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="row-sub">Nessuno</div>
                      )}
                    </section>
                  ))}
                </div>
                <div className="session-tools">
                  {canOperateRole(state.team?.role || "") ? (
                    <Button
                      data-edit-session={session.id}
                      onClick={() => void editAttendanceSession(session.id)}
                    >
                      Correggi presenze
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    data-session-history={session.id}
                    onClick={() =>
                      ui.open("history", { id: session.id, kind: "session" })
                    }
                  >
                    Storico modifiche
                  </Button>
                </div>
                <div className="row-sub session-updated">
                  {session.updated_at
                    ? "Ultimo salvataggio: " +
                      new Intl.DateTimeFormat("it-IT", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(session.updated_at))
                    : "Storico importato · nessuna modifica tracciata"}
                </div>
              </article>
            );
          })}
          {activities.map((a) => (
            <article className="card register-training-card" key={a.id}>
              <div className="session-detail-head">
                <div>
                  <h3>{a.title}</h3>
                  <p className="row-sub">
                    {fmt(a.activity_date)} · {a.start_time?.slice(0, 5)}
                    {a.location ? ` · ${a.location}` : ""}
                  </p>
                </div>
                <span className="office-status sc-status">{a.status}</span>
              </div>
              {a.organization_note ? (
                <p className="register-training-note">{a.organization_note}</p>
              ) : null}
              <p className="row-sub">
                {a.status === "Annullato"
                  ? "Allenamento annullato: nessuna presenza da confermare."
                  : a.session_id
                    ? "Presenze confermate."
                    : "Presenze non ancora confermate."}
              </p>
              <Button
                variant="secondary"
                data-register-training={a.id}
                onClick={() => void runtime.actions.openActivity(a.id)}
              >
                Apri scheda allenamento
              </Button>
            </article>
          ))}
          {!sessions.length && !activities.length ? (
            <div className="card sc-empty-state">
              <h3>Nessuna attività registrata il {fmt(selected)}.</h3>
              <p>Scegli un altro giorno evidenziato nel calendario.</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
