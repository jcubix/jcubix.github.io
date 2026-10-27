import { Fragment, useLayoutEffect, useRef, useState } from "react";
import {
  CircleDot,
  RectangleVertical,
  ArrowLeftRight,
  Plus,
  Pencil,
} from "lucide-react";
import { Button } from "./components/ui/button";
import {
  EditorFrame,
  Field,
  Feedback,
  CopyText,
  useEditor,
} from "./operational-ui";
import { ui, type Surface } from "./ui-service";
import type {
  Runtime,
  Activity,
  MatchEvent,
  RosterRow,
  Technical,
} from "./types";
import { fmt, today, teamOwner, sortPlayers } from "../app-part1.js";
import { canOperateRole, canPlanRole, canTechnicalRole } from "../app-roles.js";
import { matchTitle, isAwayMatch } from "../app-match-display.js";
import { EVENT_TYPES, eventTone } from "../app-part4.js";
import {
  calculateMatchMinutes,
  refreshMatchTimeline,
} from "../app-match-minutes.js";
import { matchReview } from "../app-workflow-tools.js";
import { dismissalAlert } from "../app-dismissals.js";
import { callupMessage } from "../app-operations.js";
import { confirmDialog } from "../app-confirm.js";

type Composer = {
  type: string;
  team?: "own" | "opponent";
  event?: Partial<MatchEvent>;
};
type MatchForm = {
  activity: {
    title: string;
    activity_date: string;
    start_time: string;
    end_time: string;
    location: string;
    status: string;
    meeting_time: string;
    meeting_place: string;
    organization_note: string;
    venue: string;
  };
  rows: RosterRow[];
  technical: { formation: string; note: string };
  result: {
    goals_for: string;
    goals_against: string;
    duration_minutes: string;
    minutes_auto: boolean;
    venue: string;
    note: string;
  };
};
export function EventEditor({
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
  }, [onGuard]);
  useLayoutEffect(() => onType?.(v.type, v.team), [v.type, v.team]);
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
  const content = (
    <>
      <div className="event-types" hidden={!!input.context?.team}>
        <div role="group" aria-label="Tipo evento">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              data-event-type={type}
              aria-pressed={v.type === type}
              className={v.type === type ? "selected" : ""}
              disabled={editor.busy || persisted.current}
              onClick={() =>
                editor.setValue({
                  ...v,
                  type,
                  ...(type === "Gol" && !v.player_id
                    ? { team: "opponent" }
                    : {}),
                })
              }
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      <form
        id="eventForm"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void save();
        }}
      >
        <fieldset disabled={editor.busy || persisted.current}>
          <div className="form-grid event-fields">
            <Field
              id="eventMinute"
              label={
                v.type === "Sostituzione"
                  ? "Minuto del cambio"
                  : v.type === "Espulsione"
                    ? "Minuto dell’espulsione"
                    : "Minuto (facoltativo)"
              }
            >
              <input
                id="eventMinute"
                type="number"
                inputMode="numeric"
                min={0}
                max={130}
                step={1}
                required={v.type === "Sostituzione"}
                placeholder="Es. 65"
                value={v.minute}
                onChange={(e) =>
                  editor.setValue({ ...v, minute: e.target.value })
                }
              />
            </Field>
            {v.type === "Sostituzione" ? (
              <Field id="eventOutgoing" label="Esce">
                <select
                  id="eventOutgoing"
                  value={v.outgoing_player_id}
                  onChange={(e) =>
                    editor.setValue({
                      ...v,
                      outgoing_player_id: e.target.value,
                    })
                  }
                >
                  <option value="">Seleziona uscente</option>
                  {players
                    .filter(
                      (p) =>
                        onPitch.has(p.id) || p.id === event.outgoing_player_id,
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.surname} {p.name}
                      </option>
                    ))}
                </select>
              </Field>
            ) : null}
            {
              <div
                data-event-person
                hidden={v.type === "Gol" && input.context?.team === "opponent"}
              >
                <Field
                  id="eventPlayer"
                  label={
                    v.type === "Sostituzione"
                      ? "Entra"
                      : v.type === "Gol"
                        ? "Marcatore Eburum"
                        : "Giocatore"
                  }
                >
                  <select
                    id="eventPlayer"
                    value={v.player_id}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        player_id: e.target.value,
                        ...(v.type === "Gol"
                          ? { team: e.target.value ? "own" : "opponent" }
                          : {}),
                      })
                    }
                  >
                    <option value="">
                      {v.type === "Gol"
                        ? "Seleziona marcatore"
                        : v.type === "Sostituzione"
                          ? "Seleziona subentrato"
                          : "Giocatore non indicato"}
                    </option>
                    {players
                      .filter(
                        (p) =>
                          v.type !== "Sostituzione" ||
                          (roster.some(
                            (r) => r.player_id === p.id && r.called,
                          ) &&
                            !used.has(p.id)) ||
                          p.id === event.player_id,
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.surname} {p.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
            }
            {v.type === "Gol" && v.team === "opponent" ? (
              <p className="badge b-red">Gol Squadra avversaria</p>
            ) : null}
          </div>
          {v.type === "Gol" ? (
            <label className="event-penalty">
              <input
                id="eventPenalty"
                type="checkbox"
                checked={/^(rig|rigore|su rigore)(?:\s*·|$)/i.test(v.detail)}
                onChange={(e) =>
                  editor.setValue({
                    ...v,
                    detail: e.target.checked
                      ? v.detail.trim()
                        ? "RIG · " + v.detail.trim()
                        : "RIG"
                      : v.detail.replace(
                          /^\s*(?:Su rigore|Rigore|RIG)(?:\s*·\s*|$)/i,
                          "",
                        ),
                  })
                }
              />
              Su rigore
            </label>
          ) : null}
          <p
            id="substitutionMinutesPreview"
            className="substitution-preview"
            role="status"
            hidden={v.type !== "Sostituzione"}
          >
            {minutesPreview}
          </p>
          <details
            className="event-notes field-space"
            open={v.type === "Nota" || undefined}
          >
            <summary>Dettagli facoltativi</summary>
            <Field id="eventDetail" label="Dettagli">
              <textarea
                id="eventDetail"
                maxLength={10000}
                value={v.detail}
                onChange={(e) =>
                  editor.setValue({ ...v, detail: e.target.value })
                }
              />
            </Field>
          </details>
          <p id="eventHint" className="row-sub">
            {v.type === "Gol"
              ? "Il gol aggiorna anche il risultato."
              : v.type === "Espulsione"
                ? "Associa un giocatore per monitorare la squalifica in Cartellini e diffide."
                : v.type === "Sostituzione"
                  ? "I minuti si aggiornano al salvataggio."
                  : ""}
          </p>
        </fieldset>
        <div className={inline ? "inline-event-actions" : "modal-actions"}>
          <Button type="submit" data-save-event disabled={editor.busy}>
            {persisted.current ? "Ricarica dati" : "Salva evento"}
          </Button>
          {event.id && runtime.state.team?.role === "admin" ? (
            <Button
              id="deleteEvent"
              variant="destructive"
              disabled={editor.busy || persisted.current}
              onClick={() =>
                void editor.run(async () => {
                  if (
                    !(await confirmDialog({
                      message:
                        event.event_type === "Espulsione"
                          ? "Eliminare questa espulsione, il relativo provvedimento e le conferme delle gare scontate?"
                          : "Eliminare questo evento? Per un gol viene rettificato anche il risultato.",
                      confirmLabel: "Elimina evento",
                      danger: true,
                    }))
                  )
                    return;
                  if (
                    !editor.current() ||
                    !canOperateRole(runtime.state.team?.role || "")
                  )
                    return;
                  const { error } = await runtime.db
                    .from("match_events")
                    .delete()
                    .eq("id", event.id)
                    .eq("match_id", input.matchId)
                    .eq("user_id", teamOwner());
                  if (error) throw error;
                  deleted.current = true;
                  persisted.current = true;
                  editor.clean();
                  if (editor.current()) {
                    try {
                      await saved();
                      await finish();
                      ui.notify("Evento eliminato");
                    } catch (cause) {
                      throw Error(
                        "Evento eliminato. Ricarica i dati: " +
                          (cause as Error).message,
                      );
                    }
                  }
                })
              }
            >
              Elimina evento
            </Button>
          ) : null}
        </div>
        <Feedback id="eventFeedback" error={editor.error} />
      </form>
    </>
  );
  return inline ? (
    <section className="inline-match-event event-editor">
      <div className="inline-event-head">
        <h2>
          {event.id
            ? "Modifica evento"
            : v.type === "Gol"
              ? v.team === "opponent"
                ? "Gol Squadra avversaria"
                : "Gol Eburum"
              : "Nuovo evento"}
        </h2>
        <Button
          variant="secondary"
          id="close"
          aria-label="Chiudi evento"
          disabled={editor.busy}
          onClick={async () => {
            if (await editor.canLeave()) await finish();
          }}
        >
          Annulla
        </Button>
      </div>
      {content}
    </section>
  ) : (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={event.id ? "Modifica evento" : "Nuovo evento"}
      closeLabel="Chiudi evento"
    >
      {content}
    </EditorFrame>
  );
}

