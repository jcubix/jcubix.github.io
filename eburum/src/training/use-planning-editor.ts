import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sortPlayers, today } from "../../app-part1.js";
import { canOperateRole, canPlanRole } from "../../app-roles.ts";
import { startActualAttendance } from "../../app-workflows.js";
import { useEditor } from "../operational-ui";
import type { Activity, RosterRow, Runtime } from "../types";
import { ui, type Surface } from "../ui-service";
import { PlanValues } from "./model";
export function usePlanningEditor({
  runtime,
  surface,
  inline = false,
}: {
  runtime: Runtime;
  surface: Surface;
  inline?: boolean;
}) {
  const navigate = useNavigate();
  const data = surface.data as {
      activity: Partial<Activity>;
      rows?: RosterRow[];
    },
    a = useRef(data.activity).current,
    rows = data.rows || [],
    legacy =
      !!a.session_id &&
      runtime.state.sessions.find((s) => s.id === a.session_id)
        ?.attendance_mode !== "absence_notice";
  const ids = new Set(rows.map((r) => r.player_id)),
    players = sortPlayers(
      runtime.state.players.filter((p) => p.active || ids.has(p.id)),
    ),
    revision = useRef(a.revision ?? null),
    request = useRef(a.request_id || crypto.randomUUID());
  const initial: PlanValues = {
    notes: Object.fromEntries(
      players.map((p) => [
        p.id,
        rows.find((r) => r.player_id === p.id)?.response_note || "",
      ]),
    ),
    title: a.title || "Allenamento",
    activity_date: a.activity_date || today(),
    start_time: a.start_time?.slice(0, 5) || "",
    end_time: a.end_time?.slice(0, 5) || "",
    location: a.location || "",
    status: a.status || "Programmato",
    organization_note: a.organization_note || "",
    replies: Object.fromEntries(
      players.map((p) => [
        p.id,
        legacy
          ? rows.find((r) => r.player_id === p.id)?.availability || "In attesa"
          : rows.find((r) => r.player_id === p.id)?.availability ===
              "Indisponibile"
            ? "Indisponibile"
            : "Disponibile",
      ]),
    ),
  };
  const editor = useEditor(runtime, surface, initial),
    baselineReplies = useRef(initial.replies),
    baselineNotes = useRef(initial.notes),
    [phase, setPhase] = useState(a.session_id ? "actual" : "poll"),
    [search, setSearch] = useState(""),
    [pendingOnly, setPendingOnly] = useState(false);
  const operate = canOperateRole(runtime.state.team?.role || ""),
    plan = canPlanRole(runtime.state.team?.role || ""),
    training = a.activity_type !== "Riunione";
  useEffect(() => {
    if (!inline) return;
    runtime.setNavigationGuard(editor.canLeave);
    return () => runtime.setNavigationGuard(null);
  }, [runtime, inline, editor.canLeave]);
  const v = editor.value,
    pending = players.filter(
      (p) => v.replies[p.id] === (legacy ? "In attesa" : "Indisponibile"),
    ),
    count = Object.keys(v.replies).filter(
      (id) =>
        v.replies[id] !== baselineReplies.current[id] ||
        v.notes[id] !== baselineNotes.current[id],
    ).length;
  const save = () =>
    editor.run(async () => {
      if (!operate) throw Error("Modifica riservata allo staff autorizzato");
      if (!v.title.trim() || !v.activity_date)
        throw Error("Inserisci titolo e data");
      if (v.start_time && v.end_time && v.end_time <= v.start_time)
        throw Error("La fine deve essere successiva all’inizio");
      const { replies, notes, ...fields } = v;
      const { data: saved, error } = await runtime.db.rpc(
        "save_team_activity",
        {
          p_activity: {
            ...fields,
            title: fields.title.trim(),
            activity_type: training ? "Allenamento" : "Riunione",
            start_time: v.start_time || null,
            end_time: v.end_time || null,
            location: v.location.trim() || null,
            organization_note: v.organization_note.trim() || null,
            meeting_time: a.meeting_time || null,
            meeting_place: a.meeting_place || null,
            request_id: request.current,
          },
          p_roster: (training
            ? players.map((p) => ({
                player_id: p.id,
                availability: replies[p.id],
                response_note: notes[p.id]?.trim() || null,
              }))
            : rows
          ).map((r) => ({
            ...r,
            called: false,
            lineup: "Non impiegato",
            position: null,
            minutes_played: 0,
          })),
          p_id: a.id || null,
          p_revision: revision.current,
          p_technical: null,
        },
      );
      if (error) throw error;
      if (!saved?.id) throw Error("Risposta del salvataggio non valida");
      if (!editor.current()) return;
      revision.current = saved.revision;
      baselineReplies.current = { ...replies };
      baselineNotes.current = { ...notes };
      editor.reset({ ...v });
      if (!inline) await editor.close();
      if (
        !(await runtime.actions.reloadAffected({
          kind: "activity",
          id: saved.id,
        }))
      )
        return;
      if (!inline && !a.id && training)
        await runtime.actions.openActivity(saved.id);
      ui.notify(
        training
          ? a.id
            ? "Allenamento e assenze salvati"
            : "Allenamento creato"
          : "Riunione salvata",
      );
    });
  const actual = async () => {
    if (editor.busy || !operate) return;
    if (editor.dirty)
      return editor.setError(
        "Salva le modifiche e le assenze comunicate prima di aprire le presenze",
      );
    if (!a.id) return editor.setError("Salva prima l’allenamento");
    const opened = await startActualAttendance(
      runtime.state.activities.find((row) => row.id === a.id) || a,
    );
    if (opened && !inline) {
      await editor.close({ restoreRoute: false });
      const session = runtime.state.trainingDraft?.id;
      navigate(
        session
          ? "/training?session=" + encodeURIComponent(session)
          : "/training",
        { replace: true },
      );
    }
  };

  return {
    a,
    actual,
    count,
    editor,
    inline,
    legacy,
    operate,
    pending,
    pendingOnly,
    phase,
    plan,
    players,
    runtime,
    save,
    search,
    setPendingOnly,
    setPhase,
    setSearch,
    surface,
    training,
    v,
  };
}
