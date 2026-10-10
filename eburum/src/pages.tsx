import {
  useDeferredValue,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NavLink } from "react-router-dom";
import {
  Plus,
  ChevronRight,
  FileText,
  MessageSquare,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  Users,
  CircleAlert,
  RotateCcw,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import type { Runtime, Page, Activity, Player } from "./types";
const date = (value: string) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
const canOperate = (runtime: Runtime) =>
  ["admin", "manager", "coach"].includes(runtime.state.team?.role || "");
const canManage = (runtime: Runtime) =>
  ["admin", "manager", "secretary"].includes(runtime.state.team?.role || "");
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
    <div className="page-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

// These protected, tested editors have one isolated DOM boundary each. They
// cannot write to React's app root; binding happens after each explicit render.
export function FeatureSurface({
  runtime,
  page,
  revision,
}: {
  runtime: Runtime;
  page: Page;
  revision: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = host.current!;
    root.innerHTML = runtime.featureHtml(page);
    runtime.bindFeature(page, root);
    return () => root.replaceChildren();
  }, [runtime, page, revision]);
  return <div ref={host} className="domain-surface" />;
}
function ActivityRow({
  runtime,
  activity,
}: {
  runtime: Runtime;
  activity: Activity;
}) {
  const rows = runtime.state.roster.filter(
      (r) => r.activity_id === activity.id,
    ),
    people = runtime.state.players.filter(
      (p) => p.active || rows.some((r) => r.player_id === p.id),
    );
  const replies = rows.filter((r) => r.availability !== "In attesa").length;
  const summary =
    activity.activity_type === "Allenamento"
      ? activity.session_id
        ? "Presenze confermate"
        : `${replies} risposte registrate · ${people.filter((p) => !rows.some((r) => r.player_id === p.id && r.availability !== "In attesa")).length} da sollecitare`
      : "Appuntamento staff";
  const d = new Date(activity.activity_date + "T12:00:00");
  return (
    <button
      className="activity-card native-activity"
      data-open-activity={activity.id}
      onClick={() => void runtime.actions.openActivity(activity.id)}
    >
      <span className="activity-date">
        <b>{d.getDate()}</b>
        <small>
          {new Intl.DateTimeFormat("it-IT", { month: "short" }).format(d)}
        </small>
      </span>
      <span className="activity-main">
        <strong>{activity.title}</strong>
        <span className="activity-type">{activity.status}</span>
        <span>
          {activity.start_time?.slice(0, 5) || "Orario da definire"}
          {activity.location ? " · " + activity.location : ""}
        </span>
        <small>{summary}</small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
export function TrainingPage({
  runtime,
  revision: _revision,
}: {
  runtime: Runtime;
  revision: number;
}) {
  const [query, setQuery] = useState(""),
    [scope, setScope] = useState("upcoming");
  const search = useDeferredValue(query).toLocaleLowerCase("it");
  const rows = runtime.state.activities
    .filter(
      (a) =>
        a.activity_type === "Allenamento" &&
        (scope === "all" || a.status === "Programmato") &&
        `${a.title} ${a.location || ""}`
          .toLocaleLowerCase("it")
          .includes(search),
    )
    .sort((a, b) =>
      scope === "all"
        ? b.activity_date.localeCompare(a.activity_date)
        : a.activity_date.localeCompare(b.activity_date),
    );
  return (
    <>
      <PageHeading
        title="Allenamenti"
        description="Risposte WhatsApp prima. Presenze effettive dopo."
      >
        {canOperate(runtime) ? (
          <Button onClick={runtime.actions.newTraining}>
            <Plus />
            Allenamento
          </Button>
        ) : null}
      </PageHeading>
      {canOperate(runtime) && runtime.actions.hasAttendanceDraft() ? (
        <Button
          variant="secondary"
          onClick={runtime.actions.resumeAttendance}
          className="mb-5"
        >
          <RotateCcw />
          Riprendi la bozza presenze
        </Button>
      ) : null}
      <div className="page-controls">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Cerca allenamento"
          placeholder="Cerca allenamento o campo"
        />
        <div
          className="segmented"
          role="group"
          aria-label="Periodo allenamenti"
        >
          {[
            ["upcoming", "In programma"],
            ["all", "Tutti"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={scope === key}
              onClick={() => setScope(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="list" id="trainingHubList">
        {rows.length ? (
          rows.map((a) => (
            <ActivityRow key={a.id} runtime={runtime} activity={a} />
          ))
        ) : (
          <p className="empty">
            Nessun allenamento corrisponde ai filtri. Consulta Tutti o programma
            il prossimo.
          </p>
        )}
      </div>
    </>
  );
}
export function MeetingsPage({ runtime }: { runtime: Runtime }) {
  const rows = runtime.state.activities
    .filter((a) => a.activity_type === "Riunione")
    .sort((a, b) => b.activity_date.localeCompare(a.activity_date));
  return (
    <>
      <PageHeading
        title="Riunioni"
        description="Appuntamenti e indicazioni per lo staff."
      >
        {canOperate(runtime) ? (
          <Button onClick={runtime.actions.newMeeting}>
            <Plus />
            Riunione
          </Button>
        ) : null}
      </PageHeading>
      <div className="list">
        {rows.length ? (
          rows.map((a) => (
            <ActivityRow key={a.id} runtime={runtime} activity={a} />
          ))
        ) : (
          <p className="empty">Nessuna riunione programmata.</p>
        )}
      </div>
    </>
  );
}
export function MatchesPage({ runtime }: { runtime: Runtime }) {
  return (
    <>
      <PageHeading
        title="Partite"
        description="Convocati, risultati ed eventi dal campo."
      >
        {canOperate(runtime) ? (
          <Button onClick={runtime.actions.newMatch}>
            <Plus />
            Partita
          </Button>
        ) : null}
      </PageHeading>
      <Button
        variant="secondary"
        className="mb-5"
        onClick={runtime.actions.discipline}
      >
        <ShieldCheck />
        Cartellini e diffide
      </Button>
      <div className="match-list">
        {runtime.state.matches.length ? (
          runtime.state.matches.map((match) => (
            <article className="card match-card" key={match.id}>
              <div className="match-meta">
                <span>{date(match.match_date)}</span>
                <span className="badge b-blue">{match.venue}</span>
              </div>
              <div className="match-heading">
                <h3>
                  Eburum <span>–</span> {match.opponent}
                </h3>
                <strong className="match-score" aria-label="Risultato">
                  {match.goals_for != null && match.goals_against != null
                    ? `${match.goals_for} : ${match.goals_against}`
                    : "– : –"}
                </strong>
              </div>
              {match.note ? (
                <p className="match-note-preview">{match.note}</p>
              ) : null}
              <div className="match-card-footer">
                <span className="row-sub">
                  {match.minutes_auto
                    ? "Minuti automatici"
                    : "Minuti registrati dallo staff"}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => runtime.actions.openMatch(match)}
                >
                  {canOperate(runtime)
                    ? "Gestisci partita"
                    : "Consulta partita"}
                  <ChevronRight />
                </Button>
              </div>
            </article>
          ))
        ) : (
          <p className="empty">
            Nessuna partita. Aggiungi la prossima gara per registrare eventi e
            note.
          </p>
        )}
      </div>
    </>
  );
}
function PlayerRow({ runtime, player }: { runtime: Runtime; player: Player }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cards = runtime.actions.playerDiscipline(player.id);
  return (
    <article className="row native-player">
      <div className="row-main">
        <b className="row-title">
          {player.surname} {player.name}
        </b>
        <p className="row-sub">
          {player.shirt_number ? "#" + player.shirt_number + " · " : ""}
          {player.phone || "Nessun telefono"}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>
      <div className="toolbar">
        {cards.total || cards.review.length ? (
          <span
            className={
              "badge " +
              (cards.pending.length || cards.review.length
                ? "b-red"
                : cards.diffida
                  ? "b-yellow"
                  : "b-gray")
            }
          >
            {cards.total} gialli{cards.diffida ? " · Diffida" : ""}
            {cards.pending.length
              ? " · Da scontare"
              : cards.review.length
                ? " · Da verificare"
                : ""}
          </span>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => runtime.actions.playerSheet(player.id)}
        >
          Scheda
        </Button>
        {canManage(runtime) ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runtime.actions.editPlayer(player)}
            >
              Modifica
            </Button>
            <Button
              variant={player.active ? "destructive" : "secondary"}
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (
                  player.active &&
                  !confirm(
                    `Rimuovere ${player.surname} ${player.name} dalla rosa attiva? Lo storico resterà disponibile.`,
                  )
                )
                  return;
                setBusy(true);
                setError("");
                try {
                  await runtime.actions.setPlayerActive(player, !player.active);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Modifica non riuscita. Riprova.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Salvataggio…" : player.active ? "Rimuovi" : "Riattiva"}
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
export function PlayersPage({ runtime }: { runtime: Runtime }) {
  const [query, setQuery] = useState(""),
    search = useDeferredValue(query).toLocaleLowerCase("it");
  const filtered = runtime.state.players.filter((p) =>
      `${p.surname} ${p.name} ${p.role}`
        .toLocaleLowerCase("it")
        .includes(search),
    ),
    roles = ["Portiere", "Difensore", "Centrocampista", "Attaccante"],
    inactive = filtered.filter((p) => !p.active);
  return (
    <>
      <PageHeading
        title="Rosa"
        description="Schede dei giocatori e gestione della squadra."
      >
        {canManage(runtime) ? (
          <Button onClick={() => runtime.actions.editPlayer()}>
            <Plus />
            Giocatore
          </Button>
        ) : null}
      </PageHeading>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Cerca giocatore"
        placeholder="Nome, cognome o ruolo"
        className="mb-6"
      />
      {roles.map((role) => {
        const players = filtered
          .filter((p) => p.active && p.role === role)
          .sort(
            (a, b) =>
              (a.role_order || 9999) - (b.role_order || 9999) ||
              a.surname.localeCompare(b.surname, "it"),
          );
        return players.length ? (
          <section className="role-group" key={role}>
            <div className="role-head">
              <h3>{role}</h3>
              <span className="badge b-gray">{players.length}</span>
            </div>
            <div className="list">
              {players.map((p) => (
                <PlayerRow key={p.id} runtime={runtime} player={p} />
              ))}
            </div>
          </section>
        ) : null;
      })}
      {inactive.length ? (
        <details className="inactive-box">
          <summary>Giocatori inattivi ({inactive.length})</summary>
          <div className="list mt-4">
            {inactive.map((p) => (
              <PlayerRow key={p.id} runtime={runtime} player={p} />
            ))}
          </div>
        </details>
      ) : null}
      {!filtered.length ? (
        <p className="empty">Nessun giocatore corrisponde alla ricerca.</p>
      ) : null}
    </>
  );
}
export function ToolsPage({ runtime }: { runtime: Runtime }) {
  const links = [
    {
      page: "communications",
      label: "Comunicazioni",
      description: "Messaggi condivisi e scadenza automatica",
      icon: MessageSquare,
    },
    {
      page: "reports",
      label: "Report e statistiche",
      description: "Schede individuali, grafici e PDF",
      icon: FileText,
    },
    {
      page: "register",
      label: "Registro",
      description: "Consulta le presenze e lo storico delle correzioni",
      icon: ClipboardList,
    },
    {
      page: "meetings",
      label: "Riunioni",
      description: "Appuntamenti e note dello staff",
      icon: CalendarDays,
    },
  ] as const;
  return (
    <>
      <PageHeading
        title="Strumenti squadra"
        description="Le funzioni di supporto al lavoro dello staff."
      />
      <div className="native-tool-list">
        {links.map(({ page, label, description, icon: Icon }) => (
          <NavLink key={page} to={"/" + page}>
            <Icon size={22} />
            <span>
              <b>{label}</b>
              <small>{description}</small>
            </span>
            <ChevronRight size={18} />
          </NavLink>
        ))}
        <button onClick={runtime.actions.discipline}>
          <ShieldCheck size={22} />
          <span>
            <b>Cartellini e diffide</b>
            <small>Soglie, squalifiche e gare scontate</small>
          </span>
          <ChevronRight size={18} />
        </button>
        {canManage(runtime) ? (
          <button onClick={runtime.actions.expiries}>
            <CircleAlert size={22} />
            <span>
              <b>Scadenze e tesseramenti</b>
              <small>Certificati e documenti da verificare</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ) : null}
        {runtime.state.team?.role === "admin" ? (
          <button onClick={runtime.actions.users}>
            <Users size={22} />
            <span>
              <b>Gestione staff</b>
              <small>Utenze e ruoli della squadra condivisa</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ) : null}
      </div>
    </>
  );
}