export function MatchEditor({
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
          (await editor.canLeave()),
      ),
    [surface.id],
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
          await runtime.actions.reload();
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
  if (!operate)
    return (
      <ReadOnlyActivity
        runtime={runtime}
        surface={{ ...surface, data: { activity: a } }}
      />
    );
  const resultFields = [
    { id: "matchGoalsFor", label: "Eburum", key: "goals_for" as const },
    {
      id: "matchGoalsAgainst",
      label: m?.opponent || a.title || "Avversario",
      key: "goals_against" as const,
    },
  ];
  if (isAwayMatch(v.result)) resultFields.reverse();
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={
        a.id
          ? matchTitle(m || { opponent: a.title, venue: v.activity.venue })
          : "Nuova partita"
      }
      className="activity-modal match-workspace"
      titleId="activityTitle"
      closeId="closeActivity"
      closeLabel="Chiudi attività"
    >
      {!a.id ? (
        <div className="match-new-venue">
          {" "}
          <Field id="activityVenue" label="Dove si gioca">
            <select
              id="activityVenue"
              value={v.activity.venue}
              onChange={(e) =>
                editor.setValue({
                  ...v,
                  activity: { ...v.activity, venue: e.target.value },
                })
              }
            >
              <option>Casa</option>
              <option>Trasferta</option>
            </select>
          </Field>
        </div>
      ) : null}
      {a.match_id ? (
        <div className="match-export-toolbar">
          <Button
            className="match-report-trigger"
            variant="secondary"
            onClick={() => {
              if (editor.dirty)
                return ui.notify(
                  "Salva le modifiche alla partita prima di esportare il tabellino.",
                );
              ui.open("match-report", {
                match: m,
                activity: a,
                roster: runtime.state.roster,
                events: runtime.state.events,
                players: runtime.state.players,
              });
            }}
          >
            Esporta tabellino
          </Button>
        </div>
      ) : null}
      <div
        className="activity-tabs"
        role="tablist"
        aria-label="Scheda attività"
      >
        {tabs.map(([key, label], index) => (
          <button
            key={key}
            id={`match-tab-${key}`}
            role="tab"
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            aria-controls={`match-panel-${key}`}
            data-activity-tab={key}
            onClick={() => void chooseTab(key)}
            onKeyDown={(e) => {
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? tabs.length - 1
                    : e.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : e.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : null;
              if (next !== null) {
                e.preventDefault();
                void chooseTab(tabs[next][0]);
                document.getElementById(`match-tab-${tabs[next][0]}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p id="activitySaveState" role="status" className="save-state">
        {editor.busy
          ? "Salvataggio in corso…"
          : editor.dirty
            ? "Modifiche non salvate"
            : a.id
              ? "Salvato · Nessuna modifica"
              : "Bozza non ancora salvata"}
      </p>
      {a.match_id ? (
        <section
          id="match-panel-results"
          role="tabpanel"
          aria-labelledby="match-tab-results"
          data-activity-panel="results"
          hidden={tab !== "results"}
        >
          <div className="match-score-fields">
            {resultFields.map(({ id, label, key }, i) => (
              <Fragment key={key}>
                {i > 0 ? (
                  <span className="match-score-separator" aria-hidden="true">
                    :
                  </span>
                ) : null}
                <Field id={id} label={label}>
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    disabled={editor.busy || !!composer}
                    placeholder="—"
                    value={v.result[key]}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        result: { ...v.result, [key]: e.target.value },
                      })
                    }
                  />
                </Field>
              </Fragment>
            ))}
          </div>
          <div className="match-live-grid">
            <div className="match-live-main">
              <div className="section-title match-events-heading">
                <h3>
                  Eventi <span id="matchEventCount">({events.length})</span>
                </h3>
                <div className="match-event-actions">
                  {(
                    [
                      {
                        id: "addGoal",
                        type: "Gol",
                        team: "own",
                        label: "Gol Eburum",
                        Icon: CircleDot,
                      },
                      {
                        id: "addOpponentGoal",
                        type: "Gol",
                        team: "opponent",
                        label: "Gol avversari",
                        Icon: CircleDot,
                      },
                      {
                        id: "addYellow",
                        type: "Ammonizione",
                        label: "Ammonizione",
                        Icon: RectangleVertical,
                      },
                      {
                        id: "addSubstitution",
                        type: "Sostituzione",
                        label: "Sostituzione",
                        Icon: ArrowLeftRight,
                      },
                      {
                        id: "addMatchEvent",
                        type: "Nota",
                        label: "Altro evento",
                        Icon: Plus,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      id={item.id}
                      disabled={editor.busy || !!reloadError}
                      aria-pressed={
                        !!selected &&
                        selected.type === item.type &&
                        (item.type !== "Gol" ||
                          selected.team ===
                            ("team" in item ? item.team : undefined))
                      }
                      onClick={() =>
                        void openComposer({
                          type: item.type,
                          team: "team" in item ? item.team : undefined,
                        })
                      }
                    >
                      <item.Icon size={18} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="match-event-composer">
                {composer ? (
                  <EventEditor
                    key={
                      (composer.event?.id || "new") +
                      composer.type +
                      (composer.team || "")
                    }
                    inline
                    runtime={runtime}
                    surface={{
                      id: -2,
                      kind: "event",
                      data: {
                        matchId: a.match_id,
                        type: composer.type,
                        event: composer.event,
                        context: { team: composer.team },
                      },
                    }}
                    onGuard={(guard) => {
                      eventGuard.current = guard;
                    }}
                    onType={(type, team) => setSelected({ type, team })}
                    onClose={() => {
                      setComposer(null);
                      setSelected(null);
                    }}
                    onSaved={reload}
                  />
                ) : null}
              </div>
              <div id="matchEventList" className="event-list match-timeline">
                {events.map((e) => (
                  <article
                    className={
                      "event-item" +
                      (e.event_type === "Gol" && !e.player_id
                        ? " opponent-goal"
                        : "")
                    }
                    key={e.id}
                  >
                    <div className="event-minute">
                      {e.minute == null ? "—" : `${e.minute}′`}
                    </div>
                    <div
                      className="event-content"
                      data-event-type={e.event_type}
                    >
                      <span className={`badge ${eventTone(e)}`}>
                        {e.event_type === "Gol" && !e.player_id
                          ? "Gol avversario"
                          : e.event_type}
                      </span>
                      <b>
                        {e.event_type === "Gol" && !e.player_id
                          ? "Squadra avversaria"
                          : `${e.event_type === "Sostituzione" ? "Entra " : ""}${runtime.state.players.find((p) => p.id === e.player_id)?.surname || "Giocatore storico"} ${runtime.state.players.find((p) => p.id === e.player_id)?.name || ""}`}
                      </b>
                      {e.outgoing_player_id ? (
                        <small>
                          Esce{" "}
                          {
                            runtime.state.players.find(
                              (p) => p.id === e.outgoing_player_id,
                            )?.surname
                          }{" "}
                          {
                            runtime.state.players.find(
                              (p) => p.id === e.outgoing_player_id,
                            )?.name
                          }
                        </small>
                      ) : null}
                      {e.detail ? <p>{e.detail}</p> : null}
                    </div>
                    <button
                      className="ghost event-edit"
                      data-unified-event={e.id}
                      aria-label={`Modifica ${e.event_type}${e.minute == null ? "" : ` al ${e.minute}° minuto`}`}
                      disabled={editor.busy || !!reloadError}
                      onClick={() =>
                        void openComposer({
                          type: e.event_type,
                          event: e,
                          team:
                            e.event_type === "Gol"
                              ? e.player_id
                                ? "own"
                                : "opponent"
                              : undefined,
                        })
                      }
                    >
                      <Pencil size={18} />
                    </button>
                  </article>
                ))}
              </div>
              <div className="match-game-notes">
                <Field id="matchNote" label="Note della partita">
                  <textarea
                    id="matchNote"
                    maxLength={10000}
                    placeholder="Osservazioni sulla gara…"
                    disabled={editor.busy || !!composer}
                    value={v.result.note}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        result: { ...v.result, note: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
            </div>
            <div className="match-live-side">
              <details className="match-settings">
                <summary>
                  Durata e calcolo minuti{" "}
                  <span className="row-sub">
                    {v.result.duration_minutes}′ ·{" "}
                    {v.result.minutes_auto ? "Automatici" : "Manuali"}
                  </span>
                </summary>
                <Field id="matchDuration" label="Durata della gara (minuti)">
                  <input
                    id="matchDuration"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={130}
                    disabled={!plan || !!composer || editor.busy}
                    value={v.result.duration_minutes}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        result: {
                          ...v.result,
                          duration_minutes: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field id="matchMinutesMode" label="Minuti giocati">
                  <select
                    id="matchMinutesMode"
                    disabled={!plan || !!composer || editor.busy}
                    value={v.result.minutes_auto ? "auto" : "manual"}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        result: {
                          ...v.result,
                          minutes_auto: e.target.value === "auto",
                        },
                      })
                    }
                  >
                    <option value="auto">Automatici dagli eventi</option>
                    <option value="manual">Inseriti dallo staff</option>
                  </select>
                </Field>
                <Field id="matchVenue" label="Dove si gioca">
                  <select
                    id="matchVenue"
                    disabled={!plan || !!composer || editor.busy}
                    value={v.result.venue}
                    onChange={(e) =>
                      editor.setValue({
                        ...v,
                        result: { ...v.result, venue: e.target.value },
                      })
                    }
                  >
                    <option>Casa</option>
                    <option>Trasferta</option>
                  </select>
                </Field>
              </details>
              <details className="match-minutes">
                <summary>Minuti giocati</summary>
                <div id="matchMinutesList">
                  {called.map((row) => (
                    <p key={row.player_id}>
                      {players.find((p) => p.id === row.player_id)?.surname} ·{" "}
                      {row.minutes_played} min
                    </p>
                  ))}
                </div>
              </details>
            </div>
          </div>
          {reloadError ? (
            <div role="alert">
              {reloadError}
              <Button
                variant="secondary"
                onClick={() => void editor.run(reload)}
              >
                Ricarica dati
              </Button>
            </div>
          ) : null}
          <details className="match-review">
            <summary>Riepilogo e controllo finale</summary>
            <ul>
              {m
                ? matchReview(m, v.rows, events).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))
                : null}
            </ul>
            <Button
              variant="secondary"
              onClick={() => ui.open("history", { id: a.id, kind: "activity" })}
            >
              Storico modifiche
            </Button>
          </details>
          {role === "admin" ? (
            <details className="match-danger">
              <summary>Altre azioni</summary>
              <Button
                id="removeUnifiedMatch"
                variant="destructive"
                disabled={editor.busy}
                onClick={() =>
                  void editor.run(async () => {
                    if (
                      !m ||
                      !(await confirmDialog({
                        message:
                          "Eliminare definitivamente la partita, convocazioni ed eventi collegati?",
                        confirmLabel: "Elimina partita",
                        danger: true,
                      }))
                    )
                      return;
                    if (
                      !editor.current() ||
                      runtime.state.team?.role !== "admin"
                    )
                      return;
                    const { error } = await runtime.db
                      .from("matches")
                      .delete()
                      .eq("id", m.id)
                      .eq("user_id", teamOwner());
                    if (error) throw error;
                    if (editor.current()) {
                      await editor.close();
                      await runtime.actions.reload();
                    }
                  })
                }
              >
                Elimina partita
              </Button>
            </details>
          ) : null}
          <div className="match-save-row workspace-save">
            <Button
              id="saveMatchResult"
              disabled={editor.busy || !!composer || !!reloadError}
              onClick={() => void saveResult()}
            >
              Salva partita
            </Button>
            <Feedback id="matchResultStatus" error={editor.error} />
          </div>
        </section>
      ) : null}
      <form
        id="activityForm"
        hidden={tab === "results"}
        onSubmit={(e) => {
          e.preventDefault();
          void saveOrganization();
        }}
      >
        <fieldset disabled={editor.busy}>
          <section
            id="match-panel-details"
            role="tabpanel"
            aria-labelledby="match-tab-details"
            data-activity-panel="details"
            hidden={tab !== "details"}
          >
            <fieldset disabled={!plan}>
              <div className="form-grid">
                {(
                  [
                    ["title", "Titolo / avversario", "text", "activityName"],
                    ["activity_date", "Data", "date", "activityDate"],
                    ["start_time", "Inizio", "time", "activityStart"],
                    ["end_time", "Fine", "time", "activityEnd"],
                    ["location", "Campo / luogo", "text", "activityLocation"],
                    [
                      "meeting_time",
                      "Ora ritrovo",
                      "time",
                      "activityMeetingTime",
                    ],
                    [
                      "meeting_place",
                      "Luogo ritrovo",
                      "text",
                      "activityMeetingPlace",
                    ],
                  ] as const
                ).map(([key, label, type, id]) => (
                  <Field id={id} label={label} key={key}>
                    <input
                      id={id}
                      type={type}
                      required={key === "title" || key === "activity_date"}
                      maxLength={
                        key === "location" || key === "meeting_place"
                          ? 500
                          : 160
                      }
                      value={v.activity[key]}
                      onChange={(e) =>
                        editor.setValue({
                          ...v,
                          activity: { ...v.activity, [key]: e.target.value },
                        })
                      }
                    />
                  </Field>
                ))}
                {a.id ? (
                  <Field id="activityVenue" label="Dove si gioca">
                    <select
                      id="activityVenue"
                      value={v.activity.venue}
                      onChange={(e) =>
                        editor.setValue({
                          ...v,
                          activity: { ...v.activity, venue: e.target.value },
                        })
                      }
                    >
                      <option>Casa</option>
                      <option>Trasferta</option>
                    </select>
                  </Field>
                ) : null}{" "}
                {a.id ? (
                  <Field id="activityState" label="Stato">
                    <select
                      id="activityState"
                      value={v.activity.status}
                      onChange={(e) =>
                        editor.setValue({
                          ...v,
                          activity: { ...v.activity, status: e.target.value },
                        })
                      }
                    >
                      {["Programmato", "Concluso", "Annullato"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </div>
              <Field id="activityNote" label="Indicazioni per lo staff">
                <textarea
                  id="activityNote"
                  maxLength={10000}
                  value={v.activity.organization_note}
                  onChange={(e) =>
                    editor.setValue({
                      ...v,
                      activity: {
                        ...v.activity,
                        organization_note: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            </fieldset>
          </section>
          <section
            id="match-panel-roster"
            role="tabpanel"
            aria-labelledby="match-tab-roster"
            data-activity-panel="roster"
            hidden={tab !== "roster"}
          >
            <p id="matchReadiness" className="notice">
              {called.length} convocati · {starters.length}/11 titolari
              {starters.length !== 11 ? " · Formazione da completare" : ""}
            </p>
            <Field id="rosterSearch" label="Cerca giocatore">
              <input
                id="rosterSearch"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <div
              className="workflow-switch"
              role="group"
              aria-label="Filtra convocazioni"
            >
              <button
                type="button"
                data-roster-filter="all"
                aria-pressed={!onlyCalled}
                onClick={() => setOnlyCalled(false)}
              >
                Rosa
              </button>
              <button
                type="button"
                data-roster-filter="called"
                aria-pressed={onlyCalled}
                onClick={() => setOnlyCalled(true)}
              >
                Convocati
              </button>
            </div>
            <p id="rosterCounts" className="attendance-counts">
              {called.length} convocati · {starters.length} titolari ·{" "}
              {called.filter((r) => r.lineup === "Panchina").length} panchina
            </p>
            <div id="activityRoster" className="list">
              {players
                .filter((p) =>
                  `${p.surname} ${p.name} ${p.role}`
                    .toLocaleLowerCase("it")
                    .includes(search.toLocaleLowerCase("it")),
                )
                .filter(
                  (p) =>
                    !onlyCalled ||
                    v.rows.find((r) => r.player_id === p.id)?.called,
                )
                .map((p, index, visible) => {
                  const row = v.rows.find((r) => r.player_id === p.id)!,
                    patch = (values: Partial<RosterRow>) =>
                      editor.setValue({
                        ...v,
                        rows: v.rows.map((r) =>
                          r.player_id === p.id ? { ...r, ...values } : r,
                        ),
                      });
                  return (
                    <Fragment key={p.id}>
                      {index === 0 || visible[index - 1].role !== p.role ? (
                        <h4 className="roster-role">{p.role}</h4>
                      ) : null}
                      <article className="roster-person">
                        <label>
                          <input
                            type="checkbox"
                            data-called={p.id}
                            disabled={!plan}
                            checked={row.called}
                            onChange={(e) =>
                              patch({
                                called: e.target.checked,
                                ...(!e.target.checked
                                  ? {
                                      lineup: "Non impiegato",
                                      minutes_played: 0,
                                      position: null,
                                    }
                                  : {}),
                              })
                            }
                          />
                          <span>
                            <b>
                              {p.surname} {p.name}
                            </b>
                            <small>{p.role}</small>
                            {dismissalAlert(p.id, v.activity.activity_date) ? (
                              <small className="roster-suspension">
                                {dismissalAlert(p.id, v.activity.activity_date)}
                              </small>
                            ) : null}
                          </span>
                        </label>
                        <div className="roster-quick-controls">
                          <select
                            aria-label={`Impiego di ${p.surname} ${p.name}`}
                            data-roster-lineup={p.id}
                            disabled={!plan || !row.called}
                            value={row.lineup}
                            onChange={(e) => {
                              if (
                                e.target.value === "Titolare" &&
                                starters.length >= 11
                              )
                                return editor.setError(
                                  "Al massimo 11 titolari",
                                );
                              patch({ lineup: e.target.value });
                            }}
                          >
                            {["Non impiegato", "Titolare", "Panchina"].map(
                              (value) => (
                                <option key={value}>{value}</option>
                              ),
                            )}
                          </select>
                          <Button
                            variant="secondary"
                            data-roster-edit={p.id}
                            disabled={!plan}
                            onClick={() =>
                              ui.open("roster", {
                                player: p,
                                row,
                                onSaved: patch,
                                automatic: !!m?.minutes_auto,
                                duration: m?.duration_minutes || 90,
                                limited: !plan,
                              })
                            }
                          >
                            Dettagli
                          </Button>
                        </div>
                        <small className="row-sub">
                          {row.called
                            ? `Convocato · ${row.lineup} · ${row.minutes_played} min`
                            : "Non convocato"}
                        </small>
                      </article>
                    </Fragment>
                  );
                })}
            </div>
            <details className="field-space">
              <summary>Formazione e note tecniche</summary>
              {technical ? (
                <>
                  <Field id="formation" label="Modulo">
                    <input
                      id="formation"
                      disabled={!plan}
                      maxLength={30}
                      value={v.technical.formation}
                      onChange={(e) =>
                        editor.setValue({
                          ...v,
                          technical: {
                            ...v.technical,
                            formation: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <div
                    className="formation-preview"
                    aria-label="Formazione titolare"
                  >
                    {[
                      "Attaccante",
                      "Centrocampista",
                      "Difensore",
                      "Portiere",
                    ].map((role) => (
                      <div className="pitch-line" key={role}>
                        {starters
                          .filter(
                            (r) =>
                              players.find((p) => p.id === r.player_id)
                                ?.role === role,
                          )
                          .map((r) => {
                            const p = players.find(
                              (p) => p.id === r.player_id,
                            )!;
                            return (
                              <span className="pitch-player" key={r.player_id}>
                                <b>{p.shirt_number ?? "•"}</b>
                                <span>{p.surname}</span>
                                <small>{r.position || role}</small>
                              </span>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                  <Field id="technicalNote" label="Osservazioni tecniche">
                    <textarea
                      id="technicalNote"
                      maxLength={10000}
                      value={v.technical.note}
                      onChange={(e) =>
                        editor.setValue({
                          ...v,
                          technical: { ...v.technical, note: e.target.value },
                        })
                      }
                    />
                  </Field>
                </>
              ) : null}
            </details>
            <section className="callup-copy field-space">
              <h3>Comunicazione ai convocati</h3>
              <p className="row-sub">
                Il testo comprende organizzazione e nomi dei convocati. Puoi
                rivederlo prima di copiarlo.
              </p>
              <Button
                variant="secondary"
                id="previewCallup"
                onClick={() =>
                  setCallup(
                    (editor.dirty || !a.id
                      ? "BOZZA · organizzazione e convocazioni non ancora salvate\n\n"
                      : "") +
                      callupMessage(
                        { ...a, ...v.activity, activity_type: "Partita" },
                        v.rows,
                        players,
                      ),
                  )
                }
              >
                Prepara convocazione
              </Button>
              {callup !== null ? (
                <div id="callupPreview">
                  <textarea
                    id="callupText"
                    rows={9}
                    aria-label="Testo convocazione da rivedere"
                    value={callup}
                    onChange={(e) => setCallup(e.target.value)}
                  />
                  <CopyText
                    id="copyCallup"
                    text={callup}
                    label="Copia convocazione"
                  />
                </div>
              ) : null}
            </section>
          </section>
          <div className="modal-actions workspace-save">
            <Button
              id="cancelActivity"
              variant="secondary"
              onClick={() => void ui.close(surface.id)}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              aria-label={!plan ? "Salva osservazioni tecniche" : undefined}
            >
              {a.id ? "Salva" : "Crea partita"}
            </Button>
          </div>
        </fieldset>
        <Feedback id="activityFeedback" error={editor.error} />
      </form>
    </EditorFrame>
  );
}

export function RosterEditor({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { player, row, onSaved, automatic, duration, limited } =
      surface.data as {
        player: { surname: string; name: string };
        row: RosterRow;
        onSaved: (value: Partial<RosterRow>) => void;
        automatic: boolean;
        duration: number;
        limited: boolean;
      },
    editor = useEditor(runtime, surface, { ...row });
  return (
    <EditorFrame
      surface={surface}
      title={`${player.surname} ${player.name}`}
      dirty={editor.dirty}
      busy={editor.busy}
      titleId="rosterTitle"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (limited || !editor.current()) return;
          const minutes = Number(editor.value.minutes_played);
          if (!Number.isInteger(minutes) || minutes < 0 || minutes > duration)
            return editor.setError(`Minuti interi tra 0 e ${duration}`);
          onSaved(editor.value);
          void editor.close();
        }}
      >
        <fieldset disabled={limited}>
          <Field id="rosterLineup" label="Impiego">
            <select
              id="rosterLineup"
              value={editor.value.lineup}
              onChange={(e) =>
                editor.setValue({ ...editor.value, lineup: e.target.value })
              }
            >
              {["Non impiegato", "Titolare", "Panchina"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field id="rosterPosition" label="Posizione">
            <input
              id="rosterPosition"
              maxLength={80}
              value={editor.value.position || ""}
              onChange={(e) =>
                editor.setValue({ ...editor.value, position: e.target.value })
              }
            />
          </Field>
          <Field id="rosterMinutes" label="Minuti giocati">
            <input
              id="rosterMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={duration}
              readOnly={automatic}
              value={editor.value.minutes_played}
              onChange={(e) =>
                editor.setValue({
                  ...editor.value,
                  minutes_played: Number(e.target.value),
                })
              }
            />
          </Field>
        </fieldset>
        <Button type="submit">Conferma</Button>
        <Feedback error={editor.error} />
      </form>
    </EditorFrame>
  );
}
export function ReadOnlyActivity({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { activity: a } = surface.data as { activity: Partial<Activity> },
    m = runtime.state.matches.find((m) => m.id === a.match_id),
    rows = runtime.state.roster.filter(
      (r) =>
        r.activity_id === a.id && (a.activity_type !== "Partita" || r.called),
    ),
    events = runtime.state.events.filter((e) => e.match_id === a.match_id);
  return (
    <EditorFrame
      surface={surface}
      titleId="readonlyActivityTitle"
      title={m ? matchTitle(m) : a.title || "Attività"}
      closeLabel="Chiudi attività"
    >
      <p className="notice">
        Consultazione · Il tuo ruolo può leggere queste informazioni. Le
        modifiche sportive spettano allo staff autorizzato.
      </p>
      <p>
        {fmt(a.activity_date || "")} ·{" "}
        {a.start_time?.slice(0, 5) || "Orario da definire"} · {a.status}
      </p>
      <p>{a.location || "Luogo da definire"}</p>
      {a.organization_note ? <p>{a.organization_note}</p> : null}
      {m ? (
        <>
          <h3>Risultato</h3>
          <p>
            {m.goals_for == null || m.goals_against == null
              ? "Da registrare"
              : `${m.goals_for} : ${m.goals_against}`}
          </p>
          <Button
            className="match-report-trigger"
            variant="secondary"
            onClick={() =>
              ui.open("match-report", {
                match: m,
                activity: a,
                roster: rows,
                events,
                players: runtime.state.players,
              })
            }
          >
            Esporta tabellino
          </Button>
        </>
      ) : null}
      <h3>{m ? "Convocati" : "Disponibilità registrate"}</h3>
      {rows.map((row) => (
        <article className="row" key={row.player_id}>
          <b>
            {runtime.state.players.find((p) => p.id === row.player_id)?.surname}{" "}
            {runtime.state.players.find((p) => p.id === row.player_id)?.name}
          </b>
          <small>
            {m
              ? `${row.lineup} · ${row.minutes_played} min`
              : row.availability === "Disponibile"
                ? "WhatsApp: Sì"
                : row.availability === "Indisponibile"
                  ? "WhatsApp: No"
                  : "WhatsApp: Non risposto"}
          </small>
        </article>
      ))}
      {events.map((e) => (
        <article className="row" key={e.id}>
          <span className={`badge ${eventTone(e)}`}>
            {e.event_type === "Gol" && !e.player_id
              ? "Gol avversario"
              : e.event_type}
          </span>
          <span>{e.minute == null ? "—" : `${e.minute}′`}</span>
          <p>
            {e.event_type === "Gol" && !e.player_id
              ? "Squadra avversaria"
              : runtime.state.players.find((p) => p.id === e.player_id)
                  ?.surname || "Giocatore storico"}
          </p>
          {e.detail ? <small>{e.detail}</small> : null}
        </article>
      ))}
    </EditorFrame>
  );
}
