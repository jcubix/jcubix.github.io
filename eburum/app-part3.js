import {confirmDialog} from './app-confirm.js';
import {activePlayers,canOperate,db,fail,fetchAllRows,fmt,render,sortPlayers,state,teamOwner,teamRequestGuard,toast,today} from './app-part1.js';
import {ui} from './src/ui-service.ts';

const attendanceValues = (a) => ({
  status: a.status || "Presente",
  delay_minutes: a.delay_minutes || 0,
  notified: a.notified ?? null,
  note: a.note || null,
});

const sessionValues = (s) => ({
  session_date: s.session_date,
  session_type: s.session_type,
  note: s.note || null,
});

const draftRows = (d) =>
  d.players.map((p) => ({ player_id: p.id, ...d.entries.get(p.id) }));

const draftChanged = (d) =>
  JSON.stringify({ session: d.session, rows: draftRows(d) }) !== d.baseline;

function makeTrainingDraft(session = null, rows = []) {
  const players = session
    ? sortPlayers(
        rows.map(
          (a) =>
            state.players.find((p) => p.id === a.player_id) || {
              id: a.player_id,
              surname: "Giocatore storico",
              name: "",
              role: "",
              active: false,
            },
        ),
      )
    : activePlayers();
  const entries = new Map(
    players.map((p) => [
      p.id,
      attendanceValues(
        session
          ? rows.find((a) => a.player_id === p.id)
          : { status: "Da confermare" },
      ),
    ]),
  );
  const draft = {
    originPage: state.page,
    userId: state.user.id,
    id: session?.id || null,
    revision: session?.revision ?? 0,
    session: session
      ? sessionValues(session)
      : { session_date: today(), session_type: "Allenamento", note: null },
    players,
    entries,
    search: "",
    filter: "all",
    requestId: crypto.randomUUID(),
    saving: false,
  };
  draft.baseline = JSON.stringify({
    session: draft.session,
    rows: draftRows(draft),
  });
  return draft;
}

function getTrainingDraft() {
  if (!state.trainingDraft || state.trainingDraft.userId !== state.user.id)
    state.trainingDraft = makeTrainingDraft();
  return state.trainingDraft;
}

function attendanceCounts(entries) {
  const a = Array.from(entries);
  return {
    present: a.filter((x) => x.status === "Presente").length,
    absent: a.filter((x) => x.status === "Assente").length,
    injured: a.filter((x) => x.status === "Infortunato").length,
    pending: a.filter(
      (x) => !["Presente", "Assente", "Infortunato"].includes(x.status),
    ).length,
  };
}

async function editAttendanceSession(id, discardConfirmed = false) {
  const originalContext = teamRequestGuard();
  if (!canOperate()) {
    state.page = "register";
    render();
    return;
  }
  if (state.trainingDraft?.saving)
    return toast("Attendi il salvataggio in corso");
  if (
    !discardConfirmed &&
    state.trainingDraft &&
    draftChanged(state.trainingDraft) &&
    !(await confirmDialog({
      message: "Aprire questa sessione e scartare la bozza non salvata?",
      confirmLabel: "Scarta",
    }))
  )
    return;
  if (!originalContext()) return;
  try {
    const current = teamRequestGuard(),
      uid = teamOwner();
    const [session, attendance] = await Promise.all([
      db.from("sessions").select("*").eq("id", id).eq("user_id", uid).single(),
      fetchAllRows(() =>
        db
          .from("attendance")
          .select("*")
          .eq("session_id", id)
          .eq("user_id", uid)
          .order("id"),
      ),
    ]);
    if (session.error) throw session.error;
    if (attendance.error) throw attendance.error;
    if (!attendance.data.length)
      throw new Error("Questa sessione non contiene presenze da correggere");
    if (!current()) return;
    state.trainingDraft = makeTrainingDraft(session.data, attendance.data);
    const linked = state.activities.find(
      (a) => a.session_id === id && a.activity_type === "Allenamento",
    );
    if (linked) {
      state.trainingDraft.activityId = linked.id;
      state.trainingDraft.activityRevision = linked.revision;
    }
    state.trainingMode = "actual";
    state.page = "training";
    render();
    window.scrollTo(0, 0);
    return true;
  } catch (error) {
    fail(error);
  }
}

function historyValue(key, value) {
  if (value == null || value === "") return "Non indicato";
  if (key === "notified") return value ? "Sì" : "No";
  if (key === "session_date") return fmt(value);
  if (key === "delay_minutes") return `${value} min`;
  return String(value);
}

function sessionHistoryModal(id){return ui.open('history',{id,kind:'session'})} export {sessionHistoryModal};
export { attendanceValues, sessionValues, draftRows, draftChanged, makeTrainingDraft, getTrainingDraft, attendanceCounts, editAttendanceSession, historyValue };
