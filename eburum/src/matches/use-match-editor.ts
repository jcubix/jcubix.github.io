import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { confirmDialog } from "../../app-confirm.js";
import { isAwayMatch } from "../../app-match-display.js";
import { refreshMatchTimeline } from "../../app-match-minutes.js";
import { sortPlayers, today } from "../../app-part1.js";
import {
  canOperateRole,
  canPlanRole,
  canTechnicalRole,
} from "../../app-roles.ts";
import { matchReview } from "../../app-workflow-tools.js";
import { useEditor } from "../operational-ui";
import type { Activity, RosterRow, Runtime, Technical } from "../types";
import { ui, type Surface } from "../ui-service";
import { Composer, MatchForm } from "./model";
export function useMatchEditor({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const data = surface.data as {
      activity: Partial<Activity>;
      rows?: RosterRow[];
      technical?: Technical;
      tab?: string;
    },
    a = useRef({ ...data.activity }).current,
    request = useRef(crypto.randomUUID()),
    m = runtime.state.matches.find((m) => m.id === a.match_id),
    role = runtime.state.team?.role || "",
    plan = canPlanRole(role),
    technical = canTechnicalRole(role),
    operate = canOperateRole(role);
  const players = sortPlayers(
      runtime.state.players.filter(
        (p) => p.active || data.rows?.some((r) => r.player_id === p.id),
      ),
    ),
    initial: MatchForm = {
      activity: {
        title: a.title || "",
        activity_date: a.activity_date || today(),
        start_time: a.start_time?.slice(0, 5) || "",
        end_time: a.end_time?.slice(0, 5) || "",
        location: a.location || "",
        status: a.status || "Programmato",
        meeting_time: a.meeting_time?.slice(0, 5) || "",
        meeting_place: a.meeting_place || "",
        organization_note: a.organization_note || "",
        venue: m?.venue || a.venue || "Casa",
      },
      rows: players.map((p) => ({
        player_id: p.id,
        activity_id: a.id || "",
        availability: "In attesa",
        called: false,
        lineup: "Non impiegato",
        position: null,
        minutes_played: 0,
        ...data.rows?.find((r) => r.player_id === p.id),
      })),
      technical: {
        formation: data.technical?.formation || "",
        note: data.technical?.note || "",
      },
      result: {
        goals_for: m?.goals_for == null ? "" : String(m.goals_for),
        goals_against: m?.goals_against == null ? "" : String(m.goals_against),
        duration_minutes: String(m?.duration_minutes ?? 90),
        minutes_auto: m?.minutes_auto ?? true,
        venue: m?.venue || "Casa",
        note: m?.note || "",
      },
    };
  const editor = useEditor(runtime, surface, initial),
    v = editor.value,
    [tab, setTab] = useState(
      a.id
        ? data.tab === "roster"
          ? "roster"
          : data.tab === "details"
            ? "details"
            : "results"
        : "details",
    ),
    [search, setSearch] = useState(""),
    [onlyCalled, setOnlyCalled] = useState(false),
    [composer, setComposer] = useState<Composer | null>(null),
    [selected, setSelected] = useState<{ type: string; team?: string } | null>(
      null,
    ),
    [callup, setCallup] = useState<string | null>(null),
    [reloadError, setReloadError] = useState("");
  const onEventType = useCallback(
    (type: string, team?: string) =>
      setSelected((previous) =>
        previous?.type === type && previous?.team === team
          ? previous
          : { type, team },
      ),
    [],
  );
  const canLeave = editor.canLeave;
  const eventGuard = useRef<(() => Promise<boolean>) | null>(null),
    baseOrg = useRef(
      JSON.stringify({
        activity: initial.activity,
        rows: initial.rows,
        technical: initial.technical,
      }),
    ),
    baseResult = useRef(JSON.stringify(initial.result));
  const orgDirty =
      JSON.stringify({
        activity: v.activity,
        rows: v.rows,
        technical: v.technical,
      }) !== baseOrg.current,
    resultDirty = JSON.stringify(v.result) !== baseResult.current;
  useLayoutEffect(
    () =>
      ui.guard(
        surface.id,
        async () =>
          !(eventGuard.current && !(await eventGuard.current())) &&
          (await canLeave()),
      ),
    [surface.id, canLeave],
  );
  const events = runtime.state.events
    .filter((e) => e.match_id === a.match_id)
    .sort(
      (x, y) =>
        (x.minute ?? Infinity) - (y.minute ?? Infinity) ||
        String(x.created_at || "").localeCompare(String(y.created_at || "")) ||
        x.id.localeCompare(y.id),
    );
  const reload = async () => {
    if (!a.match_id) return;
    try {
      const snapshot = await refreshMatchTimeline(a.match_id);
      if (!editor.current() || !snapshot) return;
      Object.assign(a, snapshot.activity);
      const result = {
        goals_for:
          snapshot.match.goals_for == null
            ? ""
            : String(snapshot.match.goals_for),
        goals_against:
          snapshot.match.goals_against == null
            ? ""
            : String(snapshot.match.goals_against),
        duration_minutes: String(snapshot.match.duration_minutes ?? 90),
        minutes_auto: snapshot.match.minutes_auto ?? true,
        venue: snapshot.match.venue,
        note: snapshot.match.note || "",
      };
      const next = {
        ...v,
        rows: players.map(
          (p) =>
            snapshot.roster.find((r) => r.player_id === p.id) ||
            v.rows.find((r) => r.player_id === p.id)!,
        ),
        result,
      };
      baseOrg.current = JSON.stringify({
        activity: next.activity,
        rows: next.rows,
        technical: next.technical,
      });
      baseResult.current = JSON.stringify(result);
      editor.reset(next);
      setReloadError("");
      runtime.render();
    } catch (cause) {
      setReloadError("Dati da ricaricare: " + (cause as Error).message);
      throw cause;
    }
  };
  const saveOrganization = () =>
    editor.run(async () => {
      if (!operate) throw Error("Operazione non consentita");
      if (resultDirty)
        throw Error("Salva risultato e note prima di salvare l’organizzazione");
      if (!plan && a.id) {
        const { error } = await runtime.db.rpc("save_activity_observation", {
          p_id: a.id,
          p_revision: a.revision,
          p_note: v.technical.note.trim() || null,
        });
        if (error) throw error;
      } else {
        if (!v.activity.title.trim() || !v.activity.activity_date)
          throw Error("Inserisci titolo e data");
        if (
          v.activity.start_time &&
          v.activity.end_time &&
          v.activity.end_time <= v.activity.start_time
        )
          throw Error("La fine deve essere successiva all’inizio");
        if (
          v.rows.filter((r) => r.called && r.lineup === "Titolare").length > 11
        )
          throw Error("Al massimo 11 titolari");
        if (v.activity.status === "Concluso" && a.status !== "Concluso" && m) {
          if (m.goals_for == null || m.goals_against == null)
            throw Error("Salva il risultato prima di concludere la partita");
          const issues = matchReview(m, v.rows, events);
          if (
            issues.length &&
            !(await confirmDialog({
              title: "Controllo prima della chiusura",
              message: "Prima di concludere verifica:\n" + issues.join("\n"),
              confirmLabel: "Concludi",
            }))
          )
            return;
        }
        if (!editor.current()) return;
        const { data: saved, error } = await runtime.db.rpc(
          "save_team_activity",
          {
            p_activity: {
              ...v.activity,
              activity_type: "Partita",
              title: v.activity.title.trim(),
              request_id: request.current,
            },
            p_roster: v.rows.map(
              ({
                player_id,
                called,
                availability,
                response_note,
                lineup,
                position,
                minutes_played,
              }) => ({
                player_id,
                called,
                availability,
                response_note: response_note || null,
                lineup,
                position,
                minutes_played,
              }),
            ),
            p_id: a.id || null,
            p_revision: a.revision ?? null,
            p_technical: technical
              ? {
                  formation: v.technical.formation.trim() || null,
                  note: v.technical.note.trim() || null,
                }
              : null,
          },
        );
        if (error) throw error;
        if (!saved?.id) throw Error("Risposta del salvataggio non valida");
        if (!editor.current()) return;
        const existing = !!a.id;
        Object.assign(a, saved);
        if (!existing) {
          await editor.close();
          if (
            !(await runtime.actions.reloadAffected({
              kind: "activity",
              id: saved.id,
            }))
          )
            return;
          await runtime.actions.openActivity(saved.id);
          return;
        }
      }
      if (!editor.current()) return;
      baseOrg.current = JSON.stringify({
        activity: v.activity,
        rows: v.rows,
        technical: v.technical,
      });
      editor.clean();
      await reload();
      editor.setError(
        plan
          ? "Partita e convocazioni salvate"
          : "Osservazioni tecniche salvate",
      );
    });
  const saveResult = () =>
    editor.run(async () => {
      if (!m || !operate) throw Error("Operazione non consentita");
      if (orgDirty)
        throw Error(
          "Salva organizzazione e convocazioni prima di aggiornare il risultato",
        );
      const goals_for =
          v.result.goals_for === "" ? null : Number(v.result.goals_for),
        goals_against =
          v.result.goals_against === "" ? null : Number(v.result.goals_against),
        duration_minutes = Number(v.result.duration_minutes);
      if (
        [goals_for, goals_against].some(
          (n) => n !== null && (!Number.isInteger(n) || n < 0 || n > 99),
        )
      )
        throw Error("Punteggi interi tra 0 e 99");
      if ((goals_for === null) !== (goals_against === null))
        throw Error("Inserisci entrambi i punteggi oppure lasciali vuoti");
      if (
        !Number.isInteger(duration_minutes) ||
        duration_minutes < 1 ||
        duration_minutes > 130
      )
        throw Error("Durata intera da 1 a 130 minuti");
      if (
        v.result.minutes_auto &&
        m.minutes_auto === false &&
        !(await confirmDialog({
          message:
            "Ricalcolare i minuti di questa partita dai titolari e dagli eventi? I minuti inseriti manualmente saranno sostituiti.",
          confirmLabel: "Ricalcola minuti",
        }))
      )
        return;
      if (!editor.current()) return;
      const { data: saved, error } = await runtime.db.rpc("save_match_result", {
        p_id: m.id,
        p_revision: a.revision,
        p_values: {
          goals_for,
          goals_against,
          duration_minutes,
          minutes_auto: v.result.minutes_auto,
          venue: v.result.venue,
          note: v.result.note.trim() || null,
        },
      });
      if (error) throw error;
      if (!editor.current()) return;
      runtime.state.matches = runtime.state.matches
        .filter((row) => row.id !== saved.id)
        .concat(saved);
      baseResult.current = JSON.stringify(v.result);
      editor.clean();
      await reload();
      ui.notify("Partita e minuti salvati");
    });
  const openComposer = async (next: Composer) => {
    if (editor.dirty)
      return editor.setError(
        "Salva le modifiche alla partita prima di aggiungere eventi",
      );
    if (reloadError) return;
    if (eventGuard.current && !(await eventGuard.current())) return;
    setComposer(next);
    setSelected({ type: next.type, team: next.team });
  };
  const chooseTab = async (next: string) => {
    if (eventGuard.current && !(await eventGuard.current())) return;
    setComposer(null);
    setSelected(null);
    setTab(next);
  };
  const tabs = [
      ...(a.match_id ? [["results", "Gara"]] : []),
      ["roster", "Convocati"],
      ["details", "Impostazioni"],
    ],
    called = v.rows.filter((r) => r.called),
    starters = called.filter((r) => r.lineup === "Titolare");

  const resultFields = [
    { id: "matchGoalsFor", label: "Eburum", key: "goals_for" as const },
    {
      id: "matchGoalsAgainst",
      label: m?.opponent || a.title || "Avversario",
      key: "goals_against" as const,
    },
  ];
  if (isAwayMatch(v.result)) resultFields.reverse();

  return {
    a,
    called,
    callup,
    chooseTab,
    composer,
    editor,
    eventGuard,
    events,
    m,
    onEventType,
    onlyCalled,
    openComposer,
    operate,
    plan,
    players,
    reload,
    reloadError,
    resultFields,
    role,
    runtime,
    saveOrganization,
    saveResult,
    search,
    selected,
    setCallup,
    setComposer,
    setOnlyCalled,
    setSearch,
    setSelected,
    starters,
    surface,
    tab,
    tabs,
    technical,
    v,
  };
}
