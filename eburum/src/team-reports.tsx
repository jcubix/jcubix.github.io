import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadSportPeriod, sportSeason } from "../app-data.ts";
import { fmt, teamOwner, today } from "../app-part1.js";
import { ensureJsPdf } from "../app-pdf-loader.js";
import { validDay } from "../app-presentation.js";
import {
  createTeamReportExcel,
  createTeamReportPdf,
  sortTeamReport,
  teamReportCell,
  teamReportColumns,
  teamReportRows,
} from "../app-team-report.js";
import { recentFrom } from "../app-workflows.js";
import { Button } from "./components/ui/button";
import { saveDownload } from "./finance-api";
import { Feedback, Field } from "./operational-ui";
import "./team-reports.css";
import type { Runtime } from "./types";

export function ReportViewSwitch() {
  const [params] = useSearchParams();
  const team = params.get("view") === "team";
  const link = (view: string) => {
    const next = new URLSearchParams(params);
    next.set("view", view);
    next.delete("detail");
    next.delete("match");
    return "/reports?" + next;
  };
  return (
    <nav
      className="workflow-switch report-view-switch"
      aria-label="Tipo di report"
    >
      <Link to={link("player")} aria-current={!team ? "page" : undefined}>
        Giocatore
      </Link>
      <Link to={link("team")} aria-current={team ? "page" : undefined}>
        Squadra
      </Link>
    </nav>
  );
}

