import type { TeamRole } from "./src/types";
// Team membership is authoritative; these capabilities only shape the interface.
const roleLabels: Record<TeamRole, string> = {
  admin: "Amministratore",
  manager: "Team manager",
  coach: "Allenatore",
  secretary: "Segretario",
  technical_assistant: "Collaboratore tecnico",
  president: "Presidente",
  treasurer: "Tesoriere",
};
const roleHelp: Record<TeamRole, string> = {
  admin:
    "Gestione completa, incluse utenze, nominativi, ruoli e password degli altri utenti.",
  manager:
    "Organizzazione, presenze, partite, rosa e documenti. Nessuna gestione delle utenze o accesso alle note tecniche riservate.",
  coach:
    "Organizzazione, presenze, partite e scheda tecnica. Nessuna gestione delle utenze, dei documenti o modifica della rosa.",
  secretary:
    "Rosa, tesseramenti, documenti e scadenze. Consulta presenze, partite e report; nessuna modifica sportiva o accesso alle note tecniche riservate.",
  technical_assistant:
    "Registra risposte WhatsApp, presenze, risultati ed eventi. Consulta convocazioni e formazione; modifica le osservazioni tecniche. Nessuna gestione di organizzazione, rosa, documenti o utenze.",
  president:
    "Consulta calendario, rosa, risultati, report e stato sintetico delle scadenze. Pubblica comunicazioni. Nessuna modifica sportiva, accesso alle note tecniche, dettagli amministrativi o gestione utenze.",
  treasurer:
    "Gestisce fondi, movimenti, ricevute e rendiconti. Consulta calendario e comunicazioni. Nessuna modifica sportiva, accesso alle note tecniche, documenti personali o gestione utenze.",
};
const canOperateRole = (role: string | null | undefined) =>
  ["admin", "manager", "coach", "technical_assistant"].includes(role || "");
const canPlanRole = (role: string | null | undefined) =>
  ["admin", "manager", "coach"].includes(role || "");
const canManageRole = (role: string | null | undefined) =>
  ["admin", "manager", "secretary"].includes(role || "");
const canViewExpiriesRole = (role: string | null | undefined) =>
  canManageRole(role) || role === "president";
const canTechnicalRole = (role: string | null | undefined) =>
  ["admin", "coach", "technical_assistant"].includes(role || "");
const canViewFinanceRole = (role: string | null | undefined) =>
  ["admin", "treasurer", "president"].includes(role || "");
const canManageFinanceRole = (role: string | null | undefined) =>
  ["admin", "treasurer"].includes(role || "");
export {
  roleLabels,
  roleHelp,
  canOperateRole,
  canPlanRole,
  canManageRole,
  canViewExpiriesRole,
  canTechnicalRole,
  canViewFinanceRole,
  canManageFinanceRole,
};
