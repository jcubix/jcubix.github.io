import {
  db,
  fetchAllRows,
  state,
  teamRole,
  teamOwner,
  today,
} from "./app-part1.js";
import type {
  TeamState,
  Session,
  Match,
  Activity,
  Player,
  Administration,
  DisciplinaryClearance,
  Communication,
} from "./src/types";

type QueryResult<Row> = { data: Row[] | null; error: unknown };
type ChildTables = {
  attendance: TeamState["attendance"][number];
  match_events: TeamState["events"][number];
  activity_roster: TeamState["roster"][number];
  activity_technical: TeamState["technical"][number];
  communication_receipts: TeamState["communication_receipts"][number];
};
export type SportSnapshot = Pick<
  TeamState,
  | "sessions"
  | "matches"
  | "activities"
  | "attendance"
  | "events"
  | "roster"
  | "technical"
>;
type DismissalSnapshot = Pick<
  TeamState,
  "dismissals" | "dismissal_sanctions" | "dismissal_clearances"
>;

const DATE_TABLES = [
  ["sessions", "session_date"],
  ["matches", "match_date"],
  ["activities", "activity_date"],
] as const;

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

async function rowsOrThrow<Row>(
  build: () => {
    range: (from: number, to: number) => PromiseLike<QueryResult<Row>>;
  },
): Promise<Row[]> {
  const result = await fetchAllRows(build);
  if (result.error) throw result.error;
  return result.data || [];
}

function parentRows<Row>(
  table: (typeof DATE_TABLES)[number][0],
  date: (typeof DATE_TABLES)[number][1],
  from: string,
  to: string,
  owner: string,
) {
  return rowsOrThrow<Row>(() =>
    db
      .from(table)
      .select("*")
      .eq("user_id", owner)
      .gte(date, from)
      .lte(date, to)
      .order("id"),
  );
}

