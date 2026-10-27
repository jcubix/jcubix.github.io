import { useCallback, useEffect, useRef, useState } from "react";
import { adminRequest } from "../../app-admin.js";
import { confirmDialog } from "../../app-confirm.js";
import { fmt, teamOwner } from "../../app-part1.js";
import { roleHelp, roleLabels } from "../../app-roles.ts";
import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, Field, useEditor } from "../operational-ui";
import type { Runtime, TeamRole } from "../types";
import { ui, type Surface } from "../ui-service";
import { Staff } from "./model";
export function UsersEditor({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const [users, setUsers] = useState<Staff[]>([]),
    [next, setNext] = useState<number | null>(1),
    [tab, setTab] = useState("list"),
    [revision, refresh] = useState(0);
  const editor = useEditor(runtime, surface, {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "manager",
    }),
    loading = useRef(false);
  const isCurrent = editor.current,
    setError = editor.setError;
  const load = useCallback(
    async (page = 1) => {
      if (loading.current || runtime.state.team?.role !== "admin") return;
      loading.current = true;
      try {
        const result = await adminRequest({ action: "list", page });
        if (!isCurrent()) return;
        setUsers((old) =>
          page === 1 ? result.users : [...old, ...result.users],
        );
        setNext(result.nextPage);
      } catch (error) {
        if (isCurrent()) setError((error as Error).message);
      } finally {
        loading.current = false;
      }
    },
    [runtime, isCurrent, setError],
  );
  useEffect(() => {
    void load();
  }, [revision, load]);
  if (runtime.state.team?.role !== "admin") return null;
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title="Gestione utenti"
      titleId="usersTitle"
      closeId="closeUsers"
      description="Gestisci gli accessi dello staff e i ruoli nella squadra."
      closeLabel="Chiudi"
    >
      <div
        className="workflow-switch"
        role="group"
        aria-label="Gestione accessi"
      >
        <button
          aria-pressed={tab === "list"}
          data-users-tab="list"
          onClick={async () => {
            if (
              editor.dirty &&
              !(await confirmDialog({
                message: "Scartare la nuova utenza non ancora creata?",
                confirmLabel: "Scarta",
              }))
            )
              return;
            editor.reset({
              first_name: "",
              last_name: "",
              email: "",
              password: "",
              role: "manager",
            });
            setTab("list");
          }}
        >
          Utenze
        </button>
        <button
          aria-pressed={tab === "create"}
          data-users-tab="create"
          onClick={() => setTab("create")}
        >
          Nuovo utente
        </button>
      </div>
      {tab === "create" ? (
        <form
          id="createUserForm"
          onSubmit={(event) => {
            event.preventDefault();
            void editor.run(async () => {
              const v = editor.value;
              if (!v.first_name.trim() || !v.last_name.trim())
                throw Error("Inserisci nome e cognome");
              if (v.password.length < 12 || v.password.length > 128)
                throw Error("Password da 12 a 128 caratteri");
              const result = await adminRequest({
                action: "create",
                ...v,
                first_name: v.first_name.trim(),
                last_name: v.last_name.trim(),
              });
              if (!editor.current()) return;
              editor.reset({
                first_name: "",
                last_name: "",
                email: "",
                password: "",
                role: "manager",
              });
              refresh((n) => n + 1);
              editor.setError(
                result.warning || "Utenza creata e associata alla squadra.",
              );
            });
          }}
        >
          <fieldset disabled={editor.busy}>
            <div className="form-grid">
              {(
                [
                  ["first_name", "Nome", "text", "newUserFirstName"],
                  ["last_name", "Cognome", "text", "newUserLastName"],
                  ["email", "Email", "email", "newUserEmail"],
                  [
                    "password",
                    "Password iniziale",
                    "password",
                    "newUserPassword",
                  ],
                ] as const
              ).map(([key, label, type, id]) => (
                <Field key={key} id={id} label={label}>
                  <input
                    id={id}
                    type={type}
                    required
                    maxLength={
                      key === "password" ? 128 : key === "email" ? 254 : 80
                    }
                    autoComplete={key === "password" ? "new-password" : "off"}
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
            <Field id="newUserRole" label="Ruolo nella squadra">
              <select
                id="newUserRole"
                value={editor.value.role}
                onChange={(e) =>
                  editor.setValue({ ...editor.value, role: e.target.value })
                }
              >
                {Object.entries(roleLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
              <small>{roleHelp[editor.value.role as TeamRole]}</small>
            </Field>
            <Button type="submit">Crea utenza</Button>
          </fieldset>
        </form>
      ) : (
        <section className="users-section">
          <h3>Utenze abilitate</h3>
          <div id="usersList" className="list">
            {users.map((user) => (
              <article className="row user-row" key={user.id}>
                <div className="row-main">
                  <b>
                    {[user.first_name, user.last_name]
                      .filter(Boolean)
                      .join(" ") || user.email}
                  </b>
                  <span className="user-email row-sub" title={user.email}>
                    {user.email}
                  </span>
                  <small>{fmt(user.created_at?.slice(0, 10) || "")}</small>
                </div>
                <span className="badge tone-neutral">
                  {roleLabels[user.role as TeamRole]}
                </span>
                <div className="user-actions">
                  {[
                    "profile",
                    "email",
                    ...(user.id !== runtime.state.user?.id ? ["password"] : []),
                    ...(user.id !== runtime.state.user?.id &&
                    user.id !== teamOwner()
                      ? ["delete"]
                      : []),
                  ].map((action) => (
                    <Button
                      key={action}
                      variant={
                        action === "delete" ? "destructive" : "secondary"
                      }
                      {...{ ["data-user-" + action]: user.id }}
                      onClick={() =>
                        ui.open("user-edit", {
                          user,
                          action,
                          onSaved: () => refresh((n) => n + 1),
                        })
                      }
                    >
                      {
                        {
                          profile: "Nome e cognome",
                          email: "Modifica email",
                          password: "Cambia password",
                          delete: "Elimina utenza",
                        }[action]
                      }
                    </Button>
                  ))}
                  {user.id !== teamOwner() ? (
                    <select
                      data-user-role={user.id}
                      aria-label={`Ruolo di ${user.email}`}
                      value={user.role}
                      disabled={editor.busy}
                      onChange={(e) => {
                        const role = e.target.value;
                        void editor.run(async () => {
                          await adminRequest({
                            action: "role",
                            userId: user.id,
                            role,
                          });
                          if (editor.current()) {
                            await runtime.actions.reload();
                            refresh((n) => n + 1);
                          }
                        });
                      }}
                    >
                      {Object.entries(roleLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {next ? (
            <Button
              variant="secondary"
              id="moreUsers"
              onClick={() => void load(next)}
            >
              Carica altri utenti
            </Button>
          ) : null}
        </section>
      )}
      <Feedback id="userMessage" error={editor.error} />
    </EditorFrame>
  );
}
