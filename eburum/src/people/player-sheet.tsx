import { confirmDialog } from "../../app-confirm.js";
import { fmt, teamOwner } from "../../app-part1.js";
import { canManageRole } from "../../app-roles.ts";
import { Button } from "../components/ui/button";
import { EditorFrame, Feedback, Field, useEditor } from "../operational-ui";
import type { Administration, Runtime } from "../types";
import { ui, type Surface } from "../ui-service";

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
                  await runtime.actions.reloadAffected({
                    kind: "administration",
                  });
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
