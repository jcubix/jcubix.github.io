import { routeDetail } from "../app-presentation.js";
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
    dialogs,
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
    import("../app-dialogs.js"),
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
      state.trainingMode !== "actual" &&
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
  dialogs.setDialogDetailPresenter((root: HTMLElement) => {
    const page = root.dataset.page as Page,
      key = root.dataset.detail!;
    if (page !== state.page) {
      rememberScroll();
      state.page = page;
      core.render();
    }
    if (
      routeDetail(page, window.location.hash.split("?")[1] || "")?.key !== key
    )
      detailRouter?.({ page, key });
    const observer = new MutationObserver(() => {
      if (root.isConnected) return;
      observer.disconnect();
      queueMicrotask(() => {
        if (!detailRouter) return;
        if (
          !root.dataset.keepRoute &&
          state.page === page &&
          routeDetail(page, window.location.hash.split("?")[1] || "")?.key ===
            key &&
          ![...document.querySelectorAll<HTMLElement>("[data-detail]")].some(
            (r) => r.dataset.detail === key,
          )
        )
          detailRouter?.(null);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  const syncDetail = async (page: Page, search: string) => {
    const detail = routeDetail(page, search);
    if (
      detail?.key === "session:" + state.trainingDraft?.id &&
      state.trainingMode === "actual"
    )
      return true;
    if (
      detail &&
      [...document.querySelectorAll<HTMLElement>("[data-detail]")].some(
        (root) => root.dataset.detail === detail.key,
      )
    )
      return true;
    const roots = [
      ...document.querySelectorAll<HTMLElement>(".modal-back[data-detail]"),
    ];
    if (detail && roots.some((r) => r.dataset.detail === detail.key))
      return true;
    if (
      !detail &&
      page === "training" &&
      state.page === "training" &&
      state.trainingMode === "actual" &&
      !!state.trainingDraft?.id
    ) {
      if (!canLeaveAttendance()) return false;
      state.trainingMode = "hub";
      core.render();
    }
    if (!detail && !roots.length) return true;
    if (navigationGuard && !navigationGuard()) return false;
    if (!dialogs.closeWorkspaceEditors()) return false;
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
        parts4.matchModal();
      } else if (match) parts4.matchModal(match);
      else throw Error("Partita non disponibile nella stagione selezionata.");
    } else if (kind === "activity") {
      if (id === "new") {
        if (!core.canPlan())
          throw Error("Creazione riservata allo staff autorizzato.");
        training.planningModal({
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
      parts3.editAttendanceSession(id);
    } else if (kind === "discipline") discipline.disciplineModal(id);
    else if (kind === "tool") {
      if (id === "users" && core.isAdmin()) admin.usersModal();
      else if (id === "expiries" && core.canViewExpiries()) team.expiryModal();
      else if (id === "discipline") discipline.disciplineModal();
      else throw Error("Sezione non disponibile per il tuo ruolo.");
    }
    return true;
  };
  function canLeaveAttendance() {
    return (
      state.trainingMode !== "actual" ||
      !state.trainingDraft ||
      !parts3.draftChanged(state.trainingDraft) ||
      window.confirm(
        "Uscire dalle presenze non salvate? La bozza resta disponibile in questa sessione.",
      )
    );
  }
  const navigate = (page: Page) => {
    if (
      state.trainingDraft?.saving ||
      !canLeaveAttendance() ||
      (navigationGuard && !navigationGuard()) ||
      !dialogs.closeWorkspaceEditors()
    )
      return false;
    const changed = state.page !== page;
    if (changed) rememberScroll();
    state.page = page;
    if (changed && page === "training") state.trainingMode = "hub";
    core.render();
    return true;
  };
  communications.setCommunicationsPresenter(() => navigate("communications"));
  dialogs.setWorkspaceEditorPresenter((root: HTMLElement) => {
    const host = document.getElementById("workspaceEditor");
    if (!host) return false;
    host.append(root);
    const page: Page =
      (root.dataset.page as Page) ||
      (root.querySelector("#activityForm")
        ? "matches"
        : root.querySelector(".training-replies")
          ? state.page === "register"
            ? "register"
            : "training"
          : "meetings");
    if (state.page !== page) rememberScroll();
    state.page = page;
    core.render();
    return true;
  });
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
  const changeSeason = async (year: number) => {
    if (
      state.trainingDraft?.saving ||
      !canLeaveAttendance() ||
      (navigationGuard && !navigationGuard()) ||
      !dialogs.closeWorkspaceEditors()
    )
      return;
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
    requestGuard: core.teamRequestGuard,
    render: core.render,
    featureHtml: (page) => features[page]?.() ?? "",
    bindFeature: (page, root) => {
      binders[page]?.();
      team.bindTeamLinks();
      access.applyRoleControls();
      root.querySelectorAll<HTMLElement>("[data-open-match]").forEach(
        (button) =>
          (button.onclick = () => {
            const match = state.matches.find(
              (m) => m.id === button.dataset.openMatch,
            );
            if (match) parts4.matchModal(match);
          }),
      );
      root.querySelectorAll<HTMLElement>("[data-resume-attendance]").forEach(
        (el) =>
          (el.onclick = () => {
            if (navigate("training")) {
              state.trainingMode = "actual";
              core.render();
            }
          }),
      );
      root
        .querySelectorAll<HTMLElement>("[data-page]")
        .forEach(
          (el) => (el.onclick = () => navigate(el.dataset.page as Page)),
        );
    },
    actions: {
      pollEntries: workflows.pollEntries,
      newTraining: () =>
        training.planningModal({ activity_type: "Allenamento" }),
      openActivity: team.openActivity,
      mountTrainingReplies: (host, activity) =>
        training.planningModal(
          activity,
          state.roster.filter(
            (r: { activity_id: string }) => r.activity_id === activity.id,
          ),
          host,
        ),
      newMatch: () => parts4.matchModal(),
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
      logout: async () => {
        if (state.trainingDraft?.saving) return;
        if (navigationGuard && !navigationGuard()) return;
        if (
          state.trainingDraft &&
          parts3.draftChanged(state.trainingDraft) &&
          !confirm("Uscire e scartare la bozza presenze non salvata?")
        )
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
