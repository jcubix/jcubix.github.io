import {
  ArrowUpRight,
  FileDown,
  MessageSquare,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingState } from "../components/ui/loading-state";
import { money } from "../finance-api";
import { PageHeading } from "../pages";
import { EntryRow } from "./entry-row";
import { FinanceEditor } from "./finance-editor";
import { FinanceFunds } from "./finance-funds";
import { date, labels, time } from "./model";
import { useFinance } from "./use-finance";
export function FinancePage(props: Parameters<typeof useFinance>[0]) {
  const model = useFinance(props);
  const {
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

    from,
    fullEntries,
    fundNames,
    home,
    loadAll,
    loading,

    notice,
    pending,
    query,

    reload,

    run,
    runtime,

    setAccount,

    setQuery,
    setTab,

    tab,
    to,
  } = model;
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
  if (!home && !draft && data && !data.accounts.length)
    return (
      <div className="sc-surface sc-finance finance-empty-page">
        <PageHeading
          title="Economia"
          description="Crea il primo fondo per iniziare a registrare entrate e uscite."
        />
        {error || notice ? (
          <p role="status" className="finance-feedback">
            {error || notice}
          </p>
        ) : null}
        {error ? (
          <Button
            variant="secondary"
            disabled={busy || loading}
            onClick={() => void reload()}
          >
            Riprova caricamento
          </Button>
        ) : null}
        <FinanceFunds model={model} />
      </div>
    );
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
        <FinanceEditor model={model} />
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
                    {tab === "funds" && <FinanceFunds model={model} />}
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
