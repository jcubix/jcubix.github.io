import { ensureJsPdf } from "../app-pdf-loader.js";
import type { Runtime } from "./types";
import { canManageFinanceRole, canViewFinanceRole } from "../app-roles.js";

export interface Fund {
  id: string;
  name: string;
  kind: "cash" | "bank";
  opened_on: string;
  closed_through: string | null;
  archived_at?: string | null;
  balance_cents: number;
}
export interface Receipt {
  id: string;
  object_path: string;
  file_name: string;
  size_bytes: number;
}
export interface Entry {
  id: string;
  account_id: string;
  entry_date: string;
  kind: string;
  economic_type: string;
  amount_cents: number;
  category: string;
  description: string;
  actor_label: string;
  created_at: string;
  reversed?: boolean;
  receipts?: Receipt[];
  activity_id?: string | null;
  reverses_id?: string | null;
}
export interface Reconciliation {
  id: string;
  account_id: string;
  checked_on: string;
  observed_cents: number;
  ledger_cents: number;
  closes_period: boolean;
  note: string;
  actor_label: string;
  created_at: string;
}
export interface FinanceData {
  accounts: Fund[];
  entries: Entry[];
  entry_count: number;
  totals: {
    opening: number;
    closing: number;
    initial: number;
    income: number;
    expense: number;
  };
  categories: {
    category: string;
    economic_type: string;
    amount_cents: number;
  }[];
  reconciliations: Reconciliation[];
  audit: {
    id: string;
    action: string;
    entity_id: string;
    actor_label: string;
    created_at: string;
    details: Record<string, unknown>;
  }[];
}
export const categories = [
  "Sponsor",
  "Contributi",
  "Materiale",
  "Campi",
  "Trasferte",
  "Rimborsi",
  "Altro",
];
export const money = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    cents === 0 ? 0 : cents / 100,
  );
