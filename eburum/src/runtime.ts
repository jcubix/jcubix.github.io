import * as admin from "../app-admin.js";
import * as communications from "../app-communications.js";
import { confirmDialog } from "../app-confirm.js";
import * as data from "../app-data.ts";
import * as dialogs from "../app-dialogs.js";
import * as discipline from "../app-discipline.js";
import * as core from "../app-part1.js";
import * as parts2 from "../app-part2.js";
import * as parts3 from "../app-part3.js";
import * as parts4 from "../app-part4.js";
import { routeDetail } from "../app-presentation.js";
import * as realtime from "../app-realtime.js";
import * as team from "../app-team.js";
import * as training from "../app-training-planning.js";
import * as workflows from "../app-workflows.js";
import type { Page, Runtime, RuntimeSnapshot } from "./types";
import { ui } from "./ui-service";
const pages = new Set<Page>([
  "dashboard",
  "training",
  "matches",
  "players",
  "reports",
  "register",
  "meetings",
  "more",
  "users",
  "expiries",
  "discipline",
  "communications",
  "finance",
  "whiteboard",
]);
export function pageFromHash(): Page {
  const value = window.location.hash.replace(/^#\/?/, "").split("?")[0] as Page;
  return pages.has(value) ? value : "dashboard";
}

// Existing domain modules retain atomic writes, audit and role checks. React owns
// the application root; the explicit presentation port replaces DOM-root writes.
export async function createRuntime(): Promise<Runtime> {
  const state = core.state,
    db = core.db;
  const listeners = new Set<() => void>();
  let snapshot: RuntimeSnapshot = {
    status: "loading",
    revision: 0,
    communicationRevision: 0,
    page: "dashboard",
    role: null,
    email: "",
    error: "",
  };
  let firstReady = true;
  let wasActual = false;
  let navigationGuard: (() => boolean | Promise<boolean>) | null = null;
  let navigationRevision = 0;
  const emit = (values: Partial<RuntimeSnapshot>) => {
    snapshot = { ...snapshot, ...values };
    for (const fn of listeners) fn();
  };
  const render = () => {
    if (firstReady) {
      state.page = pageFromHash();
      firstReady = false;
    }
    if (!core.canOperate() && state.trainingMode === "actual")
      state.trainingMode = "hub";
    const leftActual = wasActual && state.trainingMode !== "actual";
    wasActual = state.trainingMode === "actual";
    const session = state.trainingDraft?.id;
    if (
      detailRouter &&
      state.page === "training" &&
      state.trainingMode === "actual" &&
      session &&
      routeDetail("training", window.location.hash.split("?")[1] || "")?.key !==
        "session:" + session
    )
      detailRouter({ page: "training", key: "session:" + session });
    if (
      detailRouter &&
      leftActual &&
      routeDetail(
        state.page,
        window.location.hash.split("?")[1] || "",
      )?.key.startsWith("session:")
    )
      detailRouter(null);
    emit({
      status: "ready",
      revision: snapshot.revision + 1,
      page: state.page,
      role: state.team?.role ?? null,
      email: state.user?.email ?? "",
      error: "",
    });
  };
  core.setPresentationAdapter({
    render,
    login: () => {
      firstReady = true;
      wasActual = false;
      emit({
        status: "login",
        role: null,
        email: "",
        revision: snapshot.revision + 1,
      });
    },
    loading: () =>
      emit({ status: "loading", role: null, revision: snapshot.revision + 1 }),
    error: (error: Error) =>
      emit({
        status: "error",
        error: error.message || "Connessione non disponibile",
        revision: snapshot.revision + 1,
      }),
  });
  let detailRouter:
    ((detail: { page: Page; key: string } | null) => void) | null = null;
  const rememberScroll = () => {
    state.pageScroll ??= {};
    state.pageScroll[state.page] = window.scrollY;
  };
  ui.setDetailPresenter((surface) => {
    if (surface?.page && surface.page !== state.page) {
      rememberScroll();
      state.page = surface.page;
      core.render();
    }
    if (surface?.page && surface.detail)
      detailRouter?.({ page: surface.page, key: surface.detail });
    else if (!surface) detailRouter?.(null);
  });
  const syncDetail = async (page: Page, search: string) => {
    const revision = ++navigationRevision;
    const current = core.teamRequestGuard();
    const detail = routeDetail(page, search);
    if (
      detail?.key === "session:" + state.trainingDraft?.id &&
      state.trainingMode === "actual"
    )
      return true;
    const roots = ui.getSnapshot().surfaces;
    if (detail && roots.some((surface) => surface.detail === detail.key))
      return true;
    if (
      !detail &&
      page === "training" &&
      state.page === "training" &&
      state.trainingMode === "actual" &&
      !!state.trainingDraft?.id
    ) {
      if (
        !(await canLeaveAttendance()) ||
        revision !== navigationRevision ||
        !current()
      )
        return false;
      state.trainingMode = "hub";
      core.render();
    }
    if (!detail && !roots.length) return true;
    if (navigationGuard && !(await navigationGuard())) return false;
    if (
      !(await dialogs.closeWorkspaceEditors({ restoreRoute: false })) ||
      revision !== navigationRevision ||
      !current()
    )
      return false;
    if (!detail) return true;
    const split = detail.key.indexOf(":"),
      kind = detail.key.slice(0, split),
      id = detail.key.slice(split + 1);
    if (page === "reports") {
      core.render();
      return true;
    }
    if (kind === "player") {
      if (!state.players.some((p) => p.id === id))
        throw Error("Giocatore non disponibile nella stagione selezionata.");
      team.playerSheet(id);
    } else if (kind === "match") {
      const match = state.matches.find((m) => m.id === id);
      if (id === "new") {
        if (!core.canPlan())
          throw Error("Creazione riservata allo staff autorizzato.");
        await parts4.matchModal();
      } else if (match) await parts4.matchModal(match);
      else throw Error("Partita non disponibile nella stagione selezionata.");
    } else if (kind === "activity") {
      if (id === "new") {
        if (!core.canPlan())
          throw Error("Creazione riservata allo staff autorizzato.");
        await training.planningModal({
          activity_type: page === "meetings" ? "Riunione" : "Allenamento",
        });
      } else if (state.activities.some((a) => a.id === id))
        await team.openActivity(id);
      else throw Error("Attività non disponibile nella stagione selezionata.");
    } else if (kind === "session") {
      if (!core.canOperate())
        throw Error("Correzione riservata allo staff autorizzato.");
      if (!state.sessions.some((s) => s.id === id))
        throw Error("Sessione non disponibile nella stagione selezionata.");
      await parts3.editAttendanceSession(id);
    } else if (kind === "discipline") discipline.disciplineModal(id);
    else if (kind === "tool") {
      if (id === "users" && core.isAdmin()) admin.usersModal();
      else if (id === "expiries" && core.canViewExpiries())
        await team.expiryModal();
      else if (id === "discipline") discipline.disciplineModal();
      else throw Error("Sezione non disponibile per il tuo ruolo.");
    }
    return true;
  };
  async function canLeaveAttendance() {
    return (
      state.trainingMode !== "actual" ||
      !state.trainingDraft ||
      !parts3.draftChanged(state.trainingDraft) ||
      (await confirmDialog({
        message:
          "Uscire dalle presenze non salvate? La bozza resta disponibile in questa sessione.",
        confirmLabel: "Esci dalle presenze",
      }))
    );
  }
  async function canLeaveWorkspace() {
    const current = core.teamRequestGuard();
    if (
      state.trainingDraft?.saving ||
      !(await canLeaveAttendance()) ||
      (navigationGuard && !(await navigationGuard())) ||
      !(await dialogs.closeWorkspaceEditors({ restoreRoute: false }))
    )
      return false;
    return current() && !state.trainingDraft?.saving;
  }
  const navigate = async (page: Page) => {
    if (page === state.page) return true;
    const revision = ++navigationRevision;
    try {
      if (!(await canLeaveWorkspace()) || revision !== navigationRevision)
        return false;
      rememberScroll();
      state.page = page;
      if (page === "training") state.trainingMode = "hub";
      core.render();
      return true;
    } catch (error) {
      core.fail(error);
      return false;
    }
  };
  realtime.initCommunicationsLifecycle();
  realtime.onCommunicationsChanged(() =>
    emit({ communicationRevision: snapshot.communicationRevision + 1 }),
  );
  const scoped = core.teamRequestGuard;
  const changeSeason = async (year: number) => {
    const revision = ++navigationRevision;
    if (!(await canLeaveWorkspace()) || revision !== navigationRevision) return;
    state.seasonYear = year;
    await core.refresh();
  };
  return {
    db,
    state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snapshot,
    start: core.boot,
    navigate,
    syncDetail,
    setDetailRouter: (handler) => {
      detailRouter = handler;
    },
    setNavigationGuard: (guard) => {
      navigationGuard = guard;
    },
    canLeaveInline: async () =>
      navigationGuard ? !!(await navigationGuard()) : true,
    requestGuard: core.teamRequestGuard,
    render: core.render,
    actions: {
      pollEntries: workflows.pollEntries,
      newTraining: async () => {
        if (navigationGuard && !(await navigationGuard())) return;
        return training.planningModal({ activity_type: "Allenamento" });
      },
      openActivity: team.openActivity,
      newMatch: async () => {
        if (navigationGuard && !(await navigationGuard())) return;
        return parts4.matchModal();
      },
      openMatch: parts4.matchModal,
      users: admin.usersModal,
      expiries: team.expiryModal,
      documentSummary: team.documentSummary,
      // React passes a click event to handlers. The general index must never
      // interpret that event as the optional player filter of the domain modal.
      discipline: () => discipline.disciplineModal(),
      playerSheet: team.playerSheet,
      editPlayer: parts2.playerModal,
      playerDiscipline: discipline.playerDiscipline,
      setPlayerActive: async (player, active) => {
        if (!core.canManage())
          throw Error("Modifica riservata ai responsabili della rosa");
        const current = scoped();
        const values: { active: boolean; role_order?: number } = { active };
        if (active)
          values.role_order =
            Math.max(
              0,
              ...state.players
                .filter((p) => p.active && p.role === player.role)
                .map((p) => p.role_order || 0),
            ) + 1;
        const { data, error } = await db
          .from("players")
          .update(values)
          .eq("id", player.id)
          .eq("user_id", core.teamOwner())
          .select("*")
          .single();
        if (error) throw error;
        if (!data) throw new Error("Giocatore non aggiornato. Riprova.");
        if (current()) {
          state.players = state.players.map((row) =>
            row.id === data.id ? data : row,
          );
          core.render();
        }
      },
      resumeAttendance: () => {
        state.trainingMode = "actual";
        core.render();
      },
      hasAttendanceDraft: () =>
        !!state.trainingDraft && parts3.draftChanged(state.trainingDraft),
      reload: core.refresh,
      reloadAffected: async (change) => {
        const current = scoped();
        try {
          return await core.refreshAffected(change);
        } catch (cause) {
          if (current()) core.showTeamLoadError(cause);
          return false;
        }
      },
      logout: async () => {
        const revision = ++navigationRevision;
        if (!(await canLeaveWorkspace()) || revision !== navigationRevision)
          return;
        const { error } = await db.auth.signOut();
        if (error) throw error;
      },
      activeCommunications: communications.activeCommunications,
      fetchCommunications: async () => {
        await communications.fetchCommunications();
      },
      communicationAudience: communications.communicationAudience,
      communicationExpiry: communications.communicationExpiry,
      communicationTime: communications.communicationTime,
      publishCommunication: async (values) => {
        const current = scoped(),
          owner = core.teamOwner();
        const { data: message, error } = await db
          .from("staff_communications")
          .insert({ ...values, user_id: owner })
          .select()
          .single();
        if (error) throw error;
        if (!current()) throw Error("Accesso cambiato durante il salvataggio");
        state.staff_communications = [...state.staff_communications, message];
        realtime.notifyCommunications();
      },
      acknowledgeCommunication: async (id) => {
        const current = scoped();
        const { error } = await db.rpc("acknowledge_communication", {
          p_id: id,
        });
        if (error) throw error;
        if (current()) await communications.fetchCommunications();
      },
      deleteCommunication: async (id) => {
        const current = scoped();
        const { error } = await db
          .from("staff_communications")
          .delete()
          .eq("id", id)
          .eq("user_id", core.teamOwner());
        if (error) throw error;
        if (current()) await communications.fetchCommunications();
      },
      changeSeason,
      season: data.sportSeason,
    },
  };
}
