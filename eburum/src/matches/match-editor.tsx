import { matchTitle } from "../../app-match-display.js";
import { Button } from "../components/ui/button";
import { EditorFrame } from "../operational-ui";
import { ui } from "../ui-service";
import { MatchOrganization } from "./match-organization";
import { MatchResults } from "./match-results";
import { ReadOnlyActivity } from "./read-only-activity";
import { useMatchEditor } from "./use-match-editor";
export function MatchEditor(props: Parameters<typeof useMatchEditor>[0]) {
  const model = useMatchEditor(props);
  const {
    a,

    chooseTab,

    editor,

    m,

    operate,

    runtime,

    surface,
    tab,
    tabs,

    v,
  } = model;
  if (!operate)
    return (
      <ReadOnlyActivity
        runtime={runtime}
        surface={{ ...surface, data: { activity: a } }}
      />
    );
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
      {a.id ? (
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
                  document
                    .getElementById(`match-tab-${tabs[next][0]}`)
                    ?.focus();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <p id="activitySaveState" role="status" className="save-state">
        {editor.busy
          ? "Salvataggio in corso…"
          : editor.dirty
            ? "Modifiche non salvate"
            : a.id
              ? "Salvato · Nessuna modifica"
              : "Bozza non ancora salvata"}
      </p>
      {a.match_id ? <MatchResults model={model} /> : null}
      <MatchOrganization model={model} />
    </EditorFrame>
  );
}