type ReportRow = ReturnType<typeof teamReportRows>[number];
export function TeamReports({ runtime }: { runtime: Runtime }) {
  const [params, setParams] = useSearchParams(),
    season = sportSeason();
  const requested = params.get("period") || "season";
  const period = ["season", "7", "30", "month", "all", "custom"].includes(
    requested,
  )
    ? requested
    : "season";
  const from =
    period === "season"
      ? season.from
      : period === "all"
        ? runtime.state.earliestSport || season.from
        : period === "month"
          ? today().slice(0, 7) + "-01"
          : period === "custom"
            ? params.get("from") || season.from
            : recentFrom(Number(period));
  const to =
    period === "season"
      ? season.to
      : period === "custom"
        ? params.get("to") || today()
        : today();
  const valid = validDay(from) && validDay(to) && from <= to;
  const owner = runtime.state.team?.owner_id || runtime.state.user?.id || "",
    key = `${owner}:${from}:${to}`;
  const [result, setResult] = useState<{
      key: string;
      rows: ReportRow[];
    } | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [exportKind, setExportKind] = useState<"excel" | "pdf" | null>(null);
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const liveKey = useRef(key),
    alive = useRef(true),
    exporting = useRef(false);
  liveKey.current = key;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    const guard = runtime.requestGuard();
    setResult(null);
    setError("");
    if (!valid)
      return () => {
        current = false;
      };
    void (async () => {
      try {
        const range = runtime.state.dataRange;
        const snapshot =
          range && from >= range.from && to <= range.to
            ? runtime.state
            : await loadSportPeriod(from, to, teamOwner());
        const rows = teamReportRows(runtime.state.players, snapshot, from, to);
        if (current && guard()) setResult({ key, rows });
      } catch (cause) {
        if (current && guard())
          setError(
            "Report non caricato: " + ((cause as Error).message || "Riprova."),
          );
      }
    })();
    return () => {
      current = false;
    };
  }, [
    runtime,
    key,
    valid,
    retry,
    from,
    to,
    runtime.state.players,
    runtime.state.sessions,
    runtime.state.attendance,
    runtime.state.matches,
    runtime.state.events,
    runtime.state.roster,
    runtime.state.dataRange,
  ]);
  const ready = valid && result?.key === key;
  const rows = ready
    ? sortTeamReport(result.rows, sort.key, sort.direction)
    : [];
  const change = (values: Record<string, string>) => {
    const next = new URLSearchParams(location.hash.split("?")[1]);
    next.set("view", "team");
    for (const [name, value] of Object.entries(values)) next.set(name, value);
    setParams(next, { replace: true });
  };
  const individual = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("view", "player");
    next.set("player", id);
    next.set("period", period);
    next.set("from", from);
    next.set("to", to);
    next.delete("detail");
    next.delete("match");
    return "/reports?" + next;
  };
  const groups = [...new Set(teamReportColumns.map((column) => column.group))];
  const exportReport = async (kind: "excel" | "pdf") => {
    if (!ready || !rows.length || exporting.current) return;
    const guard = runtime.requestGuard(),
      captured = key;
    exporting.current = true;
    setExportKind(kind);
    setError("");
    try {
      if (kind === "excel") {
        const bytes = await createTeamReportExcel(rows, from, to);
        if (alive.current && guard() && liveKey.current === captured)
          saveDownload(
            new Blob([bytes], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            `Eburum-squadra-${from}-${to}.xlsx`,
          );
      } else {
        await ensureJsPdf();
        if (alive.current && guard() && liveKey.current === captured)
          createTeamReportPdf(rows, from, to).save(
            `Eburum-squadra-${from}-${to}.pdf`,
          );
      }
    } catch (cause) {
      if (alive.current && guard() && liveKey.current === captured)
        setError(
          (kind === "excel" ? "File Excel non creato: " : "PDF non creato: ") +
            ((cause as Error).message || "Riprova."),
        );
    } finally {
      exporting.current = false;
      if (alive.current) setExportKind(null);
    }
  };
  return (
    <>
      <div className="section-title">
        <div>
          <h1>Report squadra</h1>
          <p>Allenamenti, impiego e rendimento di tutti i giocatori.</p>
        </div>
      </div>
      <ReportViewSwitch />
      <section
        className="team-report-controls"
        aria-label="Periodo del report squadra"
      >
        <Field id="teamReportPeriod" label="Periodo">
          <select
            id="teamReportPeriod"
            value={period}
            onChange={(event) => change({ period: event.target.value })}
          >
            {[
              ["season", `Stagione ${season.key}`],
              ["30", "Ultimi 30 giorni"],
              ["month", "Questo mese"],
              ["7", "Ultimi 7 giorni"],
              ["all", "Tutto lo storico"],
              ["custom", "Personalizzato"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {period === "custom" ? (
          <>
            <Field id="teamReportFrom" label="Dal">
              <input
                id="teamReportFrom"
                type="date"
                value={from}
                onChange={(event) => change({ from: event.target.value })}
              />
            </Field>
            <Field id="teamReportTo" label="Al">
              <input
                id="teamReportTo"
                type="date"
                value={to}
                onChange={(event) => change({ to: event.target.value })}
              />
            </Field>
          </>
        ) : null}
        <p className="row-sub team-report-period" role="status">
          {valid
            ? `${fmt(from)} – ${fmt(to)}${ready ? ` · ${rows.length} giocatori` : ""}`
            : "Seleziona un intervallo valido: la data iniziale deve precedere o coincidere con quella finale."}
        </p>
      </section>
      <Feedback id="teamReportError" error={error} />
      {error && !ready ? (
        <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
          Riprova
        </Button>
      ) : null}
      {!ready && !error && valid ? (
        <div
          className="loading-skeleton"
          role="status"
          aria-label="Caricamento report squadra"
        >
          <div className="skeleton-line" />
          <div className="skeleton-card" />
        </div>
      ) : null}
      {ready ? (
        <>
          <p className="team-report-help" id="teamReportHelp">
            Presenze effettive confermate. Gli allenamenti senza registrazione
            non sono assenze. Esporta in Excel (.xlsx) per lavorare sui dati.
          </p>
          {rows.length ? (
            <p className="team-report-help">
              Scorri per vedere tutti i dati. Seleziona un giocatore per il
              dettaglio.
            </p>
          ) : null}
          {rows.length ? (
            <div
              className="team-report-scroll"
              role="region"
              aria-label="Tabella report squadra, scorri per vedere tutte le colonne"
              aria-describedby="teamReportHelp"
              tabIndex={0}
            >
              <table className="team-report-table">
                <caption className="sr-only">
                  Report squadra dal {fmt(from)} al {fmt(to)}. Seleziona un
                  giocatore per il report individuale.
                </caption>
                <thead>
                  <tr className="team-report-groups">
                    {groups.map((group) => (
                      <th
                        scope="colgroup"
                        colSpan={
                          teamReportColumns.filter(
                            (column) => column.group === group,
                          ).length
                        }
                        key={group}
                      >
                        {group}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {teamReportColumns.map((column) => (
                      <th
                        scope="col"
                        key={column.key}
                        aria-sort={
                          sort.key === column.key
                            ? sort.direction === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        <button
                          aria-label={`Ordina per ${column.label}`}
                          onClick={() =>
                            setSort((previous) => ({
                              key: column.key,
                              direction:
                                previous.key === column.key &&
                                previous.direction === "asc"
                                  ? "desc"
                                  : "asc",
                            }))
                          }
                        >
                          {column.label}
                          {sort.key === column.key ? (
                            sort.direction === "asc" ? (
                              <ArrowUp size={14} />
                            ) : (
                              <ArrowDown size={14} />
                            )
                          ) : (
                            <ArrowUpDown size={14} />
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} data-team-player={row.id}>
                      {teamReportColumns.map((column) =>
                        column.key === "name" ? (
                          <th scope="row" key={column.key}>
                            <Link to={individual(row.id)}>{row.name}</Link>
                            {!row.active ? <small>Inattivo</small> : null}
                          </th>
                        ) : (
                          <td key={column.key}>
                            {teamReportCell(row, column.key)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sc-empty-state">
              <h2>Nessun giocatore nella rosa</h2>
              <p>I giocatori aggiunti alla squadra compariranno qui.</p>
            </div>
          )}
          <details className="team-report-method">
            <summary>Come leggere i dati</summary>
            <p>
              Allenamenti registrati: le presenze, assenze e gli infortuni
              confermati per il giocatore. La percentuale usa queste
              registrazioni; il trattino indica che non ci sono dati.
            </p>
            <p>
              Le convocazioni includono quelle programmate nel periodo. Le
              titolarità riguardano gare con risultato, minuti o eventi
              registrati. Gli ingressi dalla panchina derivano dalle
              sostituzioni, non dalla sola convocazione. I minuti sono quelli
              registrati dallo staff.
            </p>
            <p>
              I giocatori disattivati restano inclusi per conservare lo storico.
            </p>
          </details>
        </>
      ) : null}
      <div className="report-export-actions" hidden={!ready || !rows.length}>
        <Button
          variant="secondary"
          disabled={!ready || !rows.length || exportKind !== null}
          onClick={() => void exportReport("excel")}
        >
          <Download size={18} />
          {exportKind === "excel" ? "Creo il file Excel…" : "Esporta Excel"}
        </Button>
        <Button
          disabled={!ready || !rows.length || exportKind !== null}
          onClick={() => void exportReport("pdf")}
        >
          {exportKind === "pdf" ? "Creo il PDF…" : "Scarica PDF"}
        </Button>
      </div>
    </>
  );
}