export function parseCents(value: string, signed = false): number {
  const raw = value.trim().replace(",", ".");
  if (!(signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(raw))
    throw Error(
      "Inserisci un importo con al massimo due decimali, senza separatori delle migliaia.",
    );
  const negative = raw.startsWith("-"),
    [whole, fraction = ""] = raw.replace("-", "").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 10000000000)
    throw Error("Importo fuori dall’intervallo consentito.");
  return negative ? -amount : amount;
}
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function validateReceipt(file: File) {
  if (
    file.size < 1 ||
    file.size > 10485760 ||
    !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
      file.type,
    )
  )
    throw Error("Usa un PDF o un’immagine JPG, PNG o WebP fino a 10 MB.");
}
export function financeApi(runtime: Runtime) {
  const sessionCurrent = runtime.requestGuard();
  const actor = runtime.state.user?.id,
    owner = runtime.state.team?.owner_id,
    role = runtime.state.team?.role;
  const current = () =>
    sessionCurrent() &&
    !!actor &&
    runtime.state.user?.id === actor &&
    runtime.state.team?.owner_id === owner &&
    runtime.state.team?.role === role;
  const guard = (write = false) => {
    if (
      !current() ||
      !(write
        ? canManageFinanceRole(role || "")
        : canViewFinanceRole(role || ""))
    )
      throw Error("Sessione o permessi cambiati. Riapri Economia.");
  };
  const mutate = async (
    action: string,
    values: Record<string, unknown>,
    requestId: string,
  ) => {
    guard(true);
    const { data, error } = await runtime.db.rpc("finance_mutate", {
      p_action: action,
      p_values: values,
      p_request_id: requestId,
    });
    guard(true);
    if (error) throw error;
    return data as {
      id: string;
      difference_cents?: number;
      archived?: boolean;
      removed_initial?: boolean;
    };
  };
  return {
    current,
    mutate,
    snapshot: async (from: string, to: string) => {
      guard();
      const { data, error } = await runtime.db.rpc("finance_snapshot", {
        p_from: from,
        p_to: to,
      });
      guard();
      if (error) throw error;
      return data as FinanceData;
    },
    entries: async (from: string, to: string, account = "") => {
      guard();
      const rows: Entry[] = [];
      for (let offset = 0; ; offset += 500) {
        let q = runtime.db
          .from("finance_entries")
          .select("*,receipts:finance_receipts(*)")
          .eq("user_id", owner!)
          .gte("entry_date", from)
          .lte("entry_date", to)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id");
        if (account) q = q.eq("account_id", account);
        const { data, error } = await q.range(offset, offset + 499);
        guard();
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < 500) break;
      }
      const reversed = new Set<string>();
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await runtime.db
          .from("finance_entries")
          .select("reverses_id")
          .eq("user_id", owner!)
          .eq("kind", "reversal")
          .order("id")
          .range(offset, offset + 499);
        guard();
        if (error) throw error;
        for (const entry of data || [])
          if (entry.reverses_id) reversed.add(entry.reverses_id);
        if ((data || []).length < 500) break;
      }
      return rows.map((entry) => ({
        ...entry,
        reversed: reversed.has(entry.id),
      }));
    },
    receipt: async (entryId: string, file: File, token: string) => {
      guard(true);
      validateReceipt(file);
      const ext = (
          {
            "application/pdf": "pdf",
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
          } as Record<string, string>
        )[file.type],
        path = `${owner}/${entryId}/${token}.${ext}`;
      const { error } = await runtime.db.storage
        .from("finance-receipts")
        .upload(path, file, { contentType: file.type, upsert: false });
      guard(true);
      if (error && !/already exists|duplicate/i.test(error.message))
        throw error;
      return mutate(
        "receipt",
        {
          entry_id: entryId,
          object_path: path,
          file_name: file.name.slice(0, 200),
        },
        token,
      );
    },
    download: async (receipt: Receipt) => {
      guard();
      const { data, error } = await runtime.db.storage
        .from("finance-receipts")
        .download(receipt.object_path);
      guard();
      if (error) throw error;
      return data!;
    },
  };
}
export function saveDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCsv(
  entries: Entry[],
  funds: Fund[],
  from: string,
  to: string,
) {
  const cell = (v: unknown) => {
    let s =
      typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v ?? "");
    if (typeof v !== "number" && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const names = new Map(funds.map((a) => [a.id, a.name]));
  const rows = [
    [
      "Data",
      "Fondo",
      "Tipo",
      "Categoria",
      "Descrizione",
      "Importo EUR",
      "Autore",
      "ID",
      "Storno di",
    ],
    ...entries.map((e) => [
      e.entry_date,
      names.get(e.account_id) || "Fondo",
      e.kind,
      e.category,
      e.description,
      e.amount_cents / 100,
      e.actor_label,
      e.id,
      e.reverses_id || "",
    ]),
  ];
  saveDownload(
    new Blob(["\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    `Eburum-economia-${from}-${to}.csv`,
  );
}
export async function exportFinancePdf(
  data: FinanceData,
  entries: Entry[],
  from: string,
  to: string,
  current: () => boolean = () => true,
) {
  await ensureJsPdf();
  if (!current()) throw Error("Sessione cambiata. Riapri il rendiconto.");
  const js = window.jspdf as
    | {
        jsPDF: new () => {
          setFontSize: (n: number) => void;
          text: (s: string | string[], x: number, y: number) => void;
          splitTextToSize: (s: string, w: number) => string[];
          addPage: () => void;
          save: (n: string) => void;
        };
      }
    | undefined;
  if (!js) throw Error("Esportazione PDF non disponibile. Ricarica e riprova.");
  const doc = new js.jsPDF();
  let y = 20;
  const line = (text: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 175);
    for (const s of lines) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(s, 18, y);
      y += size === 16 ? 9 : 6;
    }
  };
  line("EBURUM · Rendiconto fondi", 16);
  line(`Periodo ${from} – ${to}`);
  line(
    `Saldo precedente: ${money(data.totals.opening)} · Saldi iniziali registrati: ${money(data.totals.initial)}`,
  );
  line(
    `Entrate nette: ${money(data.totals.income)} · Uscite nette: ${money(data.totals.expense)}`,
  );
  line(`Disponibilità al ${to}: ${money(data.totals.closing)}`);
  line(
    "Trasferimenti interni esclusi da entrate e uscite. Storni inclusi nel periodo della registrazione.",
  );
  y += 6;
  for (const a of data.accounts)
    line(
      `${a.name} · ${a.kind === "cash" ? "Cassa" : "Conto"}: ${money(a.balance_cents)}`,
    );
  y += 6;
  line("Movimenti del periodo", 16);
  const names = new Map(data.accounts.map((a) => [a.id, a.name]));
  for (const e of entries) {
    line(
      `${e.entry_date} · ${names.get(e.account_id) || "Fondo"} · ${money(e.amount_cents)}`,
    );
    line(`${e.category} · ${e.description}`);
    line(`Registrato da ${e.actor_label}`);
    y += 3;
  }
  doc.save(`Eburum-rendiconto-${from}-${to}.pdf`);
}
