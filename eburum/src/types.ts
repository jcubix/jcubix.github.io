import type { DataChange } from "../app-data";
import type { SupabaseClient, User } from "@supabase/supabase-js";
export type Page =
  | "dashboard"
  | "training"
  | "matches"
  | "players"
  | "reports"
  | "register"
  | "meetings"
  | "more"
  | "communications"
  | "finance"
  | "whiteboard";
export type TeamRole =
  | "admin"
  | "manager"
  | "coach"
  | "secretary"
  | "technical_assistant"
  | "president"
  | "treasurer";
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
  secondary_role?: string | null;
  user_id?: string;
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
  end_time?: string | null;
  organization_note?: string | null;
  meeting_time?: string | null;
  meeting_place?: string | null;
  request_id?: string;
  venue?: string;
}
export interface RosterRow {
  activity_id: string;
  player_id: string;
  availability: string;
  called: boolean;
  lineup: string;
  minutes_played: number;
  position?: string | null;
  response_note?: string | null;
  id?: string;
  user_id?: string;
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
  requires_ack?: boolean;
  kind?: "notice" | "meeting";
  meeting_date?: string | null;
  meeting_time?: string | null;
  meeting_location?: string | null;
}
export interface Session {
  id: string;
  session_date: string;
  session_type: string;
  note?: string | null;
  revision?: number;
  updated_at?: string;
}
export interface Attendance {
  id?: string;
  player_id: string;
  session_id?: string;
  status: string;
  delay_minutes: number;
  notified: boolean | null;
  note: string | null;
}
export interface MatchEvent {
  id: string;
  match_id: string;
  player_id: string | null;
  outgoing_player_id?: string | null;
  minute: number | null;
  event_type: string;
  detail?: string | null;
  created_at?: string;
  user_id?: string;
}
export interface Administration {
  player_id: string;
  certificate_until?: string | null;
  document_until?: string | null;
  registration_status?: string;
  administration_note?: string | null;
  needs_review?: boolean;
  certificate_status?: string;
  document_status?: string;
}
export interface Technical {
  activity_id?: string;
  formation?: string | null;
  note?: string | null;
}
export interface DisciplinaryClearance {
  id: string;
  player_id: string;
  season_start: string;
  threshold_event_id: string;
  served_match_id: string;
}
export interface DismissalEvent extends MatchEvent {
  match_date: string;
  opponent: string;
  activity_status: string;
}
export interface DismissalSanction {
  event_id: string;
  player_id: string;
  kind: string;
  match_count: number | null;
  suspended_until: string | null;
  note: string | null;
  voided: boolean;
  revision: number;
}
export interface DismissalClearance {
  id: string;
  event_id: string;
  player_id: string;
  match_id: string;
  match_date: string;
  opponent: string;
  activity_status: string;
  has_result: boolean;
  has_minutes: boolean;
}
export interface TrainingDraft {
  originPage: Page;
  userId: string;
  id: string | null;
  revision: number;
  session: { session_date: string; session_type: string; note: string | null };
  players: Player[];
  entries: Map<string, Attendance>;
  search: string;
  filter: string;
  requestId: string;
  saving: boolean;
  baseline: string;
  activityId?: string;
  activityRevision?: number;
  planned?: Map<string, string>;
}
export interface TeamState {
  loadedActor?: string | null;
  pageScroll?: Partial<Record<Page, number>>;
  user: User | null;
  team: {
    owner_id: string;
    role: TeamRole;
    first_name?: string;
    last_name?: string;
  } | null;
  page: Page;
  players: Player[];
  sessions: Session[];
  attendance: Attendance[];
  events: MatchEvent[];
  administration: Administration[];
  technical: Technical[];
  disciplinary_clearances: DisciplinaryClearance[];
  dismissals: DismissalEvent[];
  dismissal_sanctions: DismissalSanction[];
  dismissal_clearances: DismissalClearance[];
  activities: Activity[];
  matches: Match[];
  roster: RosterRow[];
  staff_communications: Communication[];
  communication_receipts: {
    communication_id: string;
    reader_id: string;
    reader_label: string;
    acknowledged_at: string;
  }[];
  trainingMode?: "hub" | "actual";
  trainingDraft?: TrainingDraft | null;
  registerDate?: string;
  registerMonth?: string;
  reportPlayer?: string;
  reportView?: { player?: string; period?: string; from?: string; to?: string };
  dataRange?: { from: string; to: string };
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
  navigate: (page: Page) => Promise<boolean>;
  setNavigationGuard: (
    guard: (() => boolean | Promise<boolean>) | null,
  ) => void;
  canLeaveInline: () => Promise<boolean>;
  requestGuard: () => () => boolean;
  render: () => void;
  syncDetail: (page: Page, search: string) => Promise<boolean>;
  setDetailRouter: (
    handler: ((detail: { page: Page; key: string } | null) => void) | null,
  ) => void;
  actions: {
    pollEntries: (activity: Activity) => { row: { availability: string } }[];
    newTraining: () => void;
    openActivity: (id: string) => Promise<number | undefined>;
    newMatch: () => void;
    openMatch: (match: Match) => void;
    users: () => void;
    expiries: () => void;
    documentSummary: () => { review: number; expired: number | null };
    discipline: () => void;
    playerSheet: (id: string) => void;
    playerDiscipline: (id: string) => {
      total: number;
      diffida: boolean;
      pending: unknown[];
      review: unknown[];
      redAttention: boolean;
    };
    editPlayer: (player?: Player) => void;
    setPlayerActive: (player: Player, active: boolean) => Promise<void>;
    resumeAttendance: () => void;
    hasAttendanceDraft: () => boolean;
    reload: () => Promise<boolean>;
    reloadAffected: (change: DataChange) => Promise<boolean>;
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
      requires_ack?: boolean;
      kind?: "notice" | "meeting";
      meeting_date?: string | null;
      meeting_time?: string | null;
      meeting_location?: string | null;
    }) => Promise<void>;
    acknowledgeCommunication: (id: string) => Promise<void>;
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
