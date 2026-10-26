import {state} from './app-part1.js';

/** @param {string} from
 * @param {string} to
 * @param {string|null} player
 * @param {Pick<import('./src/types').TeamState,'sessions'|'attendance'|'activities'|'roster'|'matches'|'events'>} snapshot */
function reportData(from, to, player = null, snapshot = state) {
  const sessions = snapshot.sessions.filter(
      (s) => s.session_date >= from && s.session_date <= to,
    ),
    sessionIds = new Set(sessions.map((s) => s.id)),
    attendance = snapshot.attendance.filter(
      (r) =>
        sessionIds.has(r.session_id) && (!player || r.player_id === player),
    );
  const activities = (snapshot.activities || []).filter(
      (a) =>
        a.activity_date >= from &&
        a.activity_date <= to &&
        a.status !== "Annullato",
    ),
    activityIds = new Set(activities.map((a) => a.id)),
    roster = (snapshot.roster || []).filter(
      (r) =>
        activityIds.has(r.activity_id) && (!player || r.player_id === player),
    );
  const matches = snapshot.matches.filter(
      (m) =>
        m.match_date >= from &&
        m.match_date <= to &&
        !(snapshot.activities || []).some(
          (a) => a.match_id === m.id && a.status === "Annullato",
        ),
    ),
    matchIds = new Set(matches.map((m) => m.id)),
    events = snapshot.events.filter(
      (e) =>
        matchIds.has(e.match_id) &&
        (!player || e.player_id === player || e.outgoing_player_id === player),
    );
  const availability = activities.flatMap((a) =>
    state.players
      .filter(
        (p) =>
          p.active ||
          roster.some((r) => r.player_id === p.id && r.activity_id === a.id),
      )
      .map((p) => ({
        player: p,
        row: roster.find(
          (r) => r.activity_id === a.id && r.player_id === p.id,
        ) || { player_id: p.id, availability: "In attesa", called: false },
      }))
      .filter((x) => !player || x.player.id === player)
      .map((x) => ({ activity: a, ...x })),
  );
  return {
    from,
    to,
    player,
    sessions,
    attendance,
    activities,
    roster,
    matches,
    events,
    availability,
  };
}


export { reportData };
