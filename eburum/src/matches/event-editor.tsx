import { confirmDialog } from "../../app-confirm.js";
import { teamOwner } from "../../app-part1.js";
import { EVENT_TYPES } from "../../app-part4.js";
import { canOperateRole } from "../../app-roles.ts";
import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, Field } from "../operational-ui";
import { ui } from "../ui-service";
import { useEventEditor } from "./use-event-editor";
export function EventEditor(props: Parameters<typeof useEventEditor>[0]) {
  const model = useEventEditor(props);
  const {
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
  } = model;
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
