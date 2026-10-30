import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  FileChartColumn,
  Flag,
  LogOut,
  Plus,
  Presentation,
  Search,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { matchTitle } from "../app-match-display.js";
import { dayLabel, matchOutcome } from "../app-presentation.js";
import {
  canManageRole,
  canPlanRole,
  canTechnicalRole,
  canViewExpiriesRole,
  canViewFinanceRole,
} from "../app-roles.ts";
import { Button } from "./components/ui/button";
import type { Player, Runtime } from "./types";
const date = (value: string) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
const canPlan = (runtime: Runtime) =>
  canPlanRole(runtime.state.team?.role || "");
const canManage = (runtime: Runtime) =>
  canManageRole(runtime.state.team?.role || "");
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="sc-page-heading page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

export function MatchesPage({ runtime }: { runtime: Runtime }) {
  const today = new Date().toLocaleDateString("en-CA"),
    activities = runtime.state.activities;
  const cancelled = (m: Runtime["state"]["matches"][number]) =>
    activities.some((a) => a.match_id === m.id && a.status === "Annullato");
  const played = (m: Runtime["state"]["matches"][number]) =>
    m.match_date <= today && !!matchOutcome(m) && !cancelled(m);
  const results = [...runtime.state.matches]
    .filter(played)
    .sort((a, b) => b.match_date.localeCompare(a.match_date));
  const upcoming = [...runtime.state.matches]
    .filter((m) => !played(m) && m.match_date >= today && !cancelled(m))
    .sort((a, b) => a.match_date.localeCompare(b.match_date));
  const incomplete = [...runtime.state.matches]
    .filter((m) => !played(m) && m.match_date < today && !cancelled(m))
    .sort((a, b) => b.match_date.localeCompare(a.match_date));
  const others = runtime.state.matches.filter((m) => cancelled(m));
  const attention = runtime.state.players.filter((p) => {
    const d = runtime.actions.playerDiscipline(p.id);
    return d.redAttention || d.pending.length || d.review.length;
  }).length;
  const card = (match: Runtime["state"]["matches"][number]) => {
    const away = match.venue === "Trasferta",
      activity = activities.find((a) => a.match_id === match.id),
      outcome = played(match) ? matchOutcome(match) : null;
    return (
      <button
        className={
          "sc-match-preview " + (match.match_date === today ? "is-today" : "")
        }
        key={match.id}
        onClick={() => runtime.actions.openMatch(match)}
        aria-label={matchTitle(match) + ", " + date(match.match_date)}
      >
        <div className="sc-match-meta">
          <span>
            {date(match.match_date)}
            {match.match_date === today ? (
              <span className="badge tone-warning">OGGI</span>
            ) : null}
          </span>
          <span className={"badge " + (away ? "venue-away" : "venue-home")}>
            {match.venue}
          </span>
          {outcome ? (
            <span
              className={"match-outcome outcome-" + outcome}
              aria-label={
                { V: "Vittoria", N: "Pareggio", P: "Sconfitta" }[
                  outcome as "V" | "N" | "P"
                ]
              }
            >
              {outcome}
            </span>
          ) : null}
          {cancelled(match) ? (
            <span className="badge tone-neutral">Annullata</span>
          ) : null}
        </div>
        <div className="match-scoreboard">
          <span className={"match-team " + (!away ? "is-own" : "")}>
            {away ? match.opponent : "Eburum"}
          </span>
          {outcome ? (
            <strong
              className="match-goals"
              data-winner={
                away
                  ? Number(match.goals_against) > Number(match.goals_for)
                  : Number(match.goals_for) > Number(match.goals_against)
              }
            >
              {away ? match.goals_against : match.goals_for}
            </strong>
          ) : (
            <strong className="match-future-time">
              {activity?.start_time?.slice(0, 5) || "Da definire"}
              <small>
                {match.match_date >= today
                  ? dayLabel(match.match_date, today)
                  : "Risultato da registrare"}
              </small>
            </strong>
          )}
          <span className={"match-team " + (away ? "is-own" : "")}>
            {away ? "Eburum" : match.opponent}
          </span>
          {outcome ? (
            <strong
              className="match-goals"
              data-winner={
                away
                  ? Number(match.goals_for) > Number(match.goals_against)
                  : Number(match.goals_against) > Number(match.goals_for)
              }
            >
              {away ? match.goals_for : match.goals_against}
            </strong>
          ) : null}
        </div>
        <footer>
          <span>
            {outcome
              ? "Risultato ed eventi"
              : canPlan(runtime)
                ? "Prepara la distinta"
                : "Consulta partita"}
          </span>
          <ArrowUpRight size={20} />
        </footer>
      </button>
    );
  };
  return (
    <div className="sc-surface">
      <PageHeading
        title="Partite"
        description={`${upcoming.length} in programma · ${results.length} risultati registrati`}
      >
        {canPlan(runtime) ? (
          <Button onClick={runtime.actions.newMatch} aria-label="Nuova partita">
            <Plus />
            <span className="page-add-label">Nuova gara</span>
          </Button>
        ) : null}
      </PageHeading>
      <div className="sc-section-heading">
        <h2>Calendario gare</h2>
        <button
          onClick={runtime.actions.discipline}
          aria-label="Cartellini"
          aria-describedby={attention ? "disciplineCount" : undefined}
        >
          <Flag size={20} />
          Cartellini
          {attention ? (
            <span id="disciplineCount" className="badge tone-warning">
              {attention}
              <span className="sr-only"> da verificare</span>
            </span>
          ) : null}
        </button>
      </div>
      {results.length ? (
        <div className="recent-form" aria-label="Ultime cinque partite">
          <span>
            Forma recente <small>Dalla più vecchia alla più recente</small>
          </span>
          {results
            .slice(0, 5)
            .reverse()
            .map((m) => (
              <span
                key={m.id}
                className={"match-outcome outcome-" + matchOutcome(m)}
                title={date(m.match_date) + " · " + m.opponent}
              >
                {matchOutcome(m)}
              </span>
            ))}
        </div>
      ) : null}
      {upcoming.length ? (
        <section className="sc-match-upcoming">
          <div className="sc-section-heading">
            <h2>Prossima</h2>
          </div>
          <div className="sc-match-grid">{card(upcoming[0])}</div>
          {upcoming.length > 1 ? (
            <details className="sc-match-future-list">
              <summary>Altre gare in programma ({upcoming.length - 1})</summary>
              <div className="sc-match-grid">{upcoming.slice(1).map(card)}</div>
            </details>
          ) : null}
        </section>
      ) : (
        <div className="sc-match-empty">
          <p>Nessuna gara in programma</p>
          {canPlan(runtime) ? (
            <Button variant="secondary" onClick={runtime.actions.newMatch}>
              Aggiungi gara
            </Button>
          ) : null}
        </div>
      )}
      {incomplete.length ? (
        <section>
          <div className="sc-section-heading">
            <h2>Da completare</h2>
            <span>{incomplete.length} senza risultato</span>
          </div>
          <div className="sc-match-grid">{incomplete.map(card)}</div>
        </section>
      ) : null}
      {results.length ? (
        <section>
          <div className="sc-section-heading">
            <h2>Risultati</h2>
          </div>
          <div className="sc-match-grid">{results.map(card)}</div>
        </section>
      ) : null}
      {others.length ? (
        <section>
          <div className="sc-section-heading">
            <h2>Gare annullate</h2>
          </div>
          <div className="sc-match-grid">{others.map(card)}</div>
        </section>
      ) : null}
      {!runtime.state.matches.length ? (
        <div className="sc-empty-state">
          <Trophy aria-hidden="true" />
          <h3>Nessuna partita registrata</h3>
          <p>La prossima gara e i risultati della squadra compariranno qui.</p>
          {canPlan(runtime) ? (
            <Button onClick={runtime.actions.newMatch}>
              Programma partita
            </Button>
          ) : null}
        </div>
      ) : null}
      {canTechnicalRole(runtime.state.team?.role || "") ? (
        <NavLink className="utility-link" to="/whiteboard">
          <Presentation size={20} />
          <span className="utility-copy">
            <strong>Lavagna tattica delle partite</strong>
            <small>Campo, foto e annotazioni</small>
          </span>
          <ChevronRight size={20} />
        </NavLink>
      ) : null}
    </div>
  );
}

