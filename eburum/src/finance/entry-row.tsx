import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Paperclip,
  Undo2,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { financeApi, money, type Entry, type Receipt } from "../finance-api";
import { date, labels, time } from "./model";
export function EntryRow({
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
