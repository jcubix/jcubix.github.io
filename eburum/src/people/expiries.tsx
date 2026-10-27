import { useState } from "react";
import { fmt, sortPlayers, today } from "../../app-part1.js";
import { canViewExpiriesRole } from "../../app-roles.ts";
import { expiringPlayers, expiryLimit } from "../../app-team.js";
import { documentState } from "../../app-workflow-tools.js";
import { EditorFrame } from "../operational-ui";
import type { Administration, Runtime } from "../types";
import { type Surface } from "../ui-service";

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
