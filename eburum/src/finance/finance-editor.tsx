import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { categories, localToday } from "../finance-api";
import { date } from "./model";
import { useFinance } from "./use-finance";
export function FinanceEditor({
  model,
}: {
  model: ReturnType<typeof useFinance>;
}) {
  const {
    activeFunds,
    busy,
    committed,
    draft,
    field,
    receiptToken,
    runtime,
    save,
    setFile,
    stop,
  } = model;
  if (!draft) return null;
  return (
    <section className="finance-editor" aria-labelledby="financeEditorTitle">
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
        <fieldset disabled={busy || !!committed} className="finance-form-grid">
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
            registrazioni con data precedente o uguale. Le rettifiche successive
            restano possibili con una nuova data.
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
  );
}
