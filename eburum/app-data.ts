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
    teamRole() === "president"
      ? db.rpc("team_administration_summary").then((r) => {
          if (r.error) throw r.error;
          return r.data || [];
        })
      : rowsOrThrow<Administration>(() =>
          db
            .from("player_administration")
            .select("*")
            .eq("user_id", owner)
            .order("player_id"),
        ),
    rowsOrThrow<DisciplinaryClearance>(() =>
      db
        .from("disciplinary_clearances")
        .select("*")
        .eq("user_id", owner)
        .eq("season_start", season.from)
        .order("id"),
    ),
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
  loadDismissalSnapshot,
};
