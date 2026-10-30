import { ui } from './src/ui-service.ts';
import { matchPhase } from './app-workflows.js';
import { matchTitle } from './app-match-display.js';
import { readonlyActivity } from './app-access.js';
import { roleLabels } from './app-roles.ts';
import { canOperate, canPlan, canViewExpiries, db, fail, fetchAllRows, state, teamOwner, teamRequestGuard, teamRole, today } from './app-part1.js';

const teamArrays = () => {
  for (const k of ["activities", "roster", "administration", "technical"])
    state[k] ??= [];
};

const activityRows = (id) =>
  (state.roster || []).filter((r) => r.activity_id === id);

const activityLabel = (a) =>
  a.activity_type === "Partita"
    ? matchTitle({
        opponent: a.title,
        venue: state.matches.find((m) => m.id === a.match_id)?.venue,
      })
    : a.title;

const clock = (t) => (t ? t.slice(0, 5) : "Orario da definire");

const expiryLimit = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function expiringPlayers() {
  if (teamRole() === "president")
    return (state.administration || []).filter(
      (d) =>
        state.players.some((p) => p.id === d.player_id && p.active) &&
        d.needs_review,
    );
  return state.players
    .filter((p) => p.active)
    .map((p) => ({
      player_id: p.id,
      registration_status: "Da verificare",
      ...(state.administration || []).find((d) => d.player_id === p.id),
    }))
    .filter(
      (d) =>
        !d.certificate_until ||
        !d.document_until ||
        d.certificate_until <= expiryLimit() ||
        d.document_until <= expiryLimit() ||
        d.registration_status !== "In regola",
    );
}

function documentSummary() {
  if (!canViewExpiries()) return { review: 0, expired: null };
  const rows = expiringPlayers();
  return {
    review: rows.length,
    expired:
      teamRole() === "president"
        ? null
        : rows.filter((d) =>
            [d.certificate_until, d.document_until].some(
              (date) => date && date < today(),
            ),
          ).length,
  };
}

async function openActivity(id, preferredTab = "auto") {
  if (state.openingActivity) return;
  state.openingActivity = true;
  try {
    const uid = teamOwner(),
      current = teamRequestGuard();
    const [a, r, t] = await Promise.all([
      db
        .from("activities")
        .select("*")
        .eq("id", id)
        .eq("user_id", uid)
        .single(),
      fetchAllRows(() =>
        db
          .from("activity_roster")
          .select("*")
          .eq("activity_id", id)
          .eq("user_id", uid)
          .order("id"),
      ),
      fetchAllRows(() =>
        db
          .from("activity_technical")
          .select("*")
          .eq("activity_id", id)
          .eq("user_id", uid)
          .order("activity_id"),
      ),
    ]);
    if (a.error || r.error || t.error) throw a.error || r.error || t.error;
    if (!current()) return;
    if (!canOperate() || (a.data.activity_type === "Riunione" && !canPlan()))
      return readonlyActivity(a.data);
    await activityModal(
      a.data,
      r.data,
      t.data[0],
      preferredTab === "auto"
        ? a.data.match_id
          ? matchPhase(a.data) === "before" ? "roster" : "results"
          : "details"
        : preferredTab,
    );
  } catch (e) {
    fail(e);
  } finally {
    state.openingActivity = false;
  }
}

function activityModal(a={},savedRows=[],technical={},preferredTab='details'){return ui.open(a.activity_type==='Partita'?'match':'planning',{activity:a,rows:savedRows,technical,tab:preferredTab},{workspace:true,page:state.page==='register'?'register':a.activity_type==='Partita'?'matches':'training',detail:a.match_id?'match:'+a.match_id:a.id?'activity:'+a.id:a.activity_type==='Partita'?'match:new':'activity:new'})}
function playerSheet(id){if(state.players.some(p=>p.id===id))return ui.open('player',{id},{page:'players',detail:'player:'+id})}
function expiryModal(){if(canViewExpiries())return ui.open('expiries',{}, {page:'expiries',detail:'tool:expiries',workspace:true})}
export {activityModal,playerSheet,expiryModal,roleLabels};
export { teamArrays, activityRows, activityLabel, clock, expiryLimit, expiringPlayers, documentSummary, openActivity };
