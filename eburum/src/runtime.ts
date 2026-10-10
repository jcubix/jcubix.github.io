import type { Runtime, RuntimeSnapshot, TeamState, Page } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
const pages = new Set<Page>([
  "dashboard",
  "training",
  "matches",
  "players",
  "reports",
  "register",
  "meetings",
  "more",
  "communications",
]);
export function pageFromHash(): Page {
  const value = window.location.hash.replace(/^#\/?/, "").split("?")[0] as Page;
  return pages.has(value) ? value : "dashboard";
}

// Existing domain modules retain atomic writes, audit and role checks. React owns
// the application root; the explicit presentation port replaces DOM-root writes.
export async function createRuntime(): Promise<Runtime> {
  const [
    core,
    team,
    training,
    parts2,
    parts3,
    parts4,
    reports,
    ops,
    access,
    communications,
    realtime,
    discipline,
    workflows,
    admin,
    data,
  ] = await Promise.all([
    import("../app-part1.js"),
    import("../app-team.js"),
    import("../app-training-planning.js"),
    import("../app-part2.js"),
    import("../app-part3.js"),
    import("../app-part4.js"),
    import("../app-part5.js"),
    import("../app-operations.js"),
    import("../app-access.js"),
    import("../app-communications.js"),
    import("../app-realtime.js"),
    import("../app-discipline.js"),
    import("../app-workflows.js"),
    import("../app-admin.js"),
    import("../app-data.js"),
  ]);
  const state = core.state as unknown as TeamState,
    db = core.db as SupabaseClient;
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
  let navigationGuard: (() => boolean) | null = null;
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
  const navigate = (page: Page) => {
    if (state.trainingDraft?.saving || (navigationGuard && !navigationGuard()))
      return false;
    const changed = state.page !== page;
    state.page = page;
    if (changed && page === "training") state.trainingMode = "hub";
    core.render();
    if (changed) window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  };
  communications.setCommunicationsPresenter(() => navigate("communications"));
  realtime.onCommunicationsChanged(() =>
    emit({ communicationRevision: snapshot.communicationRevision + 1 }),
  );
  ops.registerOperations();
  workflows.registerWorkflows();
  discipline.registerDiscipline();
  communications.registerCommunications();
  const features: Partial<Record<Page, () => string>> = {
    dashboard: ops.dashboard,
    training: workflows.trainingPage,
    reports: reports.reportsPage,
    register: parts4.registerPage,
  };
  const binders: Partial<Record<Page, () => void>> = {
    dashboard: core.bindDashboard,
    training: workflows.bindTraining,
    reports: reports.bindReports,
    register: parts4.bindRegister,
  };
  const scoped = core.teamRequestGuard;
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
    setNavigationGuard: (guard) => {
      navigationGuard = guard;
    },
    render: core.render,
    featureHtml: (page) => features[page]?.() ?? "",
    bindFeature: (page, root) => {
      binders[page]?.();
      team.bindTeamLinks();
      access.applyRoleControls();
      root
        .querySelectorAll<HTMLElement>("[data-page]")
        .forEach(
          (el) => (el.onclick = () => navigate(el.dataset.page as Page)),
        );
    },
    actions: {
      newTraining: () =>
        training.planningModal({ activity_type: "Allenamento" }),
      newMeeting: () => training.planningModal({ activity_type: "Riunione" }),
      openActivity: team.openActivity,
      newMatch: () => parts4.matchModal(),
      openMatch: parts4.matchModal,
      users: admin.usersModal,
      expiries: team.expiryModal,
      discipline: discipline.disciplineModal,
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
        const { error } = await db
          .from("players")
          .update(values)
          .eq("id", player.id)
          .eq("user_id", core.teamOwner());
        if (error) throw error;
        if (current()) await core.refresh();
      },
      resumeAttendance: () => {
        state.trainingMode = "actual";
        core.render();
      },
      hasAttendanceDraft: () =>
        !!state.trainingDraft && parts3.draftChanged(state.trainingDraft),
      reload: core.refresh,
      logout: async () => {
        if (navigationGuard && !navigationGuard()) return;
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
      changeSeason: async (year) => {
        state.seasonYear = year;
        await core.refresh();
      },
      season: data.sportSeason,
    },
  };
}
