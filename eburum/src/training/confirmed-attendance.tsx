import { useState } from "react";
import type { Runtime } from "../types";

const groups = [
  {
    status: "Presente",
    label: "Presenti",
    empty: "Nessun presente registrato.",
  },
  { status: "Assente", label: "Assenti", empty: "Nessun assente registrato." },
  {
    status: "Infortunato",
    label: "Infortunati",
    empty: "Nessun infortunato registrato.",
  },
];

export function ConfirmedAttendance({
  runtime,
  sessionId,
}: {
  runtime: Runtime;
  sessionId: string;
}) {
  const rows = runtime.state.attendance.filter(
    (row) => row.session_id === sessionId,
  );
  const [selected, setSelected] = useState(() =>
    rows.some((row) => row.status === "Assente") ? "Assente" : "Presente",
  );
  const group = groups.find((group) => group.status === selected)!;
  const people = rows
    .filter((row) => row.status === selected)
    .map((row) => {
      const player = runtime.state.players.find(
        (player) => player.id === row.player_id,
      );
      return {
        id: row.player_id,
        name: player
          ? `${player.surname} ${player.name}`
          : "Giocatore archiviato",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  return (
    <div className="training-confirmed-summary">
      <div
        className="segmented training-confirmed-filters"
        role="group"
        aria-label="Filtra presenze confermate"
      >
        {groups.map((group) => (
          <button
            key={group.status}
            type="button"
            aria-label={`${group.label}: ${rows.filter((row) => row.status === group.status).length}`}
            aria-pressed={selected === group.status}
            onClick={() => setSelected(group.status)}
          >
            <b>{rows.filter((row) => row.status === group.status).length}</b>
            <span>{group.label}</span>
          </button>
        ))}
      </div>
      <section
        className="training-attendance-people"
        aria-label={group.label}
        aria-live="polite"
      >
        <h4>
          {group.label}
          <span>{people.length}</span>
        </h4>
        {people.length ? (
          <ul className="training-attendance-names">
            {people.map((person) => (
              <li key={person.id}>{person.name}</li>
            ))}
          </ul>
        ) : (
          <p className="training-attendance-empty">{group.empty}</p>
        )}
      </section>
    </div>
  );
}
