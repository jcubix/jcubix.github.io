import { useLayoutEffect, useRef } from "react";
import {
  calculateMatchMinutes,
  refreshMatchTimeline,
} from "../../app-match-minutes.js";
import { sortPlayers, teamOwner } from "../../app-part1.js";
import { canOperateRole } from "../../app-roles.ts";
import { useEditor } from "../operational-ui";
import type { MatchEvent, Runtime } from "../types";
import { ui, type Surface } from "../ui-service";
export function useEventEditor({
  runtime,
  surface,
  inline = false,
  onClose,
  onSaved,
  onGuard,
  onType,
}: {
  runtime: Runtime;
  surface: Surface;
  inline?: boolean;
  onClose?: () => void;
  onSaved?: () => Promise<void>;
  onGuard?: (guard: (() => Promise<boolean>) | null) => void;
  onType?: (type: string, team?: string) => void;
}) {
  const input = surface.data as {
      matchId: string;
      type: string;
      event?: Partial<MatchEvent>;
      context?: { team?: "own" | "opponent" };
    },
    event = input.event || {},
    match = runtime.state.matches.find((m) => m.id === input.matchId),
    activity = runtime.state.activities.find(
      (a) => a.match_id === input.matchId,
    ),
    request = useRef(crypto.randomUUID()),
    persisted = useRef(false),
    deleted = useRef(false);
  const editor = useEditor(runtime, surface, {
    type: event.event_type || input.type,
    minute: event.minute == null ? "" : String(event.minute),
    player_id: event.player_id || "",
    outgoing_player_id: event.outgoing_player_id || "",
    detail: event.detail || "",
    team:
      input.context?.team ||
      ((event.event_type || input.type) === "Gol" && !event.player_id
        ? "opponent"
        : "own"),
  });
  const v = editor.value,
    roster = runtime.state.roster.filter((r) => r.activity_id === activity?.id),
    players = sortPlayers(
      runtime.state.players.filter(
        (p) =>
          p.active ||
          roster.some((r) => r.player_id === p.id) ||
          p.id === event.player_id ||
          p.id === event.outgoing_player_id,
      ),
    );
  useLayoutEffect(() => {
    onGuard?.(editor.canLeave);
    return () => onGuard?.(null);
  }, [onGuard, editor.canLeave]);
  useLayoutEffect(() => onType?.(v.type, v.team), [v.type, v.team, onType]);
  const finish = async () => {
    if (onClose) onClose();
    else await editor.close();
  };
  const saved = async () => {
    if (onSaved) await onSaved();
    else {
      await refreshMatchTimeline(input.matchId);
      runtime.render();
    }
  };
  const chronological = runtime.state.events
    .filter((e) => e.match_id === input.matchId && e.id !== event.id)
    .sort(
      (a, b) =>
        (a.minute ?? Infinity) - (b.minute ?? Infinity) ||
        String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
        a.id.localeCompare(b.id),
    );
  const onPitch = new Set(
      roster
        .filter((r) => r.called && r.lineup === "Titolare")
        .map((r) => r.player_id),
    ),
    used = new Set(onPitch);
  for (const e of chronological.filter(
    (e) => e.minute != null && e.minute <= Number(v.minute),
  )) {
    if (e.event_type === "Sostituzione") {
      onPitch.delete(e.outgoing_player_id!);
      onPitch.add(e.player_id!);
      used.add(e.player_id!);
    }
    if (e.event_type === "Espulsione") {
      onPitch.delete(e.player_id!);
      used.add(e.player_id!);
    }
  }
  let minutesPreview = "";
  if (v.type === "Sostituzione") {
    if (!match?.minutes_auto)
      minutesPreview =
        "Minuti manuali: attiva il calcolo automatico nelle impostazioni della partita.";
    else if (!v.player_id || !v.outgoing_player_id || v.minute === "")
      minutesPreview = `Gara da ${match.duration_minutes ?? 90}′ · Scegli chi esce, chi entra e il minuto.`;
    else
      try {
        const minutes = calculateMatchMinutes(
          match.duration_minutes ?? 90,
          roster,
          [
            ...chronological,
            {
              ...event,
              id: event.id || request.current,
              created_at: event.created_at || new Date().toISOString(),
              event_type: v.type,
              player_id: v.player_id,
              outgoing_player_id: v.outgoing_player_id,
              minute: Number(v.minute),
            },
          ],
        );
        minutesPreview = `Uscente: ${minutes.get(v.outgoing_player_id)}′ · Subentrato: ${minutes.get(v.player_id)}′`;
      } catch (error) {
        minutesPreview = (error as Error).message;
      }
  }
  const save = () =>
    editor.run(async () => {
      if (deleted.current) {
        await saved();
        await finish();
        ui.notify("Evento eliminato");
        return;
      }
      if (!match || !canOperateRole(runtime.state.team?.role || ""))
        throw Error("Operazione non consentita");
      const minute = v.minute === "" ? null : Number(v.minute);
      if (
        minute !== null &&
        (!Number.isInteger(minute) || minute < 0 || minute > 130)
      )
        throw Error("Il minuto deve essere un intero da 0 a 130");
      if (v.type === "Gol" && v.team === "own" && !v.player_id)
        throw Error(
          "Seleziona il marcatore Eburum. Per gli avversari usa Gol avversari.",
        );
      if (
        v.type === "Sostituzione" &&
        (!v.player_id ||
          !v.outgoing_player_id ||
          v.player_id === v.outgoing_player_id ||
          minute === null)
      )
        throw Error(
          "Seleziona due giocatori diversi e il minuto della sostituzione",
        );
      if (
        v.type === "Espulsione" &&
        v.player_id &&
        match.minutes_auto &&
        minute === null
      )
        throw Error(
          "Indica il minuto dell’espulsione per calcolare i minuti giocati",
        );
      if (v.type === "Nota" && !v.detail.trim())
        throw Error("Inserisci il testo della nota");
      const row = {
        user_id: teamOwner(),
        match_id: input.matchId,
        player_id:
          v.type === "Gol" && v.team === "opponent"
            ? null
            : v.player_id || null,
        minute,
        event_type: v.type,
        detail: v.detail.trim() || null,
        outgoing_player_id:
          v.type === "Sostituzione" ? v.outgoing_player_id : null,
      };
      if (
        !persisted.current &&
        match.minutes_auto &&
        ["Sostituzione", "Espulsione"].includes(v.type)
      )
        calculateMatchMinutes(match.duration_minutes ?? 90, roster, [
          ...chronological,
          {
            ...event,
            ...row,
            id: event.id || request.current,
            created_at: event.created_at || new Date().toISOString(),
          },
        ]);
      if (!persisted.current) {
        const query = event.id
          ? runtime.db
              .from("match_events")
              .update(row)
              .eq("id", event.id)
              .eq("match_id", input.matchId)
              .eq("user_id", teamOwner())
          : runtime.db
              .from("match_events")
              .insert({ ...row, id: request.current });
        let { data, error } = await query.select().single();
        if (error?.code === "23505" && !event.id) {
          const prior = await runtime.db
            .from("match_events")
            .select("*")
            .eq("id", request.current)
            .eq("match_id", input.matchId)
            .eq("user_id", teamOwner())
            .single();
          if (
            !prior.error &&
            prior.data &&
            Object.entries(row).every(([k, val]) => prior.data[k] === val)
          ) {
            data = prior.data;
            error = null;
          }
        }
        if (error) throw error;
        if (!data?.id) throw Error("Risposta del salvataggio non valida");
        persisted.current = true;
        if (editor.current())
          runtime.state.events = runtime.state.events
            .filter((e) => e.id !== data.id)
            .concat(data);
      }
      if (!editor.current()) return;
      try {
        await saved();
      } catch (cause) {
        editor.clean();
        throw Error(
          "Evento salvato. Ricarica i dati prima di aggiungere altri eventi: " +
            (cause as Error).message,
        );
      }
      await finish();
      ui.notify("Evento salvato");
    });

  return {
    deleted,
    editor,
    event,
    finish,
    inline,
    input,
    minutesPreview,
    onPitch,
    persisted,
    players,
    roster,
    runtime,
    save,
    saved,
    surface,
    used,
    v,
  };
}
