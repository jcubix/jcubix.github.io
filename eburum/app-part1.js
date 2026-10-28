import { fetchAllRows } from "./src/data-query.ts";
import { state } from "./src/domain-state.ts";
import { createClient } from "@supabase/supabase-js";
import { canOperateRole, canPlanRole, canManageRole, canViewExpiriesRole, canTechnicalRole } from './app-roles.ts';
import { loadTeamData, loadAffectedData } from './app-data.ts';
import { notifyCommunications, stopCommunicationsRealtime, syncCommunicationsRealtime } from './app-realtime.js';
import { ui } from './src/ui-service.ts';

const db = (window.supabase?.createClient || createClient)(
  window.CONFIG.supabaseUrl,
  window.CONFIG.supabaseAnonKey,
);

const ROLE_ORDER = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];

const TEAM_ARRAYS = [
  "players",
  "sessions",
  "attendance",
  "matches",
  "events",
  "activities",
  "roster",
  "administration",
  "technical",
  "disciplinary_clearances",
  "dismissals",
  "dismissal_sanctions",
  "dismissal_clearances",
  "staff_communications",
  "communication_receipts",
];


let presentation = null;

function setPresentationAdapter(adapter) {
  presentation = adapter;
}

let refreshGeneration = 0,
  authGeneration = 0,
  sessionEpoch = 0;

function teamRequestGuard() {
  const actor = state.user?.id,
    owner = state.team?.owner_id,
    role = state.team?.role,
    epoch = sessionEpoch;
  return () =>
    !!actor &&
    state.user?.id === actor &&
    state.team?.owner_id === owner &&
    state.team?.role === role &&
    sessionEpoch === epoch;
}

const esc = (s = "") =>
  String(s).replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const teamOwner = () => state.team?.owner_id || state.user.id;

const teamRole = () =>
  state.team?.role ||
  (state.user?.app_metadata?.role === "admin" ? "admin" : "manager");

const isAdmin = () => teamRole() === "admin";

const canManage = () => canManageRole(teamRole());

const canPlan = () => canPlanRole(teamRole());

const canViewExpiries = () => canViewExpiriesRole(teamRole());

const canOperate = () => canOperateRole(teamRole());

const canTechnical = () => canTechnicalRole(teamRole());

const fmt = (d) =>
  d
    ? new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(d + "T12:00:00"))
    : "";

const roleRank = (r) => {
  const i = ROLE_ORDER.indexOf(r);
  return i < 0 ? 99 : i;
};

const sortPlayers = (a) =>
  [...a].sort(
    (x, y) =>
      roleRank(x.role) - roleRank(y.role) ||
      (Number(x.role_order) || 9999) - (Number(y.role_order) || 9999) ||
      `${x.surname} ${x.name}`.localeCompare(`${y.surname} ${y.name}`, "it"),
  );

const activePlayers = () => sortPlayers(state.players.filter((p) => p.active));

const badge = (s) =>
  ({ Presente: "b-green", Assente: "b-red", Infortunato: "b-blue" })[s] ||
  "b-gray";

async function boot() {

  const {
    data: { session },
  } = await db.auth.getSession();
  db.auth.onAuthStateChange((_, next) =>
    setTimeout(() => syncSession(next?.user || null), 0),
  );
  await syncSession(session?.user || null);
}

async function syncSession(user) {
  const generation = ++authGeneration;
  if (state.user?.id !== user?.id) {
    sessionEpoch++;
    refreshGeneration++;
    clearTeamState();
    showTeamLoading();
  }
  state.user = user;
  if (!user) {
    renderLogin();
    return;
  }
  try {
    const { data, error } = await db.auth.getUser();
    if (generation !== authGeneration) return;
    if (error && ![401, 403].includes(error.status)) throw error;
    if (error || !data?.user || data.user.id !== user.id) {
      state.user = null;
      renderLogin();
      toast("Sessione scaduta. Accedi nuovamente.");
      return;
    }
    state.user = data.user;
    await refresh();
  } catch (error) {
    if (generation === authGeneration) showTeamLoadError(error);
  }
}


let fullRefresh = Promise.resolve(false), affectedRefresh = Promise.resolve(false);
function refresh() {
  affectedRefresh = Promise.resolve(false);
  fullRefresh = refreshTeam();
  return fullRefresh;
}

function refreshAffected(change) {
  const context = teamRequestGuard(), season = state.seasonYear, generation = refreshGeneration;
  // Serialize targeted patches so simultaneous saves cannot replace each other's rows.
  const pending = affectedRefresh.then(async () => {
    await fullRefresh;
    const current = () => context() && state.seasonYear === season && generation === refreshGeneration;
    if (!current()) return false;
    const result = await db.rpc("team_context");
    if (!current()) return false;
    if (result.error) throw result.error;
    if (!result.data || result.data.owner_id !== state.team?.owner_id || result.data.role !== state.team?.role) {
      await refresh();
      return false;
    }
    state.team = result.data;
    const patch = await loadAffectedData(change, teamOwner());
    if (!current()) return false;
    Object.assign(state, patch);
    render();
    return true;
  });
  affectedRefresh = pending.catch(() => false);
  return pending;
}

async function refreshTeam() {
  const actor = state.user?.id;
  if (!actor) return false;
  const generation = ++refreshGeneration,
    current = () =>
      generation === refreshGeneration && state.user?.id === actor;
  try {
    const context = await db.rpc("team_context");
    if (!current()) return false;
    if (context.error || !context.data) {
      clearTeamState();
      showTeamLoadError(
        context.error || new Error("Utenza non associata a una squadra"),
      );
      return false;
    }
    if (
      state.loadedActor !== actor ||
      state.team?.owner_id !== context.data.owner_id ||
      state.team?.role !== context.data.role
    ) {
      clearTeamState();
      showTeamLoading();
    }
    state.team = context.data;
    state.loadedActor = actor;
    const uid = teamOwner();
    const data = await loadTeamData(uid);
    if (!current()) return false;
    Object.assign(state, data);
    syncCommunicationsRealtime();
    notifyCommunications();
    render();
    return true;
  } catch (error) {
    if (current()) showTeamLoadError(error);
    return false;
  }
}

function clearTeamState(){for(const key of TEAM_ARRAYS)state[key]=[];state.team=null;state.loadedActor=null;state.page='dashboard';state.trainingMode='hub';state.trainingDraft=null;for(const key of ['registerDate','reportPlayer','pageScroll','reportView','registerMonth','seasonYear','dataRange','earliestSport'])delete state[key];stopCommunicationsRealtime();ui.reset();notifyCommunications()}
function showTeamLoading(){presentation?.loading()}
function showTeamLoadError(error){presentation?.error(error)}
function renderLogin(){authGeneration++;refreshGeneration++;sessionEpoch++;state.user=null;clearTeamState();presentation?.login()}
function render(){if(!canOperate()&&state.trainingMode==='actual')state.trainingMode='hub';presentation?.render()}
function toast(message){ui.notify(message)}
function fail(error){console.error(error);toast(error?.message||'Operazione non riuscita')}
for(const key of TEAM_ARRAYS)state[key]=[];
export {clearTeamState,showTeamLoading,showTeamLoadError,renderLogin,render,toast,fail};
export { db, ROLE_ORDER, TEAM_ARRAYS, state, presentation, setPresentationAdapter, refreshGeneration, authGeneration, sessionEpoch, teamRequestGuard, esc, today, teamOwner, teamRole, isAdmin, canManage, canPlan, canViewExpiries, canOperate, canTechnical, fmt, roleRank, sortPlayers, activePlayers, badge, boot, syncSession, fetchAllRows, refresh, refreshAffected };
