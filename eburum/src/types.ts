import type { User, SupabaseClient } from "@supabase/supabase-js";
export type Page =
  | "dashboard"
  | "training"
  | "matches"
  | "players"
  | "reports"
  | "register"
  | "meetings"
  | "more"
  | "communications";
export type TeamRole = "admin" | "manager" | "coach" | "secretary";
export type ActivityType = "Allenamento" | "Partita" | "Riunione";
export interface Player {
  id: string;
  surname: string;
  name: string;
  active: boolean;
  role: string;
  shirt_number?: number | null;
  phone?: string | null;
  role_order?: number | null;
}
export interface Activity {
  id: string;
  title: string;
  activity_type: ActivityType;
  activity_date: string;
  status: string;
  start_time?: string | null;
  location?: string | null;
  session_id?: string | null;
  match_id?: string | null;
  revision: number;
}
export interface RosterRow {
  activity_id: string;
  player_id: string;
  availability: string;
  called: boolean;
  lineup: string;
  minutes_played: number;
}
export interface Match {
  id: string;
  opponent: string;
  match_date: string;
  venue: string;
  goals_for: number | null;
  goals_against: number | null;
  note?: string | null;
  minutes_auto?: boolean;
  duration_minutes?: number;
}
export interface Communication {
  id: string;
  user_id: string;
  title: string;
  body: string;
  player_id: string | null;
  created_by: string;
  author_label?: string;
  created_at: string;
  expires_at: string;
  retention_days: number;
}
export interface TeamState {
  user: User | null;
  team: { owner_id: string; role: TeamRole } | null;
  page: Page;
  players: Player[];
  activities: Activity[];
  matches: Match[];
  roster: RosterRow[];
  staff_communications: Communication[];
  trainingMode?: "hub" | "actual";
  trainingDraft?: { saving: boolean } | null;
  seasonYear?: number;
  earliestSport?: string;
  communicationRealtimeStatus?: string;
}
export interface RuntimeSnapshot {
  status: "loading" | "login" | "ready" | "error";
  revision: number;
  communicationRevision: number;
  page: Page;
  role: TeamRole | null;
  email: string;
  error: string;
}
export interface Runtime {
  db: SupabaseClient;
  state: TeamState;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => RuntimeSnapshot;
  start: () => Promise<void>;
  navigate: (page: Page) => boolean;
  setNavigationGuard: (guard: (() => boolean) | null) => void;
  render: () => void;
  featureHtml: (page: Page) => string;
  bindFeature: (page: Page, root: HTMLElement) => void;
  actions: {
    newTraining: () => void;
    newMeeting: () => void;
    openActivity: (id: string) => Promise<void>;
    newMatch: () => void;
    openMatch: (match: Match) => void;
    users: () => void;
    expiries: () => void;
    discipline: () => void;
    playerSheet: (id: string) => void;
    playerDiscipline: (id: string) => {
      total: number;
      diffida: boolean;
      pending: unknown[];
      review: unknown[];
    };
    editPlayer: (player?: Player) => void;
    setPlayerActive: (player: Player, active: boolean) => Promise<void>;
    resumeAttendance: () => void;
    hasAttendanceDraft: () => boolean;
    reload: () => Promise<boolean>;
    logout: () => Promise<void>;
    activeCommunications: () => Communication[];
    fetchCommunications: () => Promise<void>;
    communicationAudience: (m: Communication) => string;
    communicationExpiry: (date: string) => string;
    communicationTime: (date: string) => string;
    publishCommunication: (values: {
      title: string;
      body: string;
      retention_days: number;
      player_id: string | null;
    }) => Promise<void>;
    deleteCommunication: (id: string) => Promise<void>;
    changeSeason: (year: number) => Promise<void>;
    season: () => { year: number; from: string; to: string };
  };
}
declare global {
  interface Window {
    CONFIG: { supabaseUrl: string; supabaseAnonKey: string; season: string };
    supabase?: {
      createClient: typeof import("@supabase/supabase-js").createClient;
    };
    jspdf?: unknown;
  }
}
