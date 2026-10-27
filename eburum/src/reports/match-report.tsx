import {
  ArrowLeftRight,
  CircleDot,
  MessageSquare,
  RectangleVertical,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  createMatchReportPdf,
  matchReportModel,
} from "../../app-match-report.js";
import { eventTone } from "../../app-part4.js";
import { ensureJsPdf } from "../../app-pdf-loader.js";
import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, useEditor } from "../operational-ui";
import type { Runtime } from "../types";
import { type Surface } from "../ui-service";

export function MatchReport({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const editor = useEditor(runtime, surface, {}),
    model = matchReportModel(
      surface.data as Parameters<typeof matchReportModel>[0],
    ),
    [fallback, setFallback] = useState(false),
    area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (fallback) {
      area.current?.focus();
      area.current?.select();
    }
  }, [fallback]);
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title="Tabellino gara"
      titleId="matchReportTitle"
      description="Dati salvati della partita. Copia il testo per condividerlo oppure scarica il PDF."
      className="match-report-modal"
      closeLabel="Chiudi tabellino"
    >
      <div id="matchReportPreview" className="match-report-document">
        <header className="match-report-score">
          <p>
            {model.date}
            {model.cancelled ? " · Partita annullata" : ""}
          </p>
          <div>
            {model.teams.map((team: string, i: number) => (
              <span key={i}>
                {team}
                <b>{model.scores ? model.scores[i] : "—"}</b>
              </span>
            ))}
          </div>
          <p>{model.result}</p>
        </header>
        <div className="match-report-columns">
          <section>
            <h3>Formazione titolare</h3>
            {model.starters.length ? (
              <ul className="match-report-lineup">
                {model.starters.map((name: string, i: number) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="row-sub">Formazione non registrata.</p>
            )}
          </section>
          <section>
            <h3>Eventi della gara</h3>
            <div className="match-timeline">
              {model.eventEntries.map(
                (
                  event: {
                    minute: number | null;
                    type: string;
                    opponent: boolean;
                    action: string;
                  },
                  i: number,
                ) => {
                  const Icon =
                    event.type === "Gol"
                      ? CircleDot
                      : event.type === "Sostituzione"
                        ? ArrowLeftRight
                        : event.type === "Nota"
                          ? MessageSquare
                          : RectangleVertical;
                  return (
                    <article
                      className={
                        "event-item" + (event.opponent ? " opponent-goal" : "")
                      }
                      key={i}
                    >
                      <div
                        className="event-minute"
                        aria-label={
                          event.minute == null
                            ? "Minuto non indicato"
                            : undefined
                        }
                      >
                        {event.minute == null ? "—" : `${event.minute}′`}
                      </div>
                      <div
                        className="event-content"
                        data-event-type={event.type}
                      >
                        <span
                          className={`badge ${eventTone({ event_type: event.type, player_id: event.opponent ? null : "own" })}`}
                        >
                          <Icon size={16} />
                          {event.opponent ? "Gol avversario" : event.type}
                        </span>
                        <p>{event.action}</p>
                      </div>
                    </article>
                  );
                },
              )}
              {!model.eventEntries.length ? (
                <p className="row-sub">Nessun evento registrato.</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      <label htmlFor="matchReportText" hidden={!fallback}>
        Testo del tabellino da copiare
      </label>
      <textarea
        id="matchReportText"
        className="match-report-preview"
        readOnly
        hidden={!fallback}
        ref={area}
        value={model.text}
      />
      <div className="modal-actions">
        <Button
          id="copyMatchReport"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(model.text);
              editor.setError(
                "Tabellino copiato. Puoi incollarlo su WhatsApp.",
              );
            } catch {
              setFallback(true);
              editor.setError("Copia manualmente il testo selezionato.");
            }
          }}
        >
          Copia testo
        </Button>
        <Button
          id="downloadMatchReport"
          disabled={editor.busy}
          onClick={() =>
            void editor.run(async () => {
              await ensureJsPdf();
              if (editor.current()) {
                createMatchReportPdf(model).save(model.filename + ".pdf");
                editor.setError(
                  "PDF creato. Controlla i download del dispositivo.",
                );
              }
            })
          }
        >
          Scarica PDF
        </Button>
      </div>
      <Feedback id="matchReportStatus" error={editor.error} />
    </EditorFrame>
  );
}
