import { loadSportPeriod } from "../../app-data.ts";
import { fmt, teamOwner } from "../../app-part1.js";
import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, useEditor } from "../operational-ui";
import type { Activity, Match, Runtime } from "../types";
import { ui, type Surface } from "../ui-service";
import { ReportDetailData } from "./model";
export function ReportDetail({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const data = surface.data as ReportDetailData,
    editor = useEditor(runtime, surface, {}),
    p = runtime.state.players.find((p) => p.id === data.player);
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={data.title}
      className="report-detail-modal modal"
      titleId="reportDetailTitle"
      description={`${p?.surname || ""} ${p?.name || ""} · ${fmt(data.from)} – ${fmt(data.to)} · ${data.items.length} registrazioni`}
      closeLabel="Chiudi dettagli report"
    >
      <div className="list">
        {data.items.map((item, i) => (
          <article className="row" key={i}>
            <div className="row-main">
              <b>{item.name}</b>
              <p>{item.detail}</p>
            </div>
            {item.match ? (
              <Button
                variant="secondary"
                disabled={editor.busy}
                data-drill-match={item.match.id}
                aria-label={`Apri report partita contro ${item.match.opponent} del ${fmt(item.match.match_date)}`}
                onClick={() =>
                  void editor.run(async () => {
                    const m = item.match!,
                      snapshot = await loadSportPeriod(
                        m.match_date,
                        m.match_date,
                        teamOwner(),
                      );
                    if (!editor.current()) return;
                    const match = snapshot.matches.find(
                      (row: Match) => row.id === m.id,
                    );
                    if (!match) throw Error("Gara non disponibile");
                    ui.open("match-report", {
                      match,
                      activity: snapshot.activities.find(
                        (a: Activity) => a.match_id === match.id,
                      ),
                      roster: snapshot.roster,
                      events: snapshot.events,
                      players: runtime.state.players,
                    });
                  })
                }
              >
                Tabellino gara
              </Button>
            ) : null}
          </article>
        ))}
        {!data.items.length ? <p>Nessuna registrazione nel periodo.</p> : null}
      </div>
      <Feedback id="reportDetailError" error={editor.error} />
    </EditorFrame>
  );
}
