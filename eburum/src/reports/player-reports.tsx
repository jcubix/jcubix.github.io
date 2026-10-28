import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadSportPeriod, sportSeason } from "../../app-data.ts";
import { fmt, sortPlayers, teamOwner, today } from "../../app-part1.js";
import { reportData } from "../../app-part5.js";
import { ensureJsPdf } from "../../app-pdf-loader.js";
import {
  createPlayerReportPdf,
  playerReportFilename,
  playerReportModel,
} from "../../app-report-export.js";
import { recentFrom } from "../../app-workflows.js";
import { Button } from "../components/ui/button";
import { CopyText, Feedback, Field } from "../operational-ui";
import { playerReportDetails } from "../player-report-model";
import { ReportViewSwitch } from "../team-reports";
import type { Activity, Match, Runtime } from "../types";
import { ui } from "../ui-service";
import { Bars } from "./bars";
export function PlayerReports({ runtime }: { runtime: Runtime }) {
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
        : period === "season"
          ? sportSeason().from
          : period === "month"
            ? today().slice(0, 7) + "-01"
            : period === "all"
              ? runtime.state.earliestSport || today()
              : recentFrom(Number(period)),
    to =
      period === "season"
        ? sportSeason().to
        : period === "custom"
          ? params.get("to") || view?.to || today()
          : today();
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
    };
  }, [
    runtime,
    player,
    period,
    from,
    to,
    retry,
    runtime.state.players,
    runtime.state.sessions,
    runtime.state.attendance,
    runtime.state.matches,
    runtime.state.events,
    runtime.state.roster,
    runtime.state.dataRange,
  ]);
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
  const {
    drills,
    attendance,
    present,
    absent,
    injured,
    called,
    goals,
    cards,
    attendanceItems,
  } = useMemo(() => playerReportDetails(data), [data]);
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
  }, [data, loading, params, drills, from, to, player]);
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
      <ReportViewSwitch />
      <section className="report-controls">
        <Field id="reportPeriod" label="Periodo" className="report-period">
          <select
            id="reportPeriod"
            value={period}
            onChange={(e) => change({ period: e.target.value })}
          >
            {[
              ["season", `Stagione ${sportSeason().key}`],
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