async function childRows<Table extends keyof ChildTables>(
  table: Table,
  column: string,
  ids: string[],
  owner: string,
  player: string | null = null,
): Promise<ChildTables[Table][]> {
  const unique = [...new Set(ids)],
    data: ChildTables[Table][] = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100);
    data.push(
      ...(await rowsOrThrow<ChildTables[Table]>(() => {
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
  from: string,
  to: string,
  owner: string,
  player: string | null = null,
  withTechnical = false,
): Promise<SportSnapshot> {
  const [sessions, matches, activities] = await Promise.all([
    parentRows<Session>("sessions", "session_date", from, to, owner),
    parentRows<Match>("matches", "match_date", from, to, owner),
    parentRows<Activity>("activities", "activity_date", from, to, owner),
  ]);
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

async function earliestSportDate(owner: string = teamOwner()): Promise<string> {
  const results: QueryResult<Record<string, string>>[] = await Promise.all(
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

export type DataChange =
  | { kind: "players" }
  | { kind: "administration" }
  | { kind: "discipline" }
  | { kind: "activity"; id: string }
  | { kind: "match"; id: string }
  | { kind: "session"; id: string; activityId?: string };

async function loadAdministration(owner: string): Promise<Administration[]> {
  if (teamRole() === "president") {
    const result = await db.rpc("team_administration_summary");
    if (result.error) throw result.error;
    return result.data || [];
  }
  return rowsOrThrow<Administration>(() =>
    db
      .from("player_administration")
      .select("*")
      .eq("user_id", owner)
      .order("player_id"),
  );
}

async function loadClearances(owner: string) {
  return rowsOrThrow<DisciplinaryClearance>(() =>
    db
      .from("disciplinary_clearances")
      .select("*")
      .eq("user_id", owner)
      .eq("season_start", sportSeason().from)
      .order("id"),
  );
}

async function parentIds<Row>(
  table: (typeof DATE_TABLES)[number][0],
  ids: string[],
  owner: string,
): Promise<Row[]> {
  if (!ids.length) return [];
  return rowsOrThrow<Row>(() =>
    db.from(table).select("*").eq("user_id", owner).in("id", ids).order("id"),
  );
}

// Build a complete patch before touching state: failed reads never publish half a save.
async function loadAffectedData(
  change: DataChange,
  owner: string,
): Promise<Partial<TeamState>> {
  if (change.kind === "players")
    return {
      players: await rowsOrThrow<Player>(() =>
        db.from("players").select("*").eq("user_id", owner).order("id"),
      ),
    };
  if (change.kind === "administration")
    return { administration: await loadAdministration(owner) };
  if (change.kind === "discipline") {
    const [disciplinary_clearances, dismissals] = await Promise.all([
      loadClearances(owner),
      loadDismissalSnapshot(),
    ]);
    return { disciplinary_clearances, ...dismissals };
  }
  const previous = state.activities.filter((a) =>
    change.kind === "activity"
      ? a.id === change.id
      : change.kind === "match"
        ? a.match_id === change.id
        : a.session_id === change.id || a.id === change.activityId,
  );
  let activities = await rowsOrThrow<Activity>(() =>
    db
      .from("activities")
      .select("*")
      .eq("user_id", owner)
      .eq(
        change.kind === "activity"
          ? "id"
          : change.kind === "match"
            ? "match_id"
            : "session_id",
        change.id,
      )
      .order("id"),
  );
  if (change.kind === "session") {
    const detached = await parentIds<Activity>(
      "activities",
      previous
        .filter((a) => !activities.some((row) => row.id === a.id))
        .map((a) => a.id),
      owner,
    );
    activities = [...activities, ...detached];
    if (
      change.activityId &&
      !activities.some((a) => a.id === change.activityId)
    )
      activities.push(
        ...(await parentIds<Activity>(
          "activities",
          [change.activityId],
          owner,
        )),
      );
  }
  const allActivities = [...previous, ...activities],
    activityIds = [...new Set(allActivities.map((a) => a.id))],
    sessionIds = [
      ...new Set([
        ...(change.kind === "session" ? [change.id] : []),
        ...allActivities.flatMap((a) => (a.session_id ? [a.session_id] : [])),
      ]),
    ],
    matchIds = [
      ...new Set([
        ...(change.kind === "match" ? [change.id] : []),
        ...allActivities.flatMap((a) => (a.match_id ? [a.match_id] : [])),
      ]),
    ];
  const [sessions, matches, attendance, events, roster, technical, dismissals] =
    await Promise.all([
      parentIds<Session>("sessions", sessionIds, owner),
      parentIds<Match>("matches", matchIds, owner),
      childRows("attendance", "session_id", sessionIds, owner),
      childRows("match_events", "match_id", matchIds, owner),
      childRows("activity_roster", "activity_id", activityIds, owner),
      childRows("activity_technical", "activity_id", activityIds, owner),
      matchIds.length ? loadDismissalSnapshot() : Promise.resolve({}),
    ]);
  const datesChanged = (
    before: { id: string; date: string }[],
    after: { id: string; date: string }[],
  ) =>
    before.length !== after.length ||
    after.some(
      (row) =>
        !before.some((old) => old.id === row.id && old.date === row.date),
    );
  const changed =
    datesChanged(
      previous.map((a) => ({ id: a.id, date: a.activity_date })),
      activities.map((a) => ({ id: a.id, date: a.activity_date })),
    ) ||
    datesChanged(
      state.sessions
        .filter((s) => sessionIds.includes(s.id))
        .map((s) => ({ id: s.id, date: s.session_date })),
      sessions.map((s) => ({ id: s.id, date: s.session_date })),
    ) ||
    datesChanged(
      state.matches
        .filter((m) => matchIds.includes(m.id))
        .map((m) => ({ id: m.id, date: m.match_date })),
      matches.map((m) => ({ id: m.id, date: m.match_date })),
    );
  const removedMatch = state.matches.some(
    (m) => matchIds.includes(m.id) && !matches.some((row) => row.id === m.id),
  );
  const [earliest, clearances] = await Promise.all([
    changed ? earliestSportDate(owner) : Promise.resolve(state.earliestSport),
    removedMatch ? loadClearances(owner) : Promise.resolve(null),
  ]);
  const season = sportSeason(),
    inSeason = (date: string) => date >= season.from && date <= season.to;
  const keptActivities = activities.filter((a) => inSeason(a.activity_date)),
    keptSessions = sessions.filter((s) => inSeason(s.session_date)),
    keptMatches = matches.filter((m) => inSeason(m.match_date));
  return {
    ...dismissals,
    ...(clearances ? { disciplinary_clearances: clearances } : {}),
    activities: state.activities
      .filter((a) => !activityIds.includes(a.id))
      .concat(keptActivities),
    sessions: state.sessions
      .filter((s) => !sessionIds.includes(s.id))
      .concat(keptSessions)
      .sort((a, b) => b.session_date.localeCompare(a.session_date)),
    matches: state.matches
      .filter((m) => !matchIds.includes(m.id))
      .concat(keptMatches)
      .sort((a, b) => b.match_date.localeCompare(a.match_date)),
    attendance: state.attendance
      .filter((r) => !sessionIds.includes(r.session_id || ""))
      .concat(
        attendance.filter((r) =>
          keptSessions.some((s) => s.id === r.session_id),
        ),
      ),
    events: state.events
      .filter((e) => !matchIds.includes(e.match_id))
      .concat(
        events.filter((e) => keptMatches.some((m) => m.id === e.match_id)),
      ),
    roster: state.roster
      .filter((r) => !activityIds.includes(r.activity_id))
      .concat(
        roster.filter((r) =>
          keptActivities.some((a) => a.id === r.activity_id),
        ),
      ),
    technical: state.technical
      .filter((t) => !activityIds.includes(t.activity_id || ""))
      .concat(
        technical.filter((t) =>
          keptActivities.some((a) => a.id === t.activity_id),
        ),
      ),
    earliestSport: earliest,
  };
}

async function loadTeamData(
  owner: string,
): Promise<
  SportSnapshot &
    DismissalSnapshot &
    Pick<
      TeamState,
      | "players"
      | "administration"
      | "disciplinary_clearances"
      | "staff_communications"
      | "communication_receipts"
      | "dataRange"
      | "earliestSport"
    >
> {
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
    rowsOrThrow<Player>(() =>
      db.from("players").select("*").eq("user_id", owner).order("id"),
    ),
    loadAdministration(owner),
    loadClearances(owner),
    rowsOrThrow<Communication>(() =>
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

async function loadDismissalSnapshot(): Promise<DismissalSnapshot> {
  const { data, error } = await db.rpc("disciplinary_dismissal_snapshot");
  if (error) throw error;
  return {
    dismissals: data?.dismissals || [],
    dismissal_sanctions: data?.dismissal_sanctions || [],
    dismissal_clearances: data?.dismissal_clearances || [],
  };
}

export {
  DATE_TABLES,
  sportSeason,
  rowsOrThrow,
  childRows,
  loadSportPeriod,
  earliestSportDate,
  loadTeamData,
  loadAffectedData,
  loadDismissalSnapshot,
};
