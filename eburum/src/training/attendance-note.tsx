import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, Field, useEditor } from "../operational-ui";
import type { Runtime, TrainingDraft } from "../types";
import { type Surface } from "../ui-service";

export function AttendanceNote({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { draft, playerId, onSaved } = surface.data as {
      draft: TrainingDraft;
      playerId: string;
      onSaved: () => void;
    },
    p = draft.players.find((p) => p.id === playerId)!,
    a = draft.entries.get(playerId)!;
  const editor = useEditor(runtime, surface, { ...a });
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={`${p.surname} ${p.name}`}
      closeLabel="Chiudi presenza"
    >
      <div className="status-grid">
        {["Presente", "Assente", "Infortunato"].map((status) => (
          <button
            key={status}
            data-status={status}
            aria-pressed={editor.value.status === status}
            onClick={() => editor.setValue({ ...editor.value, status })}
          >
            {status}
          </button>
        ))}
      </div>
      <p>La risposta WhatsApp si modifica nella scheda dell’allenamento.</p>
      <Field id="note" label="Nota">
        <textarea
          id="note"
          maxLength={10000}
          value={editor.value.note || ""}
          onChange={(e) =>
            editor.setValue({ ...editor.value, note: e.target.value || null })
          }
        />
      </Field>
      <Button
        id="ok"
        onClick={() => {
          if (
            !["Presente", "Assente", "Infortunato"].includes(
              editor.value.status,
            )
          )
            return editor.setError("Scegli Presente, Assente o Infortunato");
          draft.entries.set(playerId, editor.value);
          void editor.close();
          onSaved();
        }}
      >
        Conferma presenza
      </Button>
      <Feedback id="attendanceError" error={editor.error} />
    </EditorFrame>
  );
}
