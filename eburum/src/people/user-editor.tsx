import { adminRequest } from "../../app-admin.js";
import { teamOwner } from "../../app-part1.js";
import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, Field, useEditor } from "../operational-ui";
import type { Runtime } from "../types";
import { ui, type Surface } from "../ui-service";
import { Staff } from "./model";
export function UserEditor({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { user, action, onSaved } = surface.data as {
    user: Staff;
    action: string;
    onSaved: () => void;
  };
  const editor = useEditor(runtime, surface, {
    email: user.email,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    password: "",
    confirm: "",
    confirmation: "",
  });
  const blocked =
    runtime.state.team?.role !== "admin" ||
    (action === "delete" &&
      (user.id === runtime.state.user?.id || user.id === teamOwner())) ||
    (action === "password" && user.id === runtime.state.user?.id);
  if (blocked) return null;
  const titles: Record<string, string> = {
    email: "Modifica email di accesso",
    profile: "Nome e cognome",
    password: "Cambia password",
    delete: "Elimina utenza",
  };
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={titles[action]}
      titleId={
        action === "profile"
          ? "profileTitle"
          : action === "delete"
            ? "deleteUserTitle"
            : action === "email"
              ? "emailTitle"
              : "passwordTitle"
      }
      description={user.email}
    >
      <form
        id={
          {
            email: "userEmailForm",
            profile: "userProfileForm",
            password: "userPasswordForm",
            delete: "deleteUserForm",
          }[action]
        }
        onSubmit={(e) => {
          e.preventDefault();
          void editor.run(async () => {
            const v = editor.value;
            let body: Record<string, unknown> = { action, userId: user.id };
            if (action === "email") {
              const email = v.email.trim().toLowerCase();
              if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
                email.length > 254
              )
                throw Error("Inserisci una email valida");
              body = { ...body, email, previousEmail: user.email };
            }
            if (action === "password") {
              if (v.password.length < 12 || v.password.length > 128)
                throw Error("Password da 12 a 128 caratteri");
              if (v.password !== v.confirm)
                throw Error("Le password non coincidono");
              body.password = v.password;
            }
            if (action === "profile")
              body = {
                ...body,
                first_name: v.first_name.trim(),
                last_name: v.last_name.trim(),
              };
            if (action === "delete") {
              body.confirmEmail = user.email;
            }
            await adminRequest(body);
            if (!editor.current()) return;
            editor.clean();
            await editor.close();
            onSaved();
            if (action === "profile" && user.id === runtime.state.user?.id)
              await runtime.actions.reload();
            ui.notify(
              action === "delete" ? "Utenza eliminata" : "Utente aggiornato",
            );
          });
        }}
      >
        <fieldset disabled={editor.busy}>
          {action === "email" ? (
            <Field id="staffEmail" label="Nuova email">
              <input
                id="staffEmail"
                type="email"
                required
                maxLength={254}
                value={editor.value.email}
                onChange={(e) =>
                  editor.setValue({ ...editor.value, email: e.target.value })
                }
              />
            </Field>
          ) : null}
          {action === "profile" ? (
            <div className="form-grid">
              {(
                [
                  ["first_name", "Nome", "staffFirstName"],
                  ["last_name", "Cognome", "staffLastName"],
                ] as const
              ).map(([key, label, id]) => (
                <Field id={id} label={label} key={key}>
                  <input
                    id={id}
                    maxLength={80}
                    value={editor.value[key]}
                    onChange={(e) =>
                      editor.setValue({
                        ...editor.value,
                        [key]: e.target.value,
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          ) : null}
          {action === "password" ? (
            <>
              {(
                [
                  ["password", "Nuova password", "staffPassword"],
                  ["confirm", "Conferma password", "staffPasswordConfirm"],
                ] as const
              ).map(([key, label, id]) => (
                <Field id={id} label={label} key={key}>
                  <input
                    id={id}
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                    value={editor.value[key]}
                    onChange={(e) =>
                      editor.setValue({
                        ...editor.value,
                        [key]: e.target.value,
                      })
                    }
                  />
                </Field>
              ))}
            </>
          ) : null}
          {action === "delete" ? (
            <p id="deleteUserDescription">
              Eliminare l’accesso di {user.first_name} {user.last_name} (
              {user.email})? Lo storico e i dati della squadra saranno
              conservati.
            </p>
          ) : null}
          <div className="modal-actions">
            <Button
              id={action === "delete" ? "cancelDeleteUser" : undefined}
              variant="secondary"
              data-autofocus={action === "delete" ? "" : undefined}
              disabled={editor.busy}
              onClick={() => void ui.close(surface.id)}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              variant={action === "delete" ? "destructive" : "default"}
            >
              {action === "delete"
                ? "Elimina definitivamente"
                : action === "email"
                  ? "Salva email"
                  : action === "password"
                    ? "Salva password"
                    : "Salva nominativo"}
            </Button>
          </div>
        </fieldset>
        <Feedback
          id={
            {
              email: "emailMessage",
              profile: "profileMessage",
              password: "passwordMessage",
              delete: "deleteUserMessage",
            }[action]
          }
          error={editor.error}
        />
      </form>
    </EditorFrame>
  );
}