function PlayerRow({ runtime, player }: { runtime: Runtime; player: Player }) {
  const cards = runtime.actions.playerDiscipline(player.id);
  return (
    <article className="sc-directory-row native-player">
      <button
        className="player-directory-entry"
        onClick={() => runtime.actions.playerSheet(player.id)}
        aria-label={`Scheda di ${player.surname} ${player.name}`}
      >
        <span
          className="sc-person-avatar"
          data-role={player.role}
          aria-hidden="true"
        >
          {player.name.slice(0, 1)}
          {player.surname.slice(0, 1)}
        </span>
        <span className="sc-person-copy">
          <b>
            {player.surname} {player.name}
          </b>
          <small>{player.role}</small>
        </span>
      </button>
      {cards.redAttention ||
      cards.diffida ||
      cards.pending.length ||
      cards.review.length ? (
        <span className="sc-warning">
          {cards.redAttention ? "Espulsione da gestire" : ""}
          {cards.redAttention &&
          (cards.diffida || cards.pending.length || cards.review.length)
            ? " · "
            : ""}
          {cards.diffida ? "Diffida" : ""}
          {cards.pending.length
            ? cards.diffida
              ? " · Da scontare"
              : "Da scontare"
            : cards.review.length
              ? cards.diffida
                ? " · Da verificare"
                : "Da verificare"
              : ""}
        </span>
      ) : null}
      <span className="sc-shirt">{player.shirt_number ?? ""}</span>
      <button
        className="sc-player-open"
        aria-label={`Apri scheda di ${player.surname} ${player.name}`}
        onClick={() => runtime.actions.playerSheet(player.id)}
      >
        <ChevronRight size={17} />
      </button>
    </article>
  );
}
export function PlayersPage({ runtime }: { runtime: Runtime }) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [sort, setSort] = useState<"surname" | "role">(
    params.get("sort") === "surname" ? "surname" : "role",
  );
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width:1024px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width:1024px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setQuery(params.get("q") || "");
    setSort(params.get("sort") === "surname" ? "surname" : "role");
  }, [params]);
  const search = useDeferredValue(query).toLocaleLowerCase("it");
  const roleOrder = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
  const compare = (a: Player, b: Player) =>
    a.surname.localeCompare(b.surname, "it") ||
    a.name.localeCompare(b.name, "it");
  const all = runtime.state.players.filter((p) =>
      (p.surname + " " + p.name + " " + p.role)
        .toLocaleLowerCase("it")
        .includes(search),
    ),
    active = all.filter((p) => p.active).sort(compare),
    inactive = all.filter((p) => !p.active).sort(compare);
  const groups = [
    ...roleOrder,
    ...new Set(
      active
        .map((p) => p.role || "Ruolo non indicato")
        .filter((role) => !roleOrder.includes(role)),
    ),
  ];
  const collection = (people: Player[]) =>
    desktop ? (
      <table className="roster-table sc-directory">
        <thead>
          <tr>
            <th scope="col">Giocatore</th>
            <th scope="col">Ruolo</th>
            <th scope="col">Numero</th>
            <th scope="col">Segnalazioni</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const d = runtime.actions.playerDiscipline(p.id);
            return (
              <tr key={p.id}>
                <td>
                  <button onClick={() => runtime.actions.playerSheet(p.id)}>
                    {p.surname} {p.name}
                  </button>
                </td>
                <td>{p.role}</td>
                <td>{p.shirt_number ?? "—"}</td>
                <td>
                  {d.redAttention
                    ? "Espulsione da gestire"
                    : d.pending.length
                      ? "Da scontare"
                      : d.review.length
                        ? "Da verificare"
                        : d.diffida
                          ? "Diffida"
                          : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ) : (
      <div className="sc-directory">
        {people.map((p) => (
          <PlayerRow key={p.id} runtime={runtime} player={p} />
        ))}
      </div>
    );
  return (
    <div className="sc-surface">
      <PageHeading
        title="Rosa"
        description={`${runtime.state.players.filter((p) => p.active).length} giocatori attivi · raggruppati per ruolo o cognome`}
      >
        {canManage(runtime) ? (
          <Button
            onClick={() => runtime.actions.editPlayer()}
            aria-label="Nuovo giocatore"
          >
            <Plus />
            <span className="page-add-label">Nuovo giocatore</span>
          </Button>
        ) : null}
      </PageHeading>
      <label className="sc-search">
        <Search size={20} />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setParams(
              (p) => {
                if (e.target.value) p.set("q", e.target.value);
                else p.delete("q");
                return p;
              },
              { replace: true },
            );
          }}
          placeholder="Cerca un giocatore"
          aria-label="Cerca un giocatore"
        />
      </label>
      <div className="sc-section-heading">
        <h2>Rosa attiva</h2>
        <span>{active.length} giocatori</span>
      </div>
      <label className="sc-roster-sort">
        Ordina per
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as "surname" | "role");
            setParams(
              (p) => {
                p.set("sort", e.target.value);
                return p;
              },
              { replace: true },
            );
          }}
          aria-label="Ordina rosa"
        >
          <option value="role">Ruolo</option>
          <option value="surname">Cognome</option>
        </select>
      </label>
      {sort === "role" && active.length
        ? groups.map((role) => {
            const players = active.filter(
              (p) => (p.role || "Ruolo non indicato") === role,
            );
            return players.length ? (
              <section key={role} className="sc-roster-group">
                <div className="sc-section-heading">
                  <h3>{role}</h3>
                  <span>{players.length}</span>
                </div>
                {collection(players)}
              </section>
            ) : null;
          })
        : collection(active)}
      <div>
        {!active.length ? (
          <div className="sc-empty-state">
            <Search />
            <h3>Nessun giocatore trovato</h3>
            <p>Prova con nome, cognome o ruolo.</p>
          </div>
        ) : null}
      </div>
      {inactive.length ? (
        <details className="inactive-box">
          <summary>Giocatori inattivi ({inactive.length})</summary>
          {collection(inactive)}
        </details>
      ) : null}
    </div>
  );
}
export function ToolsPage({ runtime }: { runtime: Runtime }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    docs = runtime.actions.documentSummary(),
    role = runtime.state.team?.role || "";
  const groups = [
    {
      label: "Squadra",
      tools: [
        {
          page: "players",
          label: "Rosa",
          description: "Giocatori, ruoli e schede personali",
          icon: Users,
        },
        {
          page: "reports",
          label: "Report giocatori e squadra",
          description: "Dati individuali e riepilogo della squadra",
          icon: FileChartColumn,
        },
        {
          action: runtime.actions.discipline,
          label: "Cartellini e diffide",
          description: "Ammonizioni e gare da scontare",
          icon: Flag,
        },
      ],
    },
    {
      label: "Attività",
      tools: [
        {
          page: "whiteboard",
          label: "Lavagna tattica",
          description: "Campo, foto e annotazioni per lo staff tecnico",
          icon: Presentation,
          visible: canTechnicalRole(role),
        },
        {
          page: "register",
          label: "Registro",
          description: "Consulta lo storico delle presenze",
          icon: CalendarDays,
        },
      ],
    },
    {
      label: "Amministrazione",
      tools: [
        {
          action: runtime.actions.expiries,
          label: "Scadenze e tesseramenti",
          description: "Certificati, documenti e tesseramenti",
          icon: ShieldCheck,
          visible: canViewExpiriesRole(role),
          count: docs.review,
        },
        {
          action: runtime.actions.users,
          label: "Gestione utenti",
          description: "Accessi e ruoli dello staff",
          icon: Settings2,
          visible: role === "admin",
        },
        {
          page: "finance",
          label: "Economia",
          description: "Fondi, movimenti, ricevute e rendiconto",
          icon: Wallet,
          visible: canViewFinanceRole(role),
        },
      ],
    },
  ];
  return (
    <div className="sc-surface sc-tools">
      <PageHeading
        title="Altro"
        description="Tutti gli strumenti del tuo club."
      />
      {groups.map((group) => (
        <section className="tool-group" key={group.label}>
          <h2>{group.label}</h2>
          <div className="sc-tool-list">
            {group.tools
              .filter((t) => !("visible" in t) || t.visible !== false)
              .map((t) => {
                const Icon = t.icon,
                  content = (
                    <>
                      <span className="sc-row-icon">
                        <Icon size={20} />
                      </span>
                      <span className="sc-row-copy">
                        <strong>{t.label}</strong>
                        <small>{t.description}</small>
                      </span>
                      {"count" in t && t.count ? (
                        <span className="badge tone-warning">
                          {t.count}
                          <span className="sr-only"> da verificare</span>
                        </span>
                      ) : null}
                      <ChevronRight size={20} className="sc-chevron" />
                    </>
                  );
                return "page" in t ? (
                  <NavLink
                    key={t.label}
                    className="sc-list-row"
                    to={"/" + t.page}
                  >
                    {content}
                  </NavLink>
                ) : (
                  <button
                    key={t.label}
                    className="sc-list-row"
                    onClick={t.action}
                  >
                    {content}
                  </button>
                );
              })}
          </div>
        </section>
      ))}
      <footer className="tools-footer">
        <button
          className="danger"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await runtime.actions.logout();
            } catch {
              setError("Uscita non riuscita. Riprova.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={20} />
          Esci
        </button>
        <small>Eburum · Versione 2026.10</small>
      </footer>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
