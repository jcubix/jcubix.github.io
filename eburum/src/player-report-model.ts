import { fmt } from "../app-part1.js";
import { reportData } from "../app-part5.js";
import { newestFirst } from "../app-presentation.js";
import type {
  Activity,
  Attendance,
  Match,
  MatchEvent,
  RosterRow,
  Session,
} from "./types";
export interface ReportItem {
  name: string;
  detail: string;
  match?: Match;
}
export function playerReportDetails(
  data: ReturnType<typeof reportData> | null,
) {
  const sessions = new Map<string, Session>(
      (data?.sessions || []).map((s: Session) => [s.id, s]),
    ),
    activities = new Map<string, Activity>(
      (data?.activities || []).map((a: Activity) => [a.id, a]),
    ),
    matches = new Map<string, Match>(
      (data?.matches || []).map((m: Match) => [m.id, m]),
    );
  const attendance = (data?.attendance || []) as Attendance[],
    present = attendance.filter((r) => r.status === "Presente"),
    absent = attendance.filter((r) => r.status === "Assente"),
    injured = attendance.filter((r) => r.status === "Infortunato");
  const roster = data?.roster || [],
    called = roster.filter(
      (r) =>
        r.called && activities.get(r.activity_id)?.activity_type === "Partita",
    ),
    minutes = roster.filter(
      (r) =>
        r.minutes_played > 0 &&
        activities.get(r.activity_id)?.activity_type === "Partita",
    ),
    goals = (data?.events || []).filter(
      (e) => e.event_type === "Gol" && e.player_id,
    ),
    cards = (data?.events || []).filter(
      (e) =>
        e.player_id && ["Ammonizione", "Espulsione"].includes(e.event_type),
    );
  const attendanceItems = (rows: Attendance[]): ReportItem[] =>
    newestFirst(
      rows,
      (r: Attendance) => sessions.get(r.session_id!)?.session_date,
    ).map((r: Attendance) => ({
      name: `${fmt(sessions.get(r.session_id!)?.session_date || "")} · ${sessions.get(r.session_id!)?.session_type || "Sessione"}`,
      detail: `${r.status}${r.note ? " · " + r.note : ""}`,
    }));
  const drills: Record<
    string,
    { label: string; value: number; items: ReportItem[] }
  > = {
    sessions: {
      label: "Sessioni registrate",
      value: new Set(attendance.map((r) => r.session_id)).size,
      items: attendanceItems(attendance),
    },
    present: {
      label: "Presenze",
      value: present.length,
      items: attendanceItems(present),
    },
    absent: {
      label: "Assenze",
      value: absent.length,
      items: attendanceItems(absent),
    },
    injured: {
      label: "Infortuni",
      value: injured.length,
      items: attendanceItems(injured),
    },
    called: {
      label: "Convocazioni",
      value: called.length,
      items: newestFirst(
        called,
        (r: RosterRow) => activities.get(r.activity_id)?.activity_date,
      ).map((r) => ({
        name: `${fmt(activities.get(r.activity_id)?.activity_date || "")} · ${activities.get(r.activity_id)?.title || "Gara"}`,
        detail: `${r.lineup} · ${r.minutes_played} min`,
        match: matches.get(activities.get(r.activity_id)?.match_id || ""),
      })),
    },
    minutes: {
      label: "Minuti registrati",
      value: minutes.reduce((n, r) => n + Number(r.minutes_played || 0), 0),
      items: newestFirst(
        minutes,
        (r: RosterRow) => activities.get(r.activity_id)?.activity_date,
      ).map((r) => ({
        name: `${fmt(activities.get(r.activity_id)?.activity_date || "")} · ${activities.get(r.activity_id)?.title || "Gara"}`,
        detail: `${r.minutes_played} min`,
        match: matches.get(activities.get(r.activity_id)?.match_id || ""),
      })),
    },
    goals: {
      label: "Gol dei giocatori",
      value: goals.length,
      items: newestFirst(
        goals,
        (e: MatchEvent) => matches.get(e.match_id)?.match_date,
      ).map((e) => ({
        name: `${fmt(matches.get(e.match_id)?.match_date || "")} · ${matches.get(e.match_id)?.opponent || "Partita"}`,
        detail: `${e.event_type}${e.minute == null ? "" : " · " + e.minute + "′"}`,
        match: matches.get(e.match_id),
      })),
    },
    cards: {
      label: "Cartellini",
      value: cards.length,
      items: newestFirst(
        cards,
        (e: MatchEvent) => matches.get(e.match_id)?.match_date,
      ).map((e) => ({
        name: `${fmt(matches.get(e.match_id)?.match_date || "")} · ${matches.get(e.match_id)?.opponent || "Partita"}`,
        detail: `${e.event_type}${e.minute == null ? "" : " · " + e.minute + "′"}`,
        match: matches.get(e.match_id),
      })),
    },
  };
  return {
    drills,
    attendance,
    present,
    absent,
    injured,
    called,
    goals,
    cards,
    attendanceItems,
  };
}
