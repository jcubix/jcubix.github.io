import { useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { EditorFrame, Field, Feedback, useEditor } from "./operational-ui";
import { ui, type Surface } from "./ui-service";
import type { Runtime, Player, Administration, TeamRole } from "./types";
import { adminRequest } from "../app-admin.js";
import {
  ROLE_ORDER,
  fmt,
  today,
  teamOwner,
  sortPlayers,
} from "../app-part1.js";
import {
  roleLabels,
  roleHelp,
  canManageRole,
  canViewExpiriesRole,
} from "../app-roles.js";
import { expiryLimit, expiringPlayers } from "../app-team.js";
import { documentState } from "../app-workflow-tools.js";
import { confirmDialog } from "../app-confirm.js";

interface Staff {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  created_at?: string;
}
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
  const load = async (page = 1) => {
    if (loading.current || runtime.state.team?.role !== "admin") return;
    loading.current = true;
    try {
      const result = await adminRequest({ action: "list", page });
      if (!editor.current()) return;
      setUsers((old) =>
        page === 1 ? result.users : [...old, ...result.users],
      );
      setNext(result.nextPage);
    } catch (error) {
      if (editor.current()) editor.setError((error as Error).message);
    } finally {
      loading.current = false;
    }
  };
  useEffect(() => {
    void load();
  }, [revision]);
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
export function PlayerSheet({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const { id } = surface.data as { id: string },
    p = runtime.state.players.find((p) => p.id === id),
    manage = canManageRole(runtime.state.team?.role || ""),
    initial = runtime.state.administration.find((d) => d.player_id === id);
  const editor = useEditor(runtime, surface, {
    registration_status: initial?.registration_status || "Da verificare",
    certificate_until: initial?.certificate_until || "",
    document_until: initial?.document_until || "",
    emergency_contact:
      (initial as Administration & { emergency_contact?: string })
        ?.emergency_contact || "",
  });
  if (!p) return null;
  const rows = runtime.state.roster.filter(
      (r) =>
        r.player_id === id &&
        runtime.state.activities.some(
          (a) =>
            a.id === r.activity_id &&
            a.activity_type === "Partita" &&
            a.status !== "Annullato",
        ),
    ),
    attendance = runtime.state.attendance.filter((r) => r.player_id === id),
    events = runtime.state.events.filter((e) => e.player_id === id);
  return (
    <EditorFrame
      surface={surface}
      dirty={editor.dirty}
      busy={editor.busy}
      title={`${p.surname} ${p.name}`}
      titleId="playerSheetTitle"
      className="player-sheet"
      closeLabel="Chiudi scheda"
    >
      <p className="row-sub">
        {p.role}
        {p.secondary_role ? ` · ${p.secondary_role}` : ""}
        {p.shirt_number != null ? ` · #${p.shirt_number}` : ""}
      </p>
      <h3>Stagione selezionata</h3>
      <div className="player-kpis">
        {[
          [rows.filter((r) => r.called).length, "Convocazioni"],
          [rows.reduce((n, r) => n + r.minutes_played, 0), "Minuti registrati"],
          [
            attendance.filter((r) => r.status === "Presente").length,
            "Presenze effettive",
          ],
          [events.filter((e) => e.event_type === "Gol").length, "Gol"],
          [
            events.filter((e) =>
              ["Ammonizione", "Espulsione"].includes(e.event_type),
            ).length,
            "Cartellini",
          ],
        ].map(([count, label]) => (
          <div key={label}>
            <b>{count}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        onClick={() =>
          ui.open(
            "discipline",
            { playerId: id },
            { page: "players", detail: "discipline:" + id },
          )
        }
      >
        Cartellini e diffide
      </Button>
      <p className="row-sub">
        Dati della stagione selezionata. Il report permette di consultare tutto
        lo storico ed esportare il PDF.
      </p>
      <Button
        id="openPlayerReport"
        variant="secondary"
        onClick={async () => {
          if (!(await ui.close(surface.id))) return;
          runtime.state.reportPlayer = id;
          await runtime.navigate("reports");
        }}
      >
        Report e PDF del giocatore
      </Button>
      <details className="field-space">
        <summary>Presenze nello storico della stagione</summary>
        {attendance.map((row, i) => (
          <article className="row" key={row.id || i}>
            <span>
              {fmt(
                runtime.state.sessions.find((s) => s.id === row.session_id)
                  ?.session_date || "",
              )}
            </span>
            <b>{row.status}</b>
          </article>
        ))}
      </details>
      {manage ? (
        <>
          <details className="player-sheet-management">
            <summary>Dati e gestione giocatore</summary>
            <div className="player-sheet-actions">
              <Button
                id="editSheetPlayer"
                variant="secondary"
                onClick={async () => {
                  if (await editor.canLeave())
                    ui.replace(surface.id, "player-edit", { player: p });
                }}
              >
                Modifica dati giocatore
              </Button>
              <Button
                id="toggleSheetPlayer"
                variant={p.active ? "destructive" : "default"}
                disabled={editor.busy}
                onClick={() =>
                  void editor.run(async () => {
                    if (
                      p.active &&
                      !(await confirmDialog({
                        title: "Disattiva giocatore",
                        message: `Disattivare ${p.surname} ${p.name}? Lo storico resterà disponibile.`,
                        confirmLabel: "Disattiva",
                        danger: true,
                      }))
                    )
                      return;
                    if (!editor.current()) return;
                    await runtime.actions.setPlayerActive(p, !p.active);
                  })
                }
              >
                {p.active ? "Disattiva giocatore" : "Riattiva giocatore"}
              </Button>
            </div>
            <p className="row-sub">
              La disattivazione conserva presenze, partite e report.
            </p>
          </details>
          <form
            id="playerAdminForm"
            onSubmit={(e) => {
              e.preventDefault();
              void editor.run(async () => {
                const { error } = await runtime.db
                  .from("player_administration")
                  .upsert(
                    {
                      player_id: id,
                      user_id: teamOwner(),
                      registration_status: editor.value.registration_status,
                      certificate_until: editor.value.certificate_until || null,
                      document_until: editor.value.document_until || null,
                      emergency_contact:
                        editor.value.emergency_contact.trim() || null,
                    },
                    { onConflict: "player_id" },
                  );
                if (error) throw error;
                if (editor.current()) {
                  editor.clean();
                  await runtime.actions.reload();
                  editor.setError("Scheda salvata");
                }
              });
            }}
          >
            <h3 className="sheet-heading">Scadenze e tesseramento</h3>
            <fieldset disabled={editor.busy}>
              <Field id="registrationState" label="Tesseramento">
                <select
                  id="registrationState"
                  value={editor.value.registration_status}
                  onChange={(e) =>
                    editor.setValue({
                      ...editor.value,
                      registration_status: e.target.value,
                    })
                  }
                >
                  {["Da verificare", "In regola", "Da completare"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </Field>
              <div className="form-grid">
                {(
                  [
                    [
                      "certificate_until",
                      "Certificato valido fino al",
                      "certificateUntil",
                    ],
                    [
                      "document_until",
                      "Documento valido fino al",
                      "documentUntil",
                    ],
                    [
                      "emergency_contact",
                      "Contatto di emergenza",
                      "emergencyContact",
                    ],
                  ] as const
                ).map(([key, label, id]) => (
                  <Field id={id} label={label} key={key}>
                    <input
                      id={id}
                      type={key === "emergency_contact" ? "text" : "date"}
                      maxLength={300}
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
              <p className="row-sub">
                Registra solo scadenze e recapiti necessari, senza diagnosi o
                documenti sanitari.
              </p>
              <Button type="submit">Salva scheda</Button>
            </fieldset>
          </form>
        </>
      ) : null}
      <Feedback id="playerAdminStatus" error={editor.error} />
    </EditorFrame>
  );
}
export function Expiries({
  runtime,
  surface,
}: {
  runtime: Runtime;
  surface: Surface;
}) {
  const [filter, setFilter] = useState("all");
  if (!canViewExpiriesRole(runtime.state.team?.role || "")) return null;
  const summary = runtime.state.team?.role === "president",
    rows = expiringPlayers() as Administration[],
    statuses = (row: Administration) =>
      summary
        ? [row.certificate_status, row.document_status]
        : [
            documentState(row.certificate_until, today(), expiryLimit()),
            documentState(row.document_until, today(), expiryLimit()),
          ];
  const choices = [
      ["all", "Tutti"],
      ["missing", "Mancanti"],
      ["expired", "Scaduti"],
      ["soon", "In scadenza"],
      ["registration", "Tesseramento incompleto"],
    ],
    matches = (row: Administration, key: string) =>
      key === "all" ||
      (key === "registration" && row.registration_status !== "In regola") ||
      statuses(row).includes(
        (
          {
            missing: "Mancante",
            expired: "Scaduto",
            soon: "In scadenza",
          } as Record<string, string>
        )[key],
      );
  return (
    <EditorFrame
      surface={surface}
      title="Scadenze e tesseramenti"
      titleId="expiryTitle"
      className="expiry-page"
      closeLabel="Chiudi scadenze"
    >
      <p>
        {rows.length} giocatori da verificare
        {summary
          ? ". Consultazione sintetica: le date restano riservate alla segreteria."
          : ". Le date mancanti richiedono verifica; non sono scadenze già superate."}
      </p>
      <div className="expiry-filters" role="group" aria-label="Filtra scadenze">
        {choices.map(([key, label]) => (
          <button
            key={key}
            data-expiry-filter={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label} <span>{rows.filter((r) => matches(r, key)).length}</span>
          </button>
        ))}
      </div>
      <p id="expiryFilterSummary" className="row-sub">
        {rows.filter((r) => matches(r, filter)).length} giocatori mostrati
      </p>
      <div id="expiryList" className="list">
        {sortPlayers(runtime.state.players).flatMap((p) => {
          const d = rows.find((r) => r.player_id === p.id);
          if (!d || !matches(d, filter)) return [];
          const values = statuses(d);
          return (
            <button
              key={p.id}
              className="expiry-row"
              data-player-sheet={p.id}
              onClick={() => runtime.actions.playerSheet(p.id)}
            >
              <b>
                {p.surname} {p.name}
              </b>
              <span>
                Certificato: {values[0]}
                {!summary && d.certificate_until
                  ? ` · ${fmt(d.certificate_until)}`
                  : ""}
              </span>
              <span>
                Documento: {values[1]}
                {!summary && d.document_until
                  ? ` · ${fmt(d.document_until)}`
                  : ""}
              </span>
              <small>Tesseramento: {d.registration_status}</small>
            </button>
          );
        })}
      </div>
    </EditorFrame>
  );
}
