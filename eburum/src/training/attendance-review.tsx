import { useState } from "react";
import { fmt, today } from "../../app-part1.js";
import { attendanceCounts, draftRows } from "../../app-part3.js";
import { canOperateRole } from "../../app-roles.ts";
import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, useEditor } from "../operational-ui";
import type { Attendance, Runtime, TrainingDraft } from "../types";
import { ui, type Surface } from "../ui-service";

export function AttendanceReview({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { draft: d } = surface.data as { draft: TrainingDraft },
    editor = useEditor(runtime, surface, {}),
    [conflict, setConflict] = useState(false),
    rows = draftRows(d) as Attendance[],
    counts = attendanceCounts(rows),
    before = JSON.parse(d.baseline) as { rows: Attendance[] },
    changed = rows.filter(
      (row) =>
        JSON.stringify(row) !==
        JSON.stringify(before.rows.find((r) => r.player_id === row.player_id)),
    ),
    shown = d.id
      ? changed
      : rows.filter((r) => r.status !== "Presente" || r.note);
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      titleId="reviewTitle"
      title={d.id ? "Riepilogo correzioni" : "Riepilogo sessione"}
      className="attendance-review"
      closeLabel="Torna alla bozza"
    >
      <p>
        <b>{d.session.session_type}</b> · {fmt(d.session.session_date)}
      </p>
      <div className="attendance-counts">
        {[
          [counts.present, "Presenti"],
          [counts.absent, "Assenti"],
          [counts.injured, "Infortunati"],
        ].map(([n, label]) => (
          <span className="attendance-count" key={label}>
            <b>{n}</b>
            {label}
          </span>
        ))}
      </div>
      <p className="notice">
        {d.session.attendance_mode === "absence_notice" ? (
          "Confermi le presenze effettive di tutta la squadra. La bozza parte dagli attesi e dalle assenze comunicate: verifica eventuali variazioni prima di salvare."
        ) : (
          <>
            Confermi le presenze effettive di tutta la sessione. Risposte al
            sondaggio: {rows.filter((r) => r.notified === true).length} risposto
            · {rows.filter((r) => r.notified === false).length} non risposto ·{" "}
            {rows.filter((r) => r.notified === null).length} da verificare.
          </>
        )}
      </p>
      {shown.map((row) => (
        <article className="review-person" key={row.player_id}>
          <b>
            {d.players.find((p) => p.id === row.player_id)?.surname}{" "}
            {d.players.find((p) => p.id === row.player_id)?.name}
          </b>
          <span>{row.status}</span>
          <p>{row.note}</p>
        </article>
      ))}
      <p className="row-sub">
        Verranno salvate le presenze di tutti i {d.players.length} giocatori,
        anche quelli nascosti dalla ricerca.
      </p>
      <div className="modal-actions">
        <Button
          id="backToDraft"
          variant="secondary"
          disabled={editor.busy}
          onClick={() => void ui.close(surface.id)}
        >
          Torna alla bozza
        </Button>
        <Button
          id="confirmTraining"
          disabled={editor.busy}
          onClick={() =>
            void (async () => {
              if (conflict) {
                await editor.close();
                runtime.state.registerDate = d.session.session_date;
                runtime.state.trainingMode = "hub";
                await runtime.navigate("register");
                ui.notify(
                  "Riapri la sessione aggiornata; la tua bozza resta disponibile",
                );
                return;
              }
              await editor.run(async () => {
                if (!canOperateRole(runtime.state.team?.role || ""))
                  throw Error("Operazione non consentita");
                if (
                  !d.session.session_date ||
                  d.session.session_date > today() ||
                  !d.players.length ||
                  counts.pending
                )
                  throw Error("Controlla la data e conferma tutte le presenze");
                const activity = runtime.state.activities.find(
                  (a) => a.id === d.activityId,
                );
                if (activity?.status === "Annullato")
                  throw Error("L’allenamento è annullato");
                d.saving = true;
                runtime.render();
                try {
                  const payload = {
                    p_session: { ...d.session },
                    p_attendance: rows,
                    p_session_id: d.id,
                    p_expected_revision: d.id ? d.revision : null,
                    p_request_id: d.id ? null : d.requestId,
                  };
                  const linked =
                    d.activityId &&
                    activity?.activity_date === d.session.session_date;
                  const { data, error } = await runtime.db.rpc(
                    linked
                      ? "save_training_attendance"
                      : "save_attendance_session",
                    linked
                      ? {
                          ...payload,
                          p_activity_id: d.activityId,
                          p_activity_revision: d.activityRevision,
                        }
                      : payload,
                  );
                  if (error) {
                    if (["40001", "PT409"].includes(error.code))
                      setConflict(true);
                    if (error.code === "23505")
                      throw Error(
                        "Esiste già una sessione con questa data e tipo. Correggila dal Registro.",
                      );
                    throw error;
                  }
                  if (!data?.session?.id)
                    throw Error("Risposta del salvataggio non valida");
                  if (!editor.current()) return;
                  runtime.state.trainingDraft = null;
                  runtime.state.registerDate = data.session.session_date;
                  runtime.state.trainingMode = "hub";
                  await editor.close();
                  await runtime.navigate("register");
                  const loaded = await runtime.actions.reloadAffected({
                    kind: "session",
                    id: data.session.id,
                    activityId: d.activityId,
                  });
                  ui.notify(
                    loaded
                      ? d.id
                        ? "Correzioni salvate"
                        : "Sessione salvata"
                      : "Salvataggio riuscito. Riprova il caricamento della squadra.",
                  );
                } finally {
                  d.saving = false;
                  runtime.render();
                }
              });
            })()
          }
        >
          {conflict ? "Riapri dal Registro" : "Conferma e salva"}
        </Button>
      </div>
      <Feedback id="reviewStatus" error={editor.error} />
    </EditorFrame>
  );
}
