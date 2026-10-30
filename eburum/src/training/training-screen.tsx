import { CalendarDays, ChevronRight, Plus, Presentation } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { fmt, today } from "../../app-part1.js";
import { canPlanRole, canTechnicalRole } from "../../app-roles.ts";
import { Button } from "../components/ui/button";
import { Field } from "../operational-ui";
import type { Runtime } from "../types";
import { AttendanceEditor } from "./attendance-editor";
import { PlanningEditor } from "./planning-editor";
export function TrainingScreen({ runtime }: { runtime: Runtime }) {
  const activities = [...runtime.state.activities]
    .filter((a) => a.activity_type === "Allenamento")
    .sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  const [scope, setScope] = useState(
      () =>
        new URLSearchParams(location.hash.split("?")[1]).get("scope") ||
        (activities.some(
          (a) =>
            a.status === "Programmato" &&
            !a.session_id &&
            a.activity_date >= today(),
        )
          ? "upcoming"
          : "actual"),
    ),
    [selected, setSelected] = useState(
      () =>
        new URLSearchParams(location.hash.split("?")[1]).get("activity") || "",
    );
  const filtered = activities.filter(
    (a) =>
      a.status === "Programmato" &&
      !a.session_id &&
      (scope === "actual"
        ? a.activity_date <= today()
        : a.activity_date >= today()),
  );
  const current = filtered.find((a) => a.id === selected) || filtered[0];
  const change = async (value: string, id?: string) => {
    if (!(await runtime.canLeaveInline())) return;
    setScope(value);
    if (id) setSelected(id);
  };
  if (runtime.state.trainingMode === "actual")
    return <AttendanceEditor runtime={runtime} />;
  return (
    <div className="sc-surface">
      <div className="sc-page-heading page-heading">
        <div>
          <h1>Allenamenti</h1>
          <p>Programma, presenze e storico</p>
        </div>
        {canPlanRole(runtime.state.team?.role || "") ? (
          <Button
            className="sc-add page-add-action"
            aria-label="Nuovo allenamento"
            onClick={runtime.actions.newTraining}
          >
            <Plus />
            <span className="page-add-label">Nuovo allenamento</span>
          </Button>
        ) : null}
      </div>
      <div
        className="training-scope segmented"
        role="group"
        aria-label="Allenamenti"
      >
        <button
          aria-pressed={scope === "upcoming"}
          onClick={() => void change("upcoming")}
        >
          Prossimi
        </button>
        <button
          aria-pressed={scope === "actual"}
          onClick={() => void change("actual")}
        >
          Da confermare
          <span className="filter-count">
            {
              activities.filter(
                (a) =>
                  a.status === "Programmato" &&
                  !a.session_id &&
                  a.activity_date <= today(),
              ).length
            }
          </span>
        </button>
      </div>
      {filtered.length > 1 ? (
        <Field id="trainingActivity" label="Allenamento">
          <select
            id="trainingActivity"
            value={current?.id || ""}
            onChange={(e) => void change(scope, e.target.value)}
          >
            {filtered.map((a) => (
              <option key={a.id} value={a.id}>
                {fmt(a.activity_date)} · {a.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {current ? (
        <>
          <div className="sc-activity-line">
            <div className="sc-date-tile">
              <b>{Number(current.activity_date.slice(8))}</b>
              <small>
                {new Intl.DateTimeFormat("it-IT", { month: "short" })
                  .format(new Date(current.activity_date + "T12:00:00"))
                  .toLocaleUpperCase("it")}
              </small>
            </div>
            <div>
              <h2>{current.title}</h2>
              <p>
                {current.start_time?.slice(0, 5)}
                {current.location ? ` · ${current.location}` : ""}
              </p>
              <div
                className="training-reply-bars"
                aria-label="Previsione presenze"
              >
                {[
                  ["Disponibile", "Attesi", ""],
                  ["Indisponibile", "Assenti previsti", "text-destructive"],
                ].map(([value, label, tone]) => (
                  <span key={value} className={tone}>
                    {label}{" "}
                    {
                      runtime.actions
                        .pollEntries(current)
                        .filter((r) =>
                          value === "Indisponibile"
                            ? r.row.availability === value
                            : r.row.availability !== "Indisponibile",
                        ).length
                    }
                  </span>
                ))}
              </div>
            </div>
            <span className="office-status sc-status">{current.status}</span>
          </div>
          {canTechnicalRole(runtime.state.team?.role || "") ? (
            <NavLink
              className="sc-secondary training-whiteboard-link"
              to={`/whiteboard?activity=${encodeURIComponent(current.id)}`}
            >
              <Presentation size={18} />
              Crea lavagna per l’allenamento
            </NavLink>
          ) : null}
          <section
            className="sc-inline-training"
            aria-label="Gestione allenamento"
          >
            <PlanningEditor
              key={current.id}
              runtime={runtime}
              surface={{
                id: -1,
                kind: "planning",
                data: {
                  activity: current,
                  rows: runtime.state.roster.filter(
                    (r) => r.activity_id === current.id,
                  ),
                },
              }}
              inline
            />
          </section>
        </>
      ) : (
        <div className="sc-empty-state">
          <h3>Nessun allenamento in questo elenco</h3>
          <p>Consulta il Registro per gli allenamenti precedenti.</p>
          <Button
            variant="secondary"
            onClick={() => void runtime.navigate("register")}
          >
            Apri Registro
          </Button>
        </div>
      )}
      <NavLink className="utility-link training-register-link" to="/register">
        <CalendarDays size={20} />
        <span className="utility-copy">
          <b>Registro degli allenamenti</b>
          <small>
            Presenze, note e schede degli allenamenti passati o annullati
          </small>
        </span>
        <ChevronRight size={18} />
      </NavLink>
    </div>
  );
}
