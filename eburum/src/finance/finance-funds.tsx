import { ArrowLeftRight, CheckCheck, Landmark, Wallet } from "lucide-react";
import { Button } from "../components/ui/button";
import { money } from "../finance-api";
import { date } from "./model";
import { useFinance } from "./use-finance";
export function FinanceFunds({
  model,
}: {
  model: ReturnType<typeof useFinance>;
}) {
  const { activeFunds, busy, data, edit, editable, loading, manageFund } =
    model;
  if (!data) return null;
  return (
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
            <Button onClick={() => edit("account")}>Aggiungi fondo</Button>
          ) : null}
        </div>
      ) : (
        <div className="finance-fund-list">
          {data.accounts.map((a) => (
            <article key={a.id} className="finance-fund">
              <div className="finance-fund-main">
                <span className="sc-row-icon">
                  {a.kind === "cash" ? <Wallet /> : <Landmark />}
                </span>
                <div>
                  <h4>{a.name}</h4>
                  <p>
                    {a.kind === "cash" ? "Cassa" : "Conto corrente"} · Dal{" "}
                    {date(a.opened_on)}
                  </p>
                </div>
                <strong
                  className={a.balance_cents < 0 ? "finance-negative" : ""}
                >
                  {money(a.balance_cents)}
                </strong>
              </div>
              {a.balance_cents < 0 && (
                <p className="sc-helper">
                  Saldo negativo: verifica disponibilità e registrazioni.
                </p>
              )}
              <p className="sc-helper">
                {a.closed_through
                  ? "Chiuso fino al " + date(a.closed_through)
                  : "Nessun periodo chiuso"}
              </p>
              {a.archived_at && (
                <p className="sc-helper">Archiviato · Storico conservato</p>
              )}
              {editable && (
                <div className="finance-fund-actions">
                  {a.archived_at ? (
                    <Button
                      variant="secondary"
                      className="sc-secondary"
                      disabled={busy}
                      onClick={() => manageFund(a, "account_restore")}
                    >
                      Riattiva fondo
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        className="sc-secondary"
                        disabled={busy}
                        onClick={() => edit("account_edit", a)}
                      >
                        Modifica fondo
                      </Button>
                      <Button
                        variant="secondary"
                        className="sc-secondary"
                        disabled={busy}
                        onClick={() => manageFund(a, "account_remove")}
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
        Disponibilità alla data selezionata. La verifica confronta il saldo
        senza modificarlo.
      </p>
    </section>
  );
}
