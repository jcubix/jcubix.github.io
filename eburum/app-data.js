import { db, fetchAllRows, state, teamRole, teamOwner, today } from './app-part1.js';

const DATE_TABLES = [
  ["sessions", "session_date"],
  ["matches", "match_date"],
  ["activities", "activity_date"],
];

function sportSeason() {
  const year =
    state.seasonYear ||
    Number(String(window.CONFIG.season).match(/20\d{2}/)?.[0]) ||
    Number(today().slice(0, 4));
  return {
    year,
    key: `${year}/${year + 1}`,
    from: `${year}-07-01`,
    to: `${year + 1}-06-30`,
  };
}

async function rowsOrThrow(build) {
  const result = await fetchAllRows(build);
  if (result.error) throw result.error;
  return result.data || [];
}

async function childRows(table, column, ids, owner, player = null) {
  const unique = [...new Set(ids)],
    data = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100);
    data.push(
      ...(await rowsOrThrow(() => {
        let q = db
          .from(table)
          .select("*")
          .eq("user_id", owner)
          .in(column, batch)
          .order(
            table === "activity_technical"
              ? "activity_id"
              : table === "communication_receipts"
                ? "reader_id"
                : "id",
          );
        if (player) q = q.eq("player_id", player);
        return q;
      })),
    );
  }
  return data;
}

async function loadSportPeriod(
  from,
  to,
  owner,
  player = null,
  withTechnical = false,
) {
  const parents = await Promise.all(
    DATE_TABLES.map(([table, date]) =>
      rowsOrThrow(() =>
        db
          .from(table)
          .select("*")
          .eq("user_id", owner)
          .gte(date, from)
          .lte(date, to)
          .order("id"),
      ),
    ),
  );
  const [sessions, matches, activities] = parents;
  const [attendance, events, roster, technical] = await Promise.all([
    childRows(
      "attendance",
      "session_id",
      sessions.map((s) => s.id),
      owner,
      player,
    ),
    childRows(
      "match_events",
      "match_id",
      matches.map((m) => m.id),
      owner,
    ),
    childRows(
      "activity_roster",
      "activity_id",
      activities.map((a) => a.id),
      owner,
      player,
    ),
    withTechnical
      ? childRows(
          "activity_technical",
          "activity_id",
          activities.map((a) => a.id),
          owner,
        )
      : Promise.resolve([]),
  ]);
  sessions.sort((a, b) => b.session_date.localeCompare(a.session_date));
  matches.sort((a, b) => b.match_date.localeCompare(a.match_date));
  return {
    sessions,
    matches,
    activities,
    attendance,
    events,
    roster,
    technical,
  };
}

async function earliestSportDate(owner = teamOwner()) {
  const results = await Promise.all(
    DATE_TABLES.map(([table, date]) =>
      db.from(table).select(date).eq("user_id", owner).order(date).limit(1),
    ),
  );
  for (const r of results) if (r.error) throw r.error;
  return (
    results
      .flatMap((r, i) => (r.data || []).map((x) => x[DATE_TABLES[i][1]]))
      .sort()[0] || today()
  );
}

async function loadTeamData(owner) {
  const season = sportSeason();
  const [
    sport,
    players,
    administration,
    disciplinary_clearances,
    staff_communications,
    earliest,
    dismissals,
  ] = await Promise.all([
    loadSportPeriod(season.from, season.to, owner, null, true),
    rowsOrThrow(() =>
      db.from("players").select("*").eq("user_id", owner).order("id"),
    ),
    teamRole() === "president"
      ? db.rpc("team_administration_summary").then((r) => {
          if (r.error) throw r.error;
          return r.data || [];
        })
      : rowsOrThrow(() =>
          db
            .from("player_administration")
            .select("*")
            .eq("user_id", owner)
            .order("player_id"),
        ),
    rowsOrThrow(() =>
      db
        .from("disciplinary_clearances")
        .select("*")
        .eq("user_id", owner)
        .eq("season_start", season.from)
        .order("id"),
    ),
    rowsOrThrow(() =>
      db
        .from("staff_communications")
        .select("*")
        .eq("user_id", owner)
        .gt("expires_at", new Date().toISOString())
        .order("id"),
    ),
    earliestSportDate(owner),
    loadDismissalSnapshot(),
  ]);
  const communication_receipts = await childRows(
    "communication_receipts",
    "communication_id",
    staff_communications.filter((m) => m.requires_ack).map((m) => m.id),
    owner,
  );
  return {
    ...sport,
    ...dismissals,
    players,
    administration,
    disciplinary_clearances,
    staff_communications,
    communication_receipts,
    dataRange: season,
    earliestSport: earliest,
  };
}

async function loadDismissalSnapshot() {
  const { data, error } = await db.rpc("disciplinary_dismissal_snapshot");
  if (error) throw error;
  return {
    dismissals: data?.dismissals || [],
    dismissal_sanctions: data?.dismissal_sanctions || [],
    dismissal_clearances: data?.dismissal_clearances || [],
  };
}


export { DATE_TABLES, sportSeason, rowsOrThrow, childRows, loadSportPeriod, earliestSportDate, loadTeamData, loadDismissalSnapshot };
