import {confirmDialog} from './app-confirm.js';
import {canOperate,fmt,render,sortPlayers,state,teamRequestGuard,toast,today} from './app-part1.js';
import {draftChanged,draftRows,editAttendanceSession,makeTrainingDraft} from './app-part3.js';
import {activityRows} from './app-team.js';
import {ui} from './src/ui-service.ts';

function localISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function recentFrom(days = 30) {
  const d = new Date(today() + "T12:00:00");
  d.setDate(d.getDate() - days + 1);
  return localISO(d);
}

const rosterIndexes = new WeakMap();

function indexedActivityRows(id) {
  const rows = state.roster || [];
  let cached = rosterIndexes.get(rows);
  if (!cached || cached.length !== rows.length) {
    const index = new Map();
    for (const r of rows) {
      if (!index.has(r.activity_id)) index.set(r.activity_id, []);
      index.get(r.activity_id).push(r);
    }
    cached = { length: rows.length, index };
    rosterIndexes.set(rows, cached);
  }
  return cached.index.get(id) || [];
}

function activityPeople(a) {
  const ids = new Set(indexedActivityRows(a.id).map((r) => r.player_id));
  return sortPlayers(state.players.filter((p) => p.active || ids.has(p.id)));
}

function pollEntries(a) {
  const rows = new Map(indexedActivityRows(a.id).map((r) => [r.player_id, r]));
  return activityPeople(a).map((p) => ({
    player: p,
    row: rows.get(p.id) || {
      player_id: p.id,
      availability: "In attesa",
      called: false,
    },
  }));
}

function activityPollPending(a) {
  return a.activity_type === "Allenamento" &&
    !a.session_id &&
    a.status === "Programmato"
    ? pollEntries(a).filter((x) => x.row.availability === "In attesa").length
    : 0;
}

function matchPhase(a) {
  if (a.status === "Annullato") return "cancelled";
  if (a.status === "Concluso" || a.activity_date < today()) return "after";
  if (a.activity_date > today()) return "before";
  const now = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  if (a.end_time && now >= a.end_time.slice(0, 5)) return "after";
  return a.start_time && now >= a.start_time.slice(0, 5) ? "during" : "before";
}

function activityHasEnded(a) {
  if (a.status !== "Programmato") return false;
  return (
    a.activity_date < today() ||
    (a.activity_date === today() && a.end_time && matchPhase(a) === "after")
  );
}

function seedPlannedReplies(d, a) {
  d.activityId = a.id;
  d.activityRevision = a.revision;
  d.session.attendance_mode = 'absence_notice';
  d.planned = new Map(activityRows(a.id).map(r => [r.player_id, r.availability]));
  for (const [id, row] of d.entries) {
    const response = activityRows(a.id).find(r => r.player_id === id);
    row.notified = null;
    row.status = response?.availability === 'Indisponibile' ? 'Assente' : 'Presente';
    row.note = response?.availability === 'Indisponibile' ? response.response_note || null : null;
  }
}

async function startActualAttendance(a, discardConfirmed = false) {
  const current = teamRequestGuard();
  if (!canOperate()) return;
  if (a.activity_type !== "Allenamento")
    return toast("Le presenze si registrano nella sezione Allenamenti");
  if (a.status === "Annullato") return toast("L’allenamento è annullato");
  if (a.activity_date > today())
    return toast(
      "Per una data futura registra le assenze comunicate. Le presenze si confermano dopo l’attività.",
    );
  if (a.session_id)
    return editAttendanceSession(a.session_id, discardConfirmed);
  if (state.trainingDraft?.saving)
    return toast("Attendi il salvataggio in corso");
  if (
    !discardConfirmed &&
    state.trainingDraft &&
    draftChanged(state.trainingDraft) &&
    !(await confirmDialog({
      message: "Scartare la bozza presenze non salvata?",
      confirmLabel: "Scarta",
    }))
  )
    return;
  if (!current()) return;
  state.trainingDraft = makeTrainingDraft();
  state.trainingDraft.session = {
    session_date: a.activity_date,
    session_type: a.activity_type,
    note: null,
  };
  seedPlannedReplies(state.trainingDraft, a);
  state.trainingDraft.baseline = JSON.stringify({
    session: state.trainingDraft.session,
    rows: draftRows(state.trainingDraft),
  });
  state.page = "training";
  state.trainingMode = "actual";
  render();
  window.scrollTo(0, 0);
  return true;
}

function priorityModal(kind){return ui.open('priority',{kind})} export {priorityModal};
export { localISO, recentFrom, rosterIndexes, indexedActivityRows, activityPeople, pollEntries, activityPollPending, matchPhase, activityHasEnded, seedPlannedReplies, startActualAttendance };
