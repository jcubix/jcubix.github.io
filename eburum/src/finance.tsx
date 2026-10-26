import { LoadingState } from "./components/ui/loading-state";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { NavLink } from "react-router-dom";
import {
  Plus,
  Wallet,
  MessageSquare,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  RefreshCw,
  FileDown,
  Paperclip,
  CheckCheck,
  Undo2,
} from "lucide-react";
import { canViewFinanceRole, canManageFinanceRole } from "../app-roles.js";
import { confirmDialog } from "../app-confirm.js";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { PageHeading } from "./pages";
import {
  financeApi,
  localToday,
  money,
  parseCents,
  validateReceipt,
  categories,
  exportCsv,
  exportFinancePdf,
  saveDownload,
  type FinanceData,
  type Entry,
  type Fund,
  type Receipt,
} from "./finance-api";
import type { Runtime } from "./types";

type EditorMode =
  "account_edit" | "account" | "entry" | "transfer" | "reconcile" | "reverse";
type Draft = {
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
const date = (v: string) =>
  new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(
    new Date(v + "T12:00:00"),
  );
const time = (v: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(v));
const labels: Record<string, string> = {
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

export function FinancePage({
  runtime,
  home = false,
}: {
  runtime: Runtime;
  home?: boolean;
}) {
  const role = runtime.state.team?.role || "",
    allowed = canViewFinanceRole(role),
    editable = canManageFinanceRole(role);
  const api = useMemo(
    () => financeApi(runtime),
    [runtime, role, runtime.state.team?.owner_id, runtime.state.user?.id],
  );
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
  const current = () => alive.current && api.current();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      sequence.current++;
    };
  }, [api]);
  const reload = async () => {
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
  };
  useEffect(() => {
    void reload();
  }, [api, from, to, allowed]);
  const dirty =
    !!draft &&
    (JSON.stringify(draft) !== baseline.current || !!file || !!committed);
  const canLeave = async (message: string) => {
    if (pending.current) return false;
    if (!dirty) return true;
    return (
      (await confirmDialog({ message, confirmLabel: "Scarta" })) &&
      current() &&
      !pending.current
    );
  };
  useLayoutEffect(() => {
    runtime.setNavigationGuard(() =>
      canLeave(
        committed
          ? "Il movimento è salvato. Uscire senza completare l’allegato?"
          : "Scartare le modifiche economiche non salvate?",
      ),
    );
    return () => runtime.setNavigationGuard(null);
  }, [runtime, dirty, committed]);
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
  if (!allowed)
    return (
      <div className="sc-surface">
        <PageHeading
          title="Economia"
          description="Area riservata ad amministratore, tesoriere e presidente."
        />
        <NavLink className="sc-secondary" to="/more">
          Torna ad Altro
        </NavLink>
      </div>
    );
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
  return (
    <div className="sc-surface sc-finance">
      <PageHeading
        title={
          home
            ? `Bentornato${runtime.state.team?.first_name ? ", " + runtime.state.team.first_name : ""}`
            : "Economia"
        }
        description={
          home
            ? "Fondi e registrazioni della squadra."
            : "Fondi, movimenti e rendiconto dello staff."
        }
      >
        {!home && editable && !draft && (
          <Button
            className="sc-add"
            size="icon"
            aria-label="Nuovo movimento"
            disabled={busy || loading || !activeFunds.length}
            onClick={() => edit("entry")}
          >
            <Plus />
          </Button>
        )}
      </PageHeading>
      {error && (
        <div className="finance-feedback" role="alert">
          <p>
            {committed
              ? "Registrazione già salvata. Completa la ricevuta o esci: il movimento non verrà duplicato. "
              : ""}
            {error}
          </p>
          {!draft && (
            <Button
              variant="secondary"
              className="sc-secondary"
              disabled={busy || loading}
              onClick={() => void reload()}
            >
              Riprova caricamento
            </Button>
          )}
        </div>
      )}
      {notice && (
        <p className="finance-feedback" role="status">
          {notice}
        </p>
      )}
      {draft ? (
        <section
          className="finance-editor"
          aria-labelledby="financeEditorTitle"
        >
          <div className="sc-section-heading">
            <h3 id="financeEditorTitle">
              {
                {
                  account: "Nuovo fondo",
                  account_edit: "Modifica fondo",
                  entry: "Nuovo movimento",
                  transfer: "Trasferimento tra fondi",
                  reconcile: "Verifica saldo",
                  reverse: "Storna movimento",
                }[draft.mode]
              }
            </h3>
            <Button
              variant="secondary"
              className="sc-secondary"
              disabled={busy}
              onClick={stop}
            >
              Annulla
            </Button>
          </div>
          <p className="sc-helper">
            {draft.mode === "account_edit"
              ? "Puoi modificare nome e tipo. Saldo, apertura e movimenti restano nello storico."
              : draft.mode === "reverse"
                ? "L’originale resta nella cronologia. Lo storno registra un movimento opposto; poi puoi inserire quello corretto."
                : draft.mode === "account"
                  ? "Inserisci il saldo reale alla data di apertura. Non viene contato come un’entrata della squadra."
                  : draft.mode === "reconcile"
                    ? "Confronta il saldo registrato con quello di cassa o conto. La verifica non crea movimenti."
                    : "Registra soltanto somme effettivamente incassate o pagate. Importi in euro."}
          </p>
          <form onSubmit={save}>
            <fieldset
              disabled={busy || !!committed}
              className="finance-form-grid"
            >
              {draft.mode === "account" || draft.mode === "account_edit" ? (
                <>
                  <label>
                    Nome fondo
                    <Input
                      required
                      maxLength={100}
                      value={draft.name}
                      onChange={(e) => field("name", e.target.value)}
                      placeholder="Es. Cassa squadra"
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={draft.kind}
                      onChange={(e) => field("kind", e.target.value)}
                    >
                      <option value="cash">Cassa</option>
                      <option value="bank">Conto corrente</option>
                    </select>
                  </label>
                </>
              ) : (
                draft.mode !== "reverse" && (
                  <label>
                    {draft.mode === "transfer" ? "Fondo di origine" : "Fondo"}
                    <select
                      required
                      value={draft.account_id}
                      onChange={(e) => field("account_id", e.target.value)}
                    >
                      {activeFunds.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              )}
              {draft.mode === "entry" && (
                <label>
                  Tipo
                  <select
                    value={draft.kind}
                    onChange={(e) => field("kind", e.target.value)}
                  >
                    <option value="expense">Uscita</option>
                    <option value="income">Entrata</option>
                  </select>
                </label>
              )}
              {draft.mode === "transfer" && (
                <label>
                  Destinazione
                  <select
                    required
                    value={draft.destination_id}
                    onChange={(e) => field("destination_id", e.target.value)}
                  >
                    <option value="">Seleziona un fondo</option>
                    {activeFunds
                      .filter((a) => a.id !== draft.account_id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {draft.mode !== "account_edit" && (
                <label>
                  {draft.mode === "reconcile" ? "Verificato al" : "Data"}
                  <Input
                    required
                    type="date"
                    max={localToday()}
                    value={draft.date}
                    onChange={(e) => field("date", e.target.value)}
                  />
                </label>
              )}
              {draft.mode !== "reverse" && draft.mode !== "account_edit" && (
                <label>
                  {draft.mode === "account"
                    ? "Saldo iniziale (€)"
                    : draft.mode === "reconcile"
                      ? "Saldo osservato (€)"
                      : "Importo (€)"}
                  <Input
                    required
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(e) => field("amount", e.target.value)}
                    placeholder="0,00"
                  />
                </label>
              )}
              {draft.mode === "entry" && (
                <>
                  <label>
                    Categoria
                    <select
                      value={draft.category}
                      onChange={(e) => field("category", e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Attività collegata
                    <select
                      value={draft.activity_id}
                      onChange={(e) => field("activity_id", e.target.value)}
                    >
                      <option value="">Nessuna</option>
                      {runtime.state.activities.map((a) => (
                        <option key={a.id} value={a.id}>
                          {date(a.activity_date)} · {a.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {draft.mode !== "account" && draft.mode !== "account_edit" && (
                <label className="finance-wide">
                  {draft.mode === "reverse"
                    ? "Motivo dello storno"
                    : draft.mode === "reconcile"
                      ? "Nota della verifica"
                      : "Descrizione"}
                  <textarea
                    required
                    maxLength={draft.mode === "reverse" ? 200 : 1000}
                    rows={3}
                    value={draft.description}
                    onChange={(e) => field("description", e.target.value)}
                    placeholder="Descrivi la registrazione"
                  />
                </label>
              )}
              {draft.mode === "reconcile" && (
                <label className="finance-wide finance-check">
                  <input
                    type="checkbox"
                    checked={draft.close_period}
                    onChange={(e) => field("close_period", e.target.checked)}
                  />
                  Chiudi questo fondo fino alla data della verifica
                </label>
              )}
            </fieldset>
            {draft.mode === "entry" && (
              <label className="finance-file">
                Ricevuta facoltativa · PDF o immagine, massimo 10 MB
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    receiptToken.current = crypto.randomUUID();
                  }}
                />
              </label>
            )}
            {draft.mode === "reconcile" && (
              <p className="sc-helper">
                La chiusura richiede saldi coincidenti e impedisce nuove
                registrazioni con data precedente o uguale. Le rettifiche
                successive restano possibili con una nuova data.
              </p>
            )}
            <Button
              className="sc-primary finance-save"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Salvataggio…"
                : committed
                  ? "Riprova caricamento ricevuta"
                  : "Conferma e salva"}
            </Button>
          </form>
        </section>
      ) : (
        <>
          {!home && (
            <div className="finance-period">
              <label>
                Dal
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => changeRange("from", e.target.value)}
                />
              </label>
              <label>
                Al
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => changeRange("to", e.target.value)}
                />
              </label>
              <Button
                size="icon"
                variant="secondary"
                className="sc-secondary"
                aria-label="Aggiorna economia"
                disabled={busy || loading}
                onClick={() => void reload()}
              >
                <RefreshCw size={19} />
              </Button>
            </div>
          )}
          {loading && !data ? (
            <LoadingState label="Caricamento fondi e movimenti…" />
          ) : (
            data && (
              <>
                <div
                  className="finance-summary"
                  aria-label="Riepilogo del periodo"
                  aria-busy={loading}
                >
                  <div>
                    <span>Disponibilità al {date(to)}</span>
                    <strong>{money(data.totals.closing)}</strong>
                  </div>
                  <div>
                    <span>Entrate nette</span>
                    <b>{money(data.totals.income)}</b>
                  </div>
                  <div>
                    <span>Uscite nette</span>
                    <b>{money(data.totals.expense)}</b>
                  </div>
                </div>
                {home ? (
                  <>
                    <NavLink
                      className="sc-primary finance-home-link"
                      to="/finance"
                    >
                      Apri Economia
                      <ArrowUpRight size={19} />
                    </NavLink>
                    <p className="sc-helper">
                      Il saldo comprende cassa e conti. I trasferimenti interni
                      non sono entrate o uscite.
                    </p>
                    <div className="sc-rows finance-home-communications">
                      <NavLink className="sc-list-row" to="/communications">
                        <span className="sc-row-icon">
                          <MessageSquare size={21} />
                        </span>
                        <span className="sc-row-copy">
                          <strong>Messaggi dello staff</strong>
                          <small>
                            Consulta gli aggiornamenti della squadra
                          </small>
                        </span>
                        <ArrowUpRight size={18} />
                      </NavLink>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="sc-segmented finance-tabs"
                      role="group"
                      aria-label="Sezione economia"
                    >
                      {[
                        ["funds", "Fondi"],
                        ["entries", "Movimenti"],
                        ["report", "Rendiconto"],
                        ["history", "Storico"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          aria-pressed={tab === key}
                          onClick={() => {
                            if (!pending.current) setTab(key);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {tab === "funds" && (
                      <section aria-label="Fondi della squadra">
                        <div className="sc-section-heading">
                          <h3>Cassa e conti</h3>
                          {editable && data.accounts.length > 0 && (
                            <Button
                              variant="secondary"
                              className="sc-secondary"
                              disabled={busy || loading}
                              onClick={() => edit("account")}
                            >
                              Aggiungi fondo
                            </Button>
                          )}
                        </div>
                        {!data.accounts.length ? (
                          <div className="sc-empty-state">
                            <Wallet aria-hidden="true" />
                            <h3>Nessun fondo registrato</h3>
                            <p>
                              {editable
                                ? "Aggiungi il primo fondo con data di apertura e saldo effettivo."
                                : "L’amministratore o il tesoriere può aggiungere il primo fondo."}
                            </p>
                            {editable ? (
                              <Button onClick={() => edit("account")}>
                                Aggiungi fondo
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="finance-fund-list">
                            {data.accounts.map((a) => (
                              <article key={a.id} className="finance-fund">
                                <div className="finance-fund-main">
                                  <span className="sc-row-icon">
                                    {a.kind === "cash" ? (
                                      <Wallet />
                                    ) : (
                                      <Landmark />
                                    )}
                                  </span>
                                  <div>
                                    <h4>{a.name}</h4>
                                    <p>
                                      {a.kind === "cash"
                                        ? "Cassa"
                                        : "Conto corrente"}{" "}
                                      · Dal {date(a.opened_on)}
                                    </p>
                                  </div>
                                  <strong
                                    className={
                                      a.balance_cents < 0
                                        ? "finance-negative"
                                        : ""
                                    }
                                  >
                                    {money(a.balance_cents)}
                                  </strong>
                                </div>
                                {a.balance_cents < 0 && (
                                  <p className="sc-helper">
                                    Saldo negativo: verifica disponibilità e
                                    registrazioni.
                                  </p>
                                )}
                                <p className="sc-helper">
                                  {a.closed_through
                                    ? "Chiuso fino al " + date(a.closed_through)
                                    : "Nessun periodo chiuso"}
                                </p>
                                {a.archived_at && (
                                  <p className="sc-helper">
                                    Archiviato · Storico conservato
                                  </p>
                                )}
                                {editable && (
                                  <div className="finance-fund-actions">
                                    {a.archived_at ? (
                                      <Button
                                        variant="secondary"
                                        className="sc-secondary"
                                        disabled={busy}
                                        onClick={() =>
                                          manageFund(a, "account_restore")
                                        }
                                      >
                                        Riattiva fondo
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          variant="secondary"
                                          className="sc-secondary"
                                          disabled={busy}
                                          onClick={() =>
                                            edit("account_edit", a)
                                          }
                                        >
                                          Modifica fondo
                                        </Button>
                                        <Button
                                          variant="secondary"
                                          className="sc-secondary"
                                          disabled={busy}
                                          onClick={() =>
                                            manageFund(a, "account_remove")
                                          }
                                        >
                                          Elimina fondo
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                                {editable && !a.archived_at && (
                                  <Button
                                    variant="secondary"
                                    className="sc-secondary"
                                    disabled={busy}
                                    onClick={() => edit("reconcile", a)}
                                  >
                                    <CheckCheck size={17} />
                                    Verifica saldo
                                  </Button>
                                )}
                              </article>
                            ))}
                          </div>
                        )}
                        {editable && activeFunds.length > 1 && (
                          <Button
                            variant="secondary"
                            className="sc-secondary finance-transfer"
                            disabled={busy}
                            onClick={() => edit("transfer")}
                          >
                            <ArrowLeftRight size={17} />
                            Trasferisci tra fondi
                          </Button>
                        )}
                        <p className="sc-helper">
                          Disponibilità alla data selezionata. La verifica
                          confronta il saldo senza modificarlo.
                        </p>
                      </section>
                    )}
                    {tab === "entries" && (
                      <section aria-label="Movimenti del periodo">
                        <div className="finance-filters">
                          <label>
                            Fondo
                            <select
                              value={account}
                              onChange={(e) => setAccount(e.target.value)}
                            >
                              <option value="">Tutti i fondi</option>
                              {data.accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Cerca
                            <Input
                              type="search"
                              placeholder="Descrizione, categoria o autore"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                            />
                          </label>
                        </div>
                        <p className="sc-helper">
                          {data.entry_count} registrazioni nel periodo.
                          Originali e storni restano visibili.
                        </p>
                        {entries.map((e) => (
                          <EntryRow
                            key={e.id}
                            entry={e}
                            fund={fundNames.get(e.account_id) || "Fondo"}
                            editable={editable}
                            busy={busy}
                            reverse={() => edit("reverse", undefined, e)}
                            download={downloadReceipt}
                            api={api}
                            run={run}
                            refresh={reload}
                          />
                        ))}
                        {!entries.length && (
                          <div className="sc-empty-state">
                            <Wallet aria-hidden="true" />
                            <h3>Nessun movimento per questi filtri</h3>
                            <p>
                              Prova un periodo diverso o registra un’entrata o
                              un’uscita.
                            </p>
                          </div>
                        )}
                        {!fullEntries &&
                          data.entry_count > data.entries.length && (
                            <Button
                              variant="secondary"
                              className="sc-secondary"
                              disabled={busy}
                              onClick={() => void loadAll()}
                            >
                              Carica tutti i movimenti ({data.entry_count})
                            </Button>
                          )}
                      </section>
                    )}
                    {tab === "report" && (
                      <section className="finance-report">
                        <div className="sc-section-heading">
                          <h3>Rendiconto del periodo</h3>
                        </div>
                        <dl className="finance-report-totals">
                          {[
                            ["Saldo precedente", data.totals.opening],
                            ["Saldi iniziali registrati", data.totals.initial],
                            ["Entrate nette", data.totals.income],
                            ["Uscite nette", data.totals.expense],
                            ["Disponibilità finale", data.totals.closing],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{money(Number(value))}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="sc-helper">
                          I trasferimenti non modificano il totale dei fondi.
                          Gli storni rettificano entrate e uscite nel periodo in
                          cui vengono registrati.
                        </p>
                        <h4>Per categoria</h4>
                        {data.categories.map((c) => (
                          <div
                            className="finance-category"
                            key={c.category + c.economic_type}
                          >
                            <span>
                              {c.category} ·{" "}
                              {c.economic_type === "income"
                                ? "Entrate"
                                : "Uscite"}
                            </span>
                            <b>
                              {money(
                                c.economic_type === "expense"
                                  ? -c.amount_cents
                                  : c.amount_cents,
                              )}
                            </b>
                          </div>
                        ))}
                        {!data.categories.length && (
                          <p className="sc-helper">
                            Nessuna entrata o uscita nel periodo.
                          </p>
                        )}
                        <div className="finance-export">
                          <Button
                            variant="secondary"
                            className="sc-secondary"
                            disabled={busy || loading}
                            onClick={() => void exportReport("pdf")}
                          >
                            <FileDown size={18} />
                            Esporta PDF
                          </Button>
                          <Button
                            variant="secondary"
                            className="sc-secondary"
                            disabled={busy || loading}
                            onClick={() => void exportReport("csv")}
                          >
                            CSV per Excel
                          </Button>
                        </div>
                      </section>
                    )}
                    {tab === "history" && (
                      <section className="finance-history">
                        <h3>Verifiche dei saldi</h3>
                        {data.reconciliations.map((r) => (
                          <article className="finance-history-row" key={r.id}>
                            <strong>
                              {fundNames.get(r.account_id)} ·{" "}
                              {date(r.checked_on)}
                            </strong>
                            <p>
                              Osservato {money(r.observed_cents)} · Registrato{" "}
                              {money(r.ledger_cents)}
                            </p>
                            <p>
                              {r.observed_cents === r.ledger_cents
                                ? "Saldo coincidente"
                                : "Differenza: " +
                                  money(r.observed_cents - r.ledger_cents)}
                              {r.closes_period ? " · Periodo chiuso" : ""}
                            </p>
                            <small>
                              {r.note} · {r.actor_label}
                            </small>
                          </article>
                        ))}
                        {!data.reconciliations.length && (
                          <p className="sc-helper">
                            Nessuna verifica registrata.
                          </p>
                        )}
                        <h3>Cronologia operazioni</h3>
                        {data.audit.map((h) => (
                          <article className="finance-history-row" key={h.id}>
                            <strong>{labels[h.action] || h.action}</strong>
                            <p>
                              {h.actor_label} · {time(h.created_at)}
                            </p>
                            {typeof h.details.description === "string" && (
                              <small>{h.details.description}</small>
                            )}
                          </article>
                        ))}
                        {!data.audit.length && (
                          <p className="sc-helper">
                            Nessuna operazione registrata.
                          </p>
                        )}
                        <p className="sc-helper">
                          Ultime 30 verifiche e 50 operazioni. Tutti i movimenti
                          restano consultabili ed esportabili dal relativo
                          periodo.
                        </p>
                      </section>
                    )}
                  </>
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  );
}

function EntryRow({
  entry: e,
  fund,
  editable,
  busy,
  reverse,
  download,
  api,
  run,
  refresh,
}: {
  entry: Entry;
  fund: string;
  editable: boolean;
  busy: boolean;
  reverse: () => void;
  download: (r: Receipt) => Promise<void>;
  api: ReturnType<typeof financeApi>;
  run: (task: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    token = useRef(crypto.randomUUID()),
    [attached, setAttached] = useState(false);
  const attach = () =>
    run(async () => {
      if (!file) return;
      await api.receipt(e.id, file, token.current);
      if (!api.current()) return;
      setAttached(true);
      setFile(null);
      await refresh();
    });
  return (
    <article className="finance-entry">
      <div className="finance-entry-head">
        <span className="sc-row-icon">
          {e.economic_type === "transfer" ? (
            <ArrowLeftRight />
          ) : e.amount_cents >= 0 ? (
            <ArrowDownLeft />
          ) : (
            <ArrowUpRight />
          )}
        </span>
        <div>
          <strong>{e.description}</strong>
          <p>
            {date(e.entry_date)} · {fund}
          </p>
        </div>
        <b className={e.amount_cents < 0 ? "finance-negative" : ""}>
          {money(e.amount_cents)}
        </b>
      </div>
      <div className="finance-entry-tags">
        <span>{e.category}</span>
        <span>{labels[e.kind] || e.kind}</span>
        {e.reversed && <span>Stornato</span>}
      </div>
      <details>
        <summary>Dettagli e ricevute</summary>
        <p className="sc-helper">
          {e.actor_label} · {time(e.created_at)}
        </p>
        {e.receipts?.map((r) => (
          <Button
            key={r.id}
            variant="secondary"
            className="sc-secondary"
            disabled={busy}
            onClick={() => void download(r)}
          >
            <Paperclip size={16} />
            {r.file_name}
          </Button>
        ))}
        {!e.receipts?.length && (
          <p className="sc-helper">Nessuna ricevuta allegata.</p>
        )}
        {editable && !attached && (
          <div className="finance-attach">
            <label>
              Aggiungi ricevuta · massimo 10 MB
              <input
                type="file"
                disabled={busy}
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  token.current = crypto.randomUUID();
                }}
              />
            </label>
            <Button
              variant="secondary"
              className="sc-secondary"
              disabled={busy || !file}
              onClick={() => void attach()}
            >
              Allega ricevuta
            </Button>
          </div>
        )}
        {attached && (
          <p role="status">Ricevuta salvata. Aggiorna per consultarla.</p>
        )}
        {editable &&
          !e.reversed &&
          !["opening", "reversal"].includes(e.kind) && (
            <Button
              variant="secondary"
              className="sc-secondary"
              disabled={busy}
              onClick={reverse}
            >
              <Undo2 size={16} />
              Storna movimento
            </Button>
          )}
      </details>
    </article>
  );
}
