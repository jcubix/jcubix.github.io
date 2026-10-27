import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { confirmDialog } from "../../app-confirm.js";
import { canManageFinanceRole, canViewFinanceRole } from "../../app-roles.ts";
import {
  exportCsv,
  exportFinancePdf,
  financeApi,
  localToday,
  money,
  parseCents,
  saveDownload,
  validateReceipt,
  type Entry,
  type FinanceData,
  type Fund,
  type Receipt,
} from "../finance-api";
import type { Runtime } from "../types";
import { Draft, EditorMode } from "./model";
export function useFinance({
  runtime,
  home = false,
}: {
  runtime: Runtime;
  home?: boolean;
}) {
  const role = runtime.state.team?.role || "",
    allowed = canViewFinanceRole(role),
    editable = canManageFinanceRole(role);
  const api = useMemo(() => financeApi(runtime), [runtime]);
  const [from, setFrom] = useState(localToday().slice(0, 4) + "-01-01"),
    [to, setTo] = useState(localToday()),
    [tab, setTab] = useState("funds"),
    [account, setAccount] = useState(""),
    [query, setQuery] = useState("");
  const [data, setData] = useState<FinanceData | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null),
    [file, setFile] = useState<File | null>(null),
    [committed, setCommitted] = useState<string | null>(null);
  const [fullEntries, setFullEntries] = useState<Entry[] | null>(null);
  const baseline = useRef(""),
    pending = useRef(false),
    sequence = useRef(0),
    alive = useRef(true),
    request = useRef(crypto.randomUUID()),
    receiptToken = useRef(crypto.randomUUID());
  const current = useCallback(() => alive.current && api.current(), [api]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, [api]);
  const reload = useCallback(async () => {
    const seq = ++sequence.current;
    if (!allowed) return;
    setLoading(true);
    setData(null);
    setError("");
    try {
      const next = await api.snapshot(from, to);
      if (current() && seq === sequence.current) {
        setData(next);
        setFullEntries(null);
      }
    } catch (e) {
      if (current() && seq === sequence.current)
        setError((e as Error).message || "Dati non caricati. Riprova.");
    } finally {
      if (current() && seq === sequence.current) setLoading(false);
    }
  }, [api, allowed, from, to, current]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const dirty =
    !!draft &&
    (JSON.stringify(draft) !== baseline.current || !!file || !!committed);
  const canLeave = useCallback(
    async (message: string) => {
      if (pending.current) return false;
      if (!dirty) return true;
      return (
        (await confirmDialog({ message, confirmLabel: "Scarta" })) &&
        current() &&
        !pending.current
      );
    },
    [dirty, current],
  );
  useLayoutEffect(() => {
    runtime.setNavigationGuard(() =>
      canLeave(
        committed
          ? "Il movimento è salvato. Uscire senza completare l’allegato?"
          : "Scartare le modifiche economiche non salvate?",
      ),
    );
    return () => runtime.setNavigationGuard(null);
  }, [runtime, canLeave, committed]);
  const stop = async () => {
    if (
      !(await canLeave(
        committed
          ? "Movimento già salvato: uscire senza completare la ricevuta?"
          : "Scartare la bozza non salvata?",
      ))
    )
      return;
    setDraft(null);
    setFile(null);
    setCommitted(null);
    setError("");
  };
  const activeFunds = data?.accounts.filter((a) => !a.archived_at) || [];
  const edit = (mode: EditorMode, fund?: Fund, entry?: Entry) => {
    if (!editable || pending.current || !data) return;
    const next: Draft = {
      mode,
      account_id: fund?.id || entry?.account_id || activeFunds[0]?.id || "",
      destination_id:
        activeFunds.find((a) => a.id !== (fund?.id || activeFunds[0]?.id))
          ?.id || "",
      name: mode === "account_edit" ? fund?.name || "" : "",
      kind:
        mode === "account_edit"
          ? fund?.kind || "cash"
          : mode === "account"
            ? "cash"
            : "expense",
      date:
        mode === "reconcile"
          ? to < localToday()
            ? to
            : localToday()
          : localToday(),
      amount:
        mode === "reconcile"
          ? ((fund?.balance_cents || 0) / 100).toFixed(2)
          : mode === "account"
            ? "0"
            : "",
      category: "Altro",
      description: "",
      activity_id: "",
      entry_id: entry?.id || "",
      close_period: false,
    };
    baseline.current = JSON.stringify(next);
    request.current = crypto.randomUUID();
    receiptToken.current = crypto.randomUUID();
    setDraft(next);
    setFile(null);
    setCommitted(null);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const field = (key: keyof Draft, value: string | boolean) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !draft) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (file) validateReceipt(file);
      let saved = committed;
      if (!saved) {
        const values: Record<string, unknown> = {
          date: draft.date,
          description: draft.description,
        };
        if (draft.mode === "account_edit") {
          const original = data?.accounts.find(
            (a) => a.id === draft.account_id,
          );
          if (!original)
            throw Error("Fondo non disponibile. Ricarica Economia.");
          Object.assign(values, {
            account_id: original.id,
            name: draft.name.trim(),
            kind: draft.kind,
            expected_name: original.name,
            expected_kind: original.kind,
          });
        } else if (draft.mode === "account")
          Object.assign(values, {
            name: draft.name.trim(),
            kind: draft.kind,
            amount_cents: parseCents(draft.amount, true),
          });
        else if (draft.mode === "reverse")
          Object.assign(values, { entry_id: draft.entry_id });
        else {
          Object.assign(values, {
            account_id: draft.account_id,
            amount_cents: parseCents(draft.amount, draft.mode === "reconcile"),
          });
          if (draft.mode === "entry")
            Object.assign(values, {
              kind: draft.kind,
              category: draft.category,
              activity_id: draft.activity_id || null,
            });
          if (draft.mode === "transfer")
            values.destination_id = draft.destination_id;
          if (draft.mode === "reconcile")
            values.close_period = draft.close_period;
        }
        let result;
        try {
          result = await api.mutate(draft.mode, values, request.current);
        } catch (e) {
          if (
            draft.mode !== "entry" ||
            !String((e as Error).message).startsWith("Possibile duplicato")
          )
            throw e;
          if (
            !(await confirmDialog({
              message:
                "Esiste già un movimento con data, importo e descrizione uguali. Registrare comunque un secondo movimento?",
            }))
          )
            return;
          result = await api.mutate(
            draft.mode,
            { ...values, allow_duplicate: true },
            request.current,
          );
        }
        if (!current()) return;
        saved = result.id;
        setCommitted(saved);
        if (draft.mode === "reconcile" && result.difference_cents)
          setNotice(
            `Verifica registrata. Differenza da controllare: ${money(result.difference_cents)}. Il saldo non è stato modificato.`,
          );
      }
      if (file && draft.mode === "entry")
        await api.receipt(saved, file, receiptToken.current);
      if (!current()) return;
      setDraft(null);
      setFile(null);
      setCommitted(null);
      setNotice((n) => n || "Registrazione salvata.");
      await reload();
    } catch (e) {
      if (current())
        setError(
          (e as Error).message ||
            "Registrazione non riuscita. La bozza è conservata.",
        );
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const run = async (task: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      if (current())
        setError((e as Error).message || "Operazione non riuscita. Riprova.");
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const downloadReceipt = (r: Receipt) =>
    run(async () => {
      const blob = await api.download(r);
      if (current()) saveDownload(blob, r.file_name);
    });
  const exportReport = (format: "csv" | "pdf") =>
    run(async () => {
      if (!data) return;
      const entries = await api.entries(from, to);
      if (!current()) return;
      if (format === "csv") exportCsv(entries, data.accounts, from, to);
      else await exportFinancePdf(data, entries, from, to, current);
    });
  const loadAll = () =>
    run(async () => {
      const entries = await api.entries(from, to);
      if (current()) setFullEntries(entries);
    });

  const entries = (fullEntries || data?.entries || []).filter(
    (e) =>
      (!account || e.account_id === account) &&
      [e.description, e.category, e.actor_label]
        .join(" ")
        .toLocaleLowerCase("it")
        .includes(query.toLocaleLowerCase("it")),
  );
  const manageFund = (
    fund: Fund,
    action: "account_remove" | "account_restore",
  ) => {
    if (!editable || pending.current) return;
    const token = crypto.randomUUID();
    void run(async () => {
      const accepted = await confirmDialog({
        message:
          action === "account_restore"
            ? "Riattivare questo fondo per nuove registrazioni?"
            : "Eliminare questo fondo? Se ha soltanto un saldo iniziale, verranno rimossi il fondo e quel saldo dal totale. Se è già stato usato, il saldo deve essere zero e lo storico verrà conservato tramite archiviazione. L’operazione resta tracciata.",
      });
      if (!accepted || !current()) return;
      const result = await api.mutate(
        action,
        {
          account_id: fund.id,
          expected_name: fund.name,
          expected_kind: fund.kind,
          remove_unused_initial: action === "account_remove",
        },
        token,
      );
      if (!current()) return;
      setNotice(
        action === "account_restore"
          ? "Fondo riattivato."
          : result.removed_initial
            ? "Fondo e saldo iniziale rimossi. L’operazione resta nello storico."
            : result.archived
              ? "Fondo archiviato. Lo storico è conservato."
              : "Fondo vuoto eliminato.",
      );
      if (account === fund.id) setAccount("");
      await reload();
    });
  };
  const fundNames = new Map((data?.accounts || []).map((a) => [a.id, a.name]));
  const changeRange = (key: "from" | "to", value: string) => {
    if (pending.current) return;
    if (key === "from") setFrom(value);
    else setTo(value);
  };

  return {
    account,
    activeFunds,
    allowed,
    api,
    busy,
    changeRange,
    committed,
    data,
    downloadReceipt,
    draft,
    edit,
    editable,
    entries,
    error,
    exportReport,
    field,
    from,
    fullEntries,
    fundNames,
    home,
    loadAll,
    loading,
    manageFund,
    notice,
    pending,
    query,
    receiptToken,
    reload,
    role,
    run,
    runtime,
    save,
    setAccount,
    setFile,
    setQuery,
    setTab,
    stop,
    tab,
    to,
  };
}
