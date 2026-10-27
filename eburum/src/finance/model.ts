export type EditorMode =
  "account_edit" | "account" | "entry" | "transfer" | "reconcile" | "reverse";
export type Draft = {
  mode: EditorMode;
  account_id: string;
  destination_id: string;
  name: string;
  kind: string;
  date: string;
  amount: string;
  category: string;
  description: string;
  activity_id: string;
  entry_id: string;
  close_period: boolean;
};
export const date = (v: string) =>
  new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(
    new Date(v + "T12:00:00"),
  );
export const time = (v: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(v));
export const labels: Record<string, string> = {
  account: "Fondo aperto",
  account_edit: "Fondo modificato",
  account_remove: "Fondo eliminato o archiviato",
  account_restore: "Fondo riattivato",
  entry: "Movimento registrato",
  transfer: "Trasferimento",
  reverse: "Storno",
  reconcile: "Saldo verificato",
  receipt: "Ricevuta allegata",
  opening: "Saldo iniziale",
  income: "Entrata",
  expense: "Uscita",
  reversal: "Storno",
};
