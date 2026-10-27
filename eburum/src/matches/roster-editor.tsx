import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, Field, useEditor } from "../operational-ui";
import type { RosterRow, Runtime } from "../types";
import { type Surface } from "../ui-service";

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
