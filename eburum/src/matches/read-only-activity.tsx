import { matchTitle } from "../../app-match-display.js";
import { fmt } from "../../app-part1.js";
import { eventTone } from "../../app-part4.js";
import { Button } from "../components/ui/button";
import { EditorFrame } from "../operational-ui";
import type { Activity, Runtime } from "../types";
import { ui, type Surface } from "../ui-service";

export function ReadOnlyActivity({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { activity: a } = surface.data as { activity: Partial<Activity> },
    m = runtime.state.matches.find((m) => m.id === a.match_id),
    rows = runtime.state.roster.filter(
      (r) =>
        r.activity_id === a.id && (a.activity_type !== "Partita" || r.called),
    ),
    events = runtime.state.events.filter((e) => e.match_id === a.match_id);
  return (
    <EditorFrame
      surface={surface}
      titleId="readonlyActivityTitle"
      title={m ? matchTitle(m) : a.title || "Attività"}
      closeLabel="Chiudi attività"
    >
      <p className="notice">
        Consultazione · Il tuo ruolo può leggere queste informazioni. Le
        modifiche sportive spettano allo staff autorizzato.
      </p>
      <p>
        {fmt(a.activity_date || "")} ·{" "}
        {a.start_time?.slice(0, 5) || "Orario da definire"} · {a.status}
      </p>
      <p>{a.location || "Luogo da definire"}</p>
      {a.organization_note ? <p>{a.organization_note}</p> : null}
      {m ? (
        <>
          <h3>Risultato</h3>
          <p>
            {m.goals_for == null || m.goals_against == null
              ? "Da registrare"
              : `${m.goals_for} : ${m.goals_against}`}
          </p>
          <Button
            className="match-report-trigger"
            variant="secondary"
            onClick={() =>
              ui.open("match-report", {
                match: m,
                activity: a,
                roster: rows,
                events,
                players: runtime.state.players,
              })
            }
          >
            Esporta tabellino
          </Button>
        </>
      ) : null}
      <h3>{m ? "Convocati" : "Disponibilità registrate"}</h3>
      {rows.map((row) => (
        <article className="row" key={row.player_id}>
          <b>
            {runtime.state.players.find((p) => p.id === row.player_id)?.surname}{" "}
            {runtime.state.players.find((p) => p.id === row.player_id)?.name}
          </b>
          <small>
            {m
              ? `${row.lineup} · ${row.minutes_played} min`
              : row.availability === "Disponibile"
                ? "WhatsApp: Sì"
                : row.availability === "Indisponibile"
                  ? "WhatsApp: No"
                  : "WhatsApp: Non risposto"}
          </small>
        </article>
      ))}
      {events.map((e) => (
        <article className="row" key={e.id}>
          <span className={`badge ${eventTone(e)}`}>
            {e.event_type === "Gol" && !e.player_id
              ? "Gol avversario"
              : e.event_type}
          </span>
          <span>{e.minute == null ? "—" : `${e.minute}′`}</span>
          <p>
            {e.event_type === "Gol" && !e.player_id
              ? "Squadra avversaria"
              : runtime.state.players.find((p) => p.id === e.player_id)
                  ?.surname || "Giocatore storico"}
          </p>
          {e.detail ? <small>{e.detail}</small> : null}
        </article>
      ))}
    </EditorFrame>
  );
}
