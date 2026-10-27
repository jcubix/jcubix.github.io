import type { MatchEvent, RosterRow } from "../types";
export type Composer = {
  type: string;
  team?: "own" | "opponent";
  event?: Partial<MatchEvent>;
};
export type MatchForm = {
  activity: {
    title: string;
    activity_date: string;
    start_time: string;
    end_time: string;
    location: string;
    status: string;
    meeting_time: string;
    meeting_place: string;
    organization_note: string;
    venue: string;
  };
  rows: RosterRow[];
  technical: { formation: string; note: string };
  result: {
    goals_for: string;
    goals_against: string;
    duration_minutes: string;
    minutes_auto: boolean;
    venue: string;
    note: string;
  };
};
