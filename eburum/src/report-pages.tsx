import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  CircleDot,
  RectangleVertical,
  ArrowLeftRight,
  MessageSquare,
} from "lucide-react";
import { Button } from "./components/ui/button";
import {
  EditorFrame,
  Field,
  Feedback,
  CopyText,
  useEditor,
} from "./operational-ui";
import { ui, type Surface } from "./ui-service";
import type {
  Runtime,
  Match,
  Activity,
  Session,
  Attendance,
  RosterRow,
  MatchEvent,
} from "./types";
import { fmt, today, teamOwner, sortPlayers } from "../app-part1.js";
import { loadSportPeriod } from "../app-data.js";
import { reportData } from "../app-part5.js";
import {
  playerReportModel,
  playerReportFilename,
  createPlayerReportPdf,
} from "../app-report-export.js";
import { matchReportModel, createMatchReportPdf } from "../app-match-report.js";
import { ensureJsPdf } from "../app-pdf-loader.js";
import { eventTone } from "../app-part4.js";
import { canOperateRole } from "../app-roles.js";
import { editAttendanceSession } from "../app-part3.js";
import { newestFirst } from "../app-presentation.js";
import { recentFrom } from "../app-workflows.js";

export function MatchReport({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const editor = useEditor(runtime, surface, {}),
    model = matchReportModel(
      surface.data as Parameters<typeof matchReportModel>[0],
    ),
    [fallback, setFallback] = useState(false),
    area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (fallback) {
      area.current?.focus();
      area.current?.select();
    }
  }, [fallback]);
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title="Tabellino gara"
      titleId="matchReportTitle"
      description="Dati salvati della partita. Copia il testo per condividerlo oppure scarica il PDF."
      className="match-report-modal"
      closeLabel="Chiudi tabellino"
    >
      <div id="matchReportPreview" className="match-report-document">
        <header className="match-report-score">
          <p>
            {model.date}
            {model.cancelled ? " · Partita annullata" : ""}
          </p>
          <div>
            {model.teams.map((team: string, i: number) => (
              <span key={i}>
                {team}
                <b>{model.scores ? model.scores[i] : "—"}</b>
              </span>
            ))}
          </div>
          <p>{model.result}</p>
        </header>
        <div className="match-report-columns">
          <section>
            <h3>Formazione titolare</h3>
            {model.starters.length ? (
              <ul className="match-report-lineup">
                {model.starters.map((name: string, i: number) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="row-sub">Formazione non registrata.</p>
            )}
          </section>
          <section>
            <h3>Eventi della gara</h3>
            <div className="match-timeline">
              {model.eventEntries.map(
                (
                  event: {
                    minute: number | null;
                    type: string;
                    opponent: boolean;
                    action: string;
                  },
                  i: number,
                ) => {
                  const Icon =
                    event.type === "Gol"
                      ? CircleDot
                      : event.type === "Sostituzione"
                        ? ArrowLeftRight
                        : event.type === "Nota"
                          ? MessageSquare
                          : RectangleVertical;
                  return (
                    <article
                      className={
                        "event-item" + (event.opponent ? " opponent-goal" : "")
                      }
                      key={i}
                    >
                      <div
                        className="event-minute"
                        aria-label={
                          event.minute == null
                            ? "Minuto non indicato"
                            : undefined
                        }
                      >
                        {event.minute == null ? "—" : `${event.minute}′`}
                      </div>
                      <div
                        className="event-content"
                        data-event-type={event.type}
                      >
                        <span
                          className={`badge ${eventTone({ event_type: event.type, player_id: event.opponent ? null : "own" })}`}
                        >
                          <Icon size={16} />
                          {event.opponent ? "Gol avversario" : event.type}
                        </span>
                        <p>{event.action}</p>
                      </div>
                    </article>
                  );
                },
              )}
              {!model.eventEntries.length ? (
                <p className="row-sub">Nessun evento registrato.</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      <label htmlFor="matchReportText" hidden={!fallback}>
        Testo del tabellino da copiare
      </label>
      <textarea
        id="matchReportText"
        className="match-report-preview"
        readOnly
        hidden={!fallback}
        ref={area}
        value={model.text}
      />
      <div className="modal-actions">
        <Button
          id="copyMatchReport"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(model.text);
              editor.setError(
                "Tabellino copiato. Puoi incollarlo su WhatsApp.",
              );
            } catch {
              setFallback(true);
              editor.setError("Copia manualmente il testo selezionato.");
            }
          }}
        >
          Copia testo
        </Button>
        <Button
          id="downloadMatchReport"
          disabled={editor.busy}
          onClick={() =>
            void editor.run(async () => {
              await ensureJsPdf();
              if (editor.current()) {
                createMatchReportPdf(model).save(model.filename + ".pdf");
                editor.setError(
                  "PDF creato. Controlla i download del dispositivo.",
                );
              }
            })
          }
        >
          Scarica PDF
        </Button>
      </div>
      <Feedback id="matchReportStatus" error={editor.error} />
    </EditorFrame>
  );
}
interface ReportItem {
  name: string;
  detail: string;
  match?: Match;
}
interface ReportDetail {
  title: string;
  items: ReportItem[];
  from: string;
  to: string;
  player: string;
}
export function ReportDetail({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const data = surface.data as ReportDetail,
    editor = useEditor(runtime, surface, {}),
    p = runtime.state.players.find((p) => p.id === data.player);
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={data.title}
      className="report-detail-modal modal"
      titleId="reportDetailTitle"
      description={`${p?.surname || ""} ${p?.name || ""} · ${fmt(data.from)} – ${fmt(data.to)} · ${data.items.length} registrazioni`}
      closeLabel="Chiudi dettagli report"
    >
      <div className="list">
        {data.items.map((item, i) => (
          <article className="row" key={i}>
            <div className="row-main">
              <b>{item.name}</b>
              <p>{item.detail}</p>
            </div>
            {item.match ? (
              <Button
                variant="secondary"
                disabled={editor.busy}
                data-drill-match={item.match.id}
                aria-label={`Apri report partita contro ${item.match.opponent} del ${fmt(item.match.match_date)}`}
                onClick={() =>
                  void editor.run(async () => {
                    const m = item.match!,
                      snapshot = await loadSportPeriod(
                        m.match_date,
                        m.match_date,
                        teamOwner(),
                      );
                    if (!editor.current()) return;
                    const match = snapshot.matches.find(
                      (row: Match) => row.id === m.id,
                    );
                    if (!match) throw Error("Gara non disponibile");
                    ui.open("match-report", {
                      match,
                      activity: snapshot.activities.find(
                        (a: Activity) => a.match_id === match.id,
                      ),
                      roster: snapshot.roster,
                      events: snapshot.events,
                      players: runtime.state.players,
                    });
                  })
                }
              >
                Tabellino gara
              </Button>
            ) : null}
          </article>
        ))}
        {!data.items.length ? <p>Nessuna registrazione nel periodo.</p> : null}
      </div>
      <Feedback id="reportDetailError" error={editor.error} />
    </EditorFrame>
  );
}
function Bars({
  title,
  rows,
  unit = "",
  family = "attendance",
}: {
  title: string;
  rows: [string, number][];
  unit?: string;
  family?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <article className="chart-card" data-chart-family={family}>
      <h4>{title}</h4>
      <p className="chart-scale">
        Scala: 0–{max} {unit.trim() || "registrazioni"}
      </p>
      {rows.map(([label, value]) => (
        <div className="chart-bar-row" key={label}>
          <span>{label}</span>
          <div className="chart-track">
            <div
              className="chart-fill"
              style={{ width: `${Math.round((value / max) * 100)}%` }}
            />
          </div>
          <b>
            {value}
            {unit}
          </b>
        </div>
      ))}
      {!rows.length ? (
        <p className="row-sub">Nessun dato registrato nel periodo.</p>
      ) : null}
    </article>
  );
}
export function Reports({ runtime }: { runtime: Runtime }) {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    players = sortPlayers(runtime.state.players),
    view = runtime.state.reportView;
  const player =
      params.get("player") ||
      runtime.state.reportPlayer ||
      view?.player ||
      players[0]?.id ||
      "",
    period = params.get("period") || view?.period || "30",
    from =
      period === "custom"
        ? params.get("from") || view?.from || recentFrom(30)
        : period === "month"
          ? today().slice(0, 7) + "-01"
          : period === "all"
            ? runtime.state.earliestSport || today()
            : recentFrom(Number(period)),
    to =
      period === "custom" ? params.get("to") || view?.to || today() : today();
  const [data, setData] = useState<ReturnType<typeof reportData> | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [retry, refresh] = useState(0),
    [pdfBusy, setPdfBusy] = useState(false),
    request = useRef(0),
    pdfLock = useRef(false);
  const change = (values: Record<string, string>) => {
    const next = new URLSearchParams(location.hash.split("?")[1]);
    next.set("player", player);
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    navigate("/reports?" + next, { replace: true });
  };
  useEffect(() => {
    const generation = ++request.current,
      current = runtime.requestGuard();
    setError("");
    setData(null);
    if (!player || !from || !to || from > to) {
      setError(
        "Seleziona un giocatore e un periodo valido: la data iniziale deve precedere o coincidere con quella finale.",
      );
      return;
    }
    runtime.state.reportView = { player, period, from, to };
    delete runtime.state.reportPlayer;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const range = runtime.state.dataRange,
          snapshot =
            !range || from < range.from || to > range.to
              ? await loadSportPeriod(from, to, teamOwner(), player)
              : runtime.state;
        if (alive && generation === request.current && current())
          setData(reportData(from, to, player, snapshot));
      } catch (cause) {
        if (alive && generation === request.current && current())
          setError("Storico non caricato: " + (cause as Error).message);
      } finally {
        if (alive && generation === request.current) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      ++request.current;
    };
  }, [runtime, player, period, from, to, retry]);
  const routedMatch = params.get("match");
  useEffect(() => {
    if (
      !routedMatch ||
      ui
        .getSnapshot()
        .surfaces.some((s) => s.detail === "report-match:" + routedMatch)
    )
      return;
    let alive = true;
    const current = runtime.requestGuard();
    void (async () => {
      try {
        let match = runtime.state.matches.find((m) => m.id === routedMatch);
        if (!match) {
          const response = await runtime.db
            .from("matches")
            .select("*")
            .eq("id", routedMatch)
            .eq("user_id", teamOwner())
            .single();
          if (response.error) throw response.error;
          match = response.data as Match;
        }
        if (!match) throw Error("Partita non disponibile");
        const snapshot = await loadSportPeriod(
          match.match_date,
          match.match_date,
          teamOwner(),
        );
        if (alive && current())
          ui.open(
            "match-report",
            {
              match,
              activity: snapshot.activities.find(
                (a: Activity) => a.match_id === match!.id,
              ),
              roster: snapshot.roster,
              events: snapshot.events,
              players: runtime.state.players,
            },
            { page: "reports", detail: "report-match:" + routedMatch },
          );
      } catch (cause) {
        if (alive && current())
          setError("Tabellino non caricato: " + (cause as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [routedMatch, runtime, retry]);
  const p = players.find((p) => p.id === player),
    model = data ? playerReportModel(data) : null;
  const sessions = new Map<string, Session>(
      (data?.sessions || []).map((s: Session) => [s.id, s]),
    ),
    activities = new Map<string, Activity>(
      (data?.activities || []).map((a: Activity) => [a.id, a]),
    ),
    matches = new Map<string, Match>(
      (data?.matches || []).map((m: Match) => [m.id, m]),
    );
  const attendance = (data?.attendance || []) as Attendance[],
    present = attendance.filter((r) => r.status === "Presente"),
    absent = attendance.filter((r) => r.status === "Assente"),
    injured = attendance.filter((r) => r.status === "Infortunato");
  const roster = data?.roster || [],
    called = roster.filter(
      (r) =>
        r.called && activities.get(r.activity_id)?.activity_type === "Partita",
    ),
    minutes = roster.filter(
      (r) =>
        r.minutes_played > 0 &&
        activities.get(r.activity_id)?.activity_type === "Partita",
    ),
    goals = (data?.events || []).filter(
      (e) => e.event_type === "Gol" && e.player_id,
    ),
    cards = (data?.events || []).filter(
      (e) =>
        e.player_id && ["Ammonizione", "Espulsione"].includes(e.event_type),
    );
  const attendanceItems = (rows: Attendance[]): ReportItem[] =>
    newestFirst(
      rows,
      (r: Attendance) => sessions.get(r.session_id!)?.session_date,
    ).map((r: Attendance) => ({
      name: `${fmt(sessions.get(r.session_id!)?.session_date || "")} · ${sessions.get(r.session_id!)?.session_type || "Sessione"}`,
      detail: `${r.status}${r.note ? " · " + r.note : ""}`,
    }));
  const drills: Record<
    string,
    { label: string; value: number; items: ReportItem[] }
  > = {
    sessions: {
      label: "Sessioni registrate",
      value: new Set(attendance.map((r) => r.session_id)).size,
      items: attendanceItems(attendance),
    },
    present: {
      label: "Presenze",
      value: present.length,
      items: attendanceItems(present),
    },
    absent: {
      label: "Assenze",
      value: absent.length,
      items: attendanceItems(absent),
    },
    injured: {
      label: "Infortuni",
      value: injured.length,
      items: attendanceItems(injured),
    },
    called: {
      label: "Convocazioni",
      value: called.length,
      items: newestFirst(
        called,
        (r: RosterRow) => activities.get(r.activity_id)?.activity_date,
      ).map((r) => ({
        name: `${fmt(activities.get(r.activity_id)?.activity_date || "")} · ${activities.get(r.activity_id)?.title || "Gara"}`,
        detail: `${r.lineup} · ${r.minutes_played} min`,
        match: matches.get(activities.get(r.activity_id)?.match_id || ""),
      })),
    },
    minutes: {
      label: "Minuti registrati",
      value: minutes.reduce((n, r) => n + Number(r.minutes_played || 0), 0),
      items: newestFirst(
        minutes,
        (r: RosterRow) => activities.get(r.activity_id)?.activity_date,
      ).map((r) => ({
        name: `${fmt(activities.get(r.activity_id)?.activity_date || "")} · ${activities.get(r.activity_id)?.title || "Gara"}`,
        detail: `${r.minutes_played} min`,
        match: matches.get(activities.get(r.activity_id)?.match_id || ""),
      })),
    },
    goals: {
      label: "Gol dei giocatori",
      value: goals.length,
      items: newestFirst(
        goals,
        (e: MatchEvent) => matches.get(e.match_id)?.match_date,
      ).map((e) => ({
        name: `${fmt(matches.get(e.match_id)?.match_date || "")} · ${matches.get(e.match_id)?.opponent || "Partita"}`,
        detail: `${e.event_type}${e.minute == null ? "" : " · " + e.minute + "′"}`,
        match: matches.get(e.match_id),
      })),
    },
    cards: {
      label: "Cartellini",
      value: cards.length,
      items: newestFirst(
        cards,
        (e: MatchEvent) => matches.get(e.match_id)?.match_date,
      ).map((e) => ({
        name: `${fmt(matches.get(e.match_id)?.match_date || "")} · ${matches.get(e.match_id)?.opponent || "Partita"}`,
        detail: `${e.event_type}${e.minute == null ? "" : " · " + e.minute + "′"}`,
        match: matches.get(e.match_id),
      })),
    },
  };
  const text = [
    "REPORT GIOCATORE · EBURUM",
    `${p?.surname || ""} ${p?.name || ""}`,
    `Periodo: ${fmt(from)} – ${fmt(to)}`,
    `Sessioni registrate per il giocatore: ${attendance.length}`,
    `Presenze: ${present.length}${attendance.length ? ` (${Math.round((present.length / attendance.length) * 100)}% su ${attendance.length} registrazioni)` : ""}`,
    `Assenze: ${absent.length}`,
    `Infortuni: ${injured.length}`,
    `Convocazioni: ${called.length}`,
    `Minuti giocati: ${drills.minutes.value}`,
    `Gol dei giocatori: ${goals.length}`,
    `Cartellini: ${cards.length}`,
    `Risposte WhatsApp: ${attendance.filter((r) => r.notified === true).length} risposto - ${attendance.filter((r) => r.notified === false).length} non risposto - ${attendance.filter((r) => r.notified == null).length} da verificare`,
  ].join("\n");
  useEffect(() => {
    if (!data || loading) return;
    const key = params.get("detail");
    if (
      key &&
      drills[key] &&
      !ui
        .getSnapshot()
        .surfaces.some((s) => s.detail === "report-detail:" + key)
    ) {
      const drill = drills[key];
      ui.open(
        "report-detail",
        { title: drill.label, items: drill.items, from, to, player },
        { page: "reports", detail: "report-detail:" + key },
      );
    }
  }, [data, loading, params]);
  const metric = (key: string) => {
    const d = drills[key];
    return (
      <button
        className="report-metric"
        key={key}
        data-report-detail={key}
        aria-label={`${d.label}: ${d.value}. Apri dettagli`}
        onClick={() =>
          ui.open(
            "report-detail",
            { title: d.label, items: d.items, from, to, player },
            { page: "reports", detail: "report-detail:" + key },
          )
        }
      >
        <b>{d.value}</b>
        <span>{d.label}</span>
        <small>Vedi dettagli ›</small>
      </button>
    );
  };
  return (
    <>
      <div className="section-title">
        <div>
          <h1>Report giocatore</h1>
          <p>Presenze, disponibilità e impiego nel periodo selezionato.</p>
        </div>
        <div className="report-export-actions">
          {data ? (
            <CopyText id="copyReport" text={text}>
              Copia testo
            </CopyText>
          ) : null}
          <Button
            id="exportReportPdf"
            disabled={!data || pdfBusy}
            onClick={async () => {
              if (pdfLock.current || !data) return;
              pdfLock.current = true;
              setPdfBusy(true);
              const generation = request.current,
                current = runtime.requestGuard();
              try {
                const model = playerReportModel(data),
                  filename = playerReportFilename(data);
                await ensureJsPdf();
                if (generation === request.current && current()) {
                  createPlayerReportPdf(model).save(filename);
                  ui.notify(
                    "PDF creato. Controlla i download del dispositivo.",
                  );
                }
              } catch (cause) {
                if (current())
                  setError(
                    "Impossibile creare il PDF: " + (cause as Error).message,
                  );
              } finally {
                pdfLock.current = false;
                setPdfBusy(false);
              }
            }}
          >
            Scarica PDF
          </Button>
        </div>
      </div>
      <section className="report-controls">
        <Field id="reportPeriod" label="Periodo" className="report-period">
          <select
            id="reportPeriod"
            value={period}
            onChange={(e) => change({ period: e.target.value })}
          >
            {[
              ["7", "Ultimi 7 giorni"],
              ["30", "Ultimi 30 giorni"],
              ["month", "Questo mese"],
              ["all", "Tutto lo storico"],
              ["custom", "Personalizzato"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <div
          className="form-grid report-range-fields"
          hidden={period !== "custom"}
        >
          <Field id="rf" label="Dal">
            <input
              id="rf"
              type="date"
              value={from}
              onChange={(e) =>
                change({ period: "custom", from: e.target.value })
              }
            />
          </Field>
          <Field id="rt" label="Al">
            <input
              id="rt"
              type="date"
              value={to}
              onChange={(e) => change({ period: "custom", to: e.target.value })}
            />
          </Field>
        </div>
        <div id="playerPicker" className="field field-space">
          <Field id="rp" label="Giocatore">
            <select
              id="rp"
              value={player}
              onChange={(e) => change({ player: e.target.value })}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.surname} {p.name}
                  {p.active ? "" : " · Inattivo"}
                </option>
              ))}
            </select>
          </Field>
          <output
            id="reportSelectedName"
            className="selected-name"
            htmlFor="rp"
          >
            {p?.surname} {p?.name}
          </output>
        </div>
        <p id="reportPeriodLabel" className="filter-summary">
          {fmt(from)} – {fmt(to)} · {p?.surname} {p?.name} · {attendance.length}{" "}
          registrazioni di presenza
        </p>
        <Feedback id="reportError" error={error} />
        {error ? (
          <Button
            id="reportRetry"
            variant="secondary"
            onClick={() => refresh((n) => n + 1)}
          >
            Riprova
          </Button>
        ) : null}
      </section>
      {loading ? (
        <div
          id="reportLoading"
          className="loading-skeleton"
          role="status"
          aria-label="Caricamento storico"
        >
          <div className="skeleton-line" />
          <div className="skeleton-card" />
        </div>
      ) : null}
      {data && model ? (
        <div id="reportContent" className="report-document">
          <header id="reportPerson" className="report-person">
            <h3>
              {p?.surname} {p?.name}
            </h3>
            <p>
              {p?.role} · {fmt(from)} – {fmt(to)}
            </p>
          </header>
          <div className="report-facts">
            <section>
              <h3>Partecipazione</h3>
              <div id="reportStats" className="player-kpis">
                {["sessions", "present", "absent", "injured"].map(metric)}
              </div>
            </section>
            <section>
              <h3>Impiego in gara</h3>
              <div id="sportStats" className="player-kpis">
                {["called", "minutes", "goals"].map(metric)}
              </div>
            </section>
            <section>
              <h3>Disciplina</h3>
              <div id="disciplineStats" className="player-kpis">
                {metric("cards")}
              </div>
            </section>
          </div>
          <p className="row-sub report-facts-help">
            Presenze effettive, distinte dalle risposte WhatsApp. Seleziona un
            indicatore per i dettagli.
          </p>
          <div className="report-reading-grid">
            <section className="report-chart-region">
              <h3>Andamento del giocatore</h3>
              <div id="attendanceTrend" className="attendance-trend">
                {model.months
                  .filter((month) => month.total)
                  .map((month) => (
                    <div className="trend-row" key={month.label}>
                      <span>{month.label}</span>
                      <meter
                        min={0}
                        max={100}
                        value={Math.round((month.present / month.total) * 100)}
                        aria-label={`${month.label}: ${month.present} presenze su ${month.total}`}
                      />
                      <b>{Math.round((month.present / month.total) * 100)}%</b>
                      <small>
                        {month.present}/{month.total} registrazioni
                      </small>
                    </div>
                  ))}
              </div>
              <div id="playerCharts" className="player-charts">
                <Bars
                  title="Presenze effettive"
                  rows={model.attendance as [string, number][]}
                />
                <Bars
                  family="replies"
                  title="Risposte WhatsApp registrate"
                  rows={model.replies as [string, number][]}
                />
                <Bars
                  family="minutes"
                  title="Minuti giocati per mese"
                  rows={model.months.map((month) => [
                    month.label,
                    month.minutes,
                  ])}
                  unit=" min"
                />
                <p className="row-sub">
                  Le barre confrontano i valori all’interno di ogni grafico. Le
                  risposte WhatsApp non determinano automaticamente la presenza.
                  I minuti sono quelli registrati dallo staff.
                </p>
              </div>
            </section>
            <section id="playerHistory" className="player-history">
              <h3>Storico nel periodo</h3>
              {attendanceItems(attendance).map((row, i) => (
                <div className="row" key={i}>
                  <span>
                    <b>{row.name}</b>
                    <br />
                    {row.detail}
                  </span>
                </div>
              ))}
            </section>
          </div>
          <details className="report-text-details">
            <summary>Testo del report</summary>
            <pre id="report" className="report">
              {text}
            </pre>
          </details>
        </div>
      ) : null}
    </>
  );
}

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
