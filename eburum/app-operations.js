import {fmt} from './app-part1.js';import {activityLabel,clock} from './app-team.js';

function callupMessage(a, rows, players) {
  const called = players.filter((p) =>
    rows.some((r) => r.player_id === p.id && r.called),
  );
  return [
    `CONVOCAZIONE EBURUM · ${a.activity_type}`,
    activityLabel(a),
    `Data: ${fmt(a.activity_date)}`,
    `Inizio: ${clock(a.start_time)}`,
    `Campo / luogo: ${a.location || "Da definire"}`,
    `Ritrovo: ${clock(a.meeting_time)} · ${a.meeting_place || "Luogo da definire"}`,
    `Convocati (${called.length}):`,
    ...called.map((p) => `• ${p.surname} ${p.name}`),
    a.organization_note
      ? `Indicazioni (divisa, materiale, trasporto):\n${a.organization_note}`
      : "Indicazioni sulla divisa e sul materiale: da definire",
  ].join("\n");
}


export { callupMessage };
