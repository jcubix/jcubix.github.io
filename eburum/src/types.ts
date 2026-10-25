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
  requires_ack?: boolean;
  kind?: "notice" | "meeting";
  meeting_date?: string | null;
  meeting_time?: string | null;
  meeting_location?: string | null;
}
export interface TeamState {
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
  sessions: { id: string; session_date: string; session_type: string }[];
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
  trainingDraft?: { saving: boolean; id?: string } | null;
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
  requestGuard: () => () => boolean;
  render: () => void;
  featureHtml: (page: Page) => string;
  bindFeature: (page: Page, root: HTMLElement) => void;
  syncDetail: (page: Page, search: string) => Promise<boolean>;
  setDetailRouter: (
    handler: ((detail: { page: Page; key: string } | null) => void) | null,
  ) => void;
  actions: {
    pollEntries: (activity: Activity) => { row: { availability: string } }[];
    newTraining: () => void;
    openActivity: (id: string) => Promise<void>;
    mountTrainingReplies: (
      host: HTMLElement,
      activity: Activity,
    ) => { isDirty: () => boolean; isBusy: () => boolean; dispose: () => void };
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
