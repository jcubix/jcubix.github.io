// Team membership is authoritative; these capabilities only shape the interface.
const roleLabels = {
  admin: "Amministratore",
  manager: "Team manager",
  coach: "Allenatore",
  secretary: "Segretario",
  technical_assistant: "Collaboratore tecnico",
  president: "Presidente",
  treasurer: "Tesoriere",
};
const roleHelp = {
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
const canOperateRole = (role) =>
  ["admin", "manager", "coach", "technical_assistant"].includes(role);
const canPlanRole = (role) => ["admin", "manager", "coach"].includes(role);
const canManageRole = (role) =>
  ["admin", "manager", "secretary"].includes(role);
const canViewExpiriesRole = (role) =>
  canManageRole(role) || role === "president";
const canTechnicalRole = (role) =>
  ["admin", "coach", "technical_assistant"].includes(role);
const canViewFinanceRole = (role) => ["admin", "treasurer", "president"].includes(role);
const canManageFinanceRole = (role) => ["admin", "treasurer"].includes(role);
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
