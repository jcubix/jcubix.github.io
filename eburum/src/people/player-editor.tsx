import { ROLE_ORDER, teamOwner } from "../../app-part1.js";
import { canManageRole } from "../../app-roles.ts";
import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, Field, useEditor } from "../operational-ui";
import type { Player, Runtime } from "../types";
import { ui, type Surface } from "../ui-service";

export function PlayerEditor({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { player: p } = surface.data as { player: Partial<Player> };
  const editor = useEditor(runtime, surface, {
    surname: p.surname || "",
    name: p.name || "",
    role: p.role || ROLE_ORDER[0],
    secondary_role: p.secondary_role || "",
    shirt_number: p.shirt_number == null ? "" : String(p.shirt_number),
    phone: p.phone || "",
    active: p.active !== false,
  });
  if (!canManageRole(runtime.state.team?.role || "")) return null;
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={p.id ? "Modifica giocatore" : "Nuovo giocatore"}
      titleId="playerEditTitle"
      closeId="close"
      closeLabel="Chiudi modifica giocatore"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void editor.run(async () => {
            const v = editor.value;
            if (!v.surname.trim() || !v.name.trim())
              throw Error("Inserisci nome e cognome");
            const shirt = v.shirt_number === "" ? null : Number(v.shirt_number);
            if (shirt !== null && (!Number.isInteger(shirt) || shirt < 0))
              throw Error(
                "Il numero maglia deve essere un intero positivo o zero",
              );
            const reorder =
              !p.id || p.role !== v.role || (p.active === false && v.active);
            const row = {
              ...v,
              surname: v.surname.trim(),
              name: v.name.trim(),
              phone: v.phone.trim() || null,
              secondary_role: v.secondary_role || null,
              shirt_number: shirt,
              role_order: reorder
                ? Math.max(
                    0,
                    ...runtime.state.players
                      .filter(
                        (x) => x.id !== p.id && x.active && x.role === v.role,
                      )
                      .map((x) => x.role_order || 0),
                  ) + 1
                : (p.role_order ?? null),
              user_id: teamOwner(),
            };
            const query = p.id
              ? runtime.db
                  .from("players")
                  .update(row)
                  .eq("id", p.id)
                  .eq("user_id", teamOwner())
              : runtime.db.from("players").insert(row);
            const { error } = await query;
            if (error) throw error;
            if (editor.current()) {
              await editor.close();
              await runtime.actions.reload();
              ui.notify("Giocatore salvato");
            }
          });
        }}
      >
        <fieldset disabled={editor.busy}>
          <div className="form-grid">
            {(
              [
                ["surname", "Cognome", "ps"],
                ["name", "Nome", "pn"],
                ["phone", "Telefono", "pp"],
              ] as const
            ).map(([key, label, id]) => (
              <Field id={id} label={label} key={key}>
                <input
                  id={id}
                  type={key === "phone" ? "tel" : "text"}
                  required={key !== "phone"}
                  maxLength={key === "phone" ? 40 : 100}
                  value={editor.value[key]}
                  onChange={(e) =>
                    editor.setValue({ ...editor.value, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            <Field id="pr" label="Ruolo">
              <select
                id="pr"
                value={editor.value.role}
                onChange={(e) =>
                  editor.setValue({ ...editor.value, role: e.target.value })
                }
              >
                {ROLE_ORDER.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </Field>
            <Field id="secondaryRole" label="Ruolo secondario">
              <select
                id="secondaryRole"
                value={editor.value.secondary_role}
                onChange={(e) =>
                  editor.setValue({
                    ...editor.value,
                    secondary_role: e.target.value,
                  })
                }
              >
                <option value="">Non indicato</option>
                {ROLE_ORDER.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </Field>
            <Field id="pj" label="N. maglia">
              <input
                id="pj"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={editor.value.shirt_number}
                onChange={(e) =>
                  editor.setValue({
                    ...editor.value,
                    shirt_number: e.target.value,
                  })
                }
              />
            </Field>
            <Field id="pa" label="Stato">
              <select
                id="pa"
                value={String(editor.value.active)}
                onChange={(e) =>
                  editor.setValue({
                    ...editor.value,
                    active: e.target.value === "true",
                  })
                }
              >
                <option value="true">Attivo</option>
                <option value="false">Inattivo</option>
              </select>
            </Field>
          </div>
          <div className="modal-actions">
            <Button id="save" type="submit">
              Salva
            </Button>
          </div>
        </fieldset>
        <Feedback id="playerEditStatus" error={editor.error} />
      </form>
    </EditorFrame>
  );
}
