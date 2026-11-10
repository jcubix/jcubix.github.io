import {
  ArrowUpRight,
  FileUp,
  Plus,
  Presentation,
  Search,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingState } from "../components/ui/loading-state";
import { PageHeading } from "../pages";
import "../whiteboard.css";
import { date } from "./model";
import { useWhiteboard } from "./use-whiteboard";
import { WhiteboardEditor } from "./whiteboard-editor";
export function WhiteboardPage(props: Parameters<typeof useWhiteboard>[0]) {
  const model = useWhiteboard(props);
  const [search, setSearch] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    allowed,

    board,
    boards,
    busy,
    close,

    create,

    error,
    filter,

    hasMore,
    importFile,

    loadList,
    loading,
    notice,
    open,
  } = model;
  if (!allowed)
    return (
      <div className="sc-surface">
        <PageHeading
          title="Lavagna tattica"
          description="Area riservata allo staff tecnico."
        />
        <p role="status">
          Accesso previsto per amministratore, allenatore e collaboratore
          tecnico.
        </p>
      </div>
    );
  return (
    <div className="sc-surface wb-page">
      <PageHeading
        title="Lavagna tattica"
        description="Metti a fuoco l’azione. Spiega cosa migliorare."
      >
        {board ? (
          <Button disabled={busy} aria-label="Chiudi lavagna" onClick={close}>
            <X />
            <span className="page-add-label">Chiudi</span>
          </Button>
        ) : boards.length || filter ? (
          <Button
            onClick={() => create()}
            disabled={busy}
            aria-label="Nuova lavagna"
          >
            <Plus />
            <span className="page-add-label">Nuova lavagna</span>
          </Button>
        ) : null}
      </PageHeading>
      <div className="wb-feedback" aria-live="polite">
        {error ? <p role="alert">{error}</p> : <p role="status">{notice}</p>}
      </div>
      {board ? <WhiteboardEditor model={model} /> : null}
      {!board ? (
        <section className="wb-library" aria-labelledby="boardLibrary">
          <div className="sc-section-heading">
            <h3 id="boardLibrary">Lavagne dello staff</h3>
            <div className="wb-library-actions">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <FileUp /> Importa file
              </Button>
              <Button
                variant="ghost"
                disabled={loading || busy}
                onClick={() => void loadList()}
              >
                Aggiorna elenco
              </Button>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) importFile(file);
            }}
          />
          {boards.length || filter ? (
            <form
              className="wb-library-search"
              role="search"
              aria-label="Cerca nelle lavagne"
              onSubmit={(event) => {
                event.preventDefault();
                void loadList(0, search.trim());
              }}
            >
              <Input
                type="search"
                aria-label="Titolo della lavagna"
                placeholder="Cerca per titolo"
                value={search}
                maxLength={120}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (!e.target.value && filter) void loadList(0, "");
                }}
              />
              <Button
                type="submit"
                variant="secondary"
                size="icon"
                aria-label="Cerca lavagne"
                disabled={busy || loading}
              >
                <Search />
              </Button>
            </form>
          ) : null}
          {loading && (!boards.length || filter) ? (
            <LoadingState label="Caricamento lavagne…" />
          ) : filter && !boards.length ? (
            <p role="status">Nessuna lavagna corrisponde al titolo cercato.</p>
          ) : !boards.length ? (
            <div className="sc-empty-state">
              <Presentation />
              <h3>La prossima spiegazione parte da qui</h3>
              <p>
                Crea una lavagna, disegna sul campo o carica una foto
                dell’azione.
              </p>
              <Button onClick={() => create()}>Nuova lavagna</Button>
            </div>
          ) : (
            <div className="sc-directory">
              {boards.map((b) => (
                <button
                  className="sc-list-row"
                  key={b.id}
                  disabled={busy}
                  onClick={() => open(b.id)}
                >
                  <Presentation size={22} />
                  <span className="sc-row-copy">
                    <strong>{b.title}</strong>
                    <small>
                      Aggiornata il {date(b.updated_at)}
                      {b.activity_id
                        ? " · Collegata a un’attività"
                        : " · Lavagna libera"}
                    </small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          )}
          {hasMore ? (
            <Button
              variant="secondary"
              disabled={loading || busy}
              onClick={() => void loadList(boards.length)}
            >
              Carica altre lavagne
            </Button>
          ) : null}
          <details className="sc-helper whiteboard-help">
            <summary>Accesso e salvataggio</summary>
            <p>
              Visibili solo ad amministratore, allenatore e collaboratore
              tecnico. Il salvataggio richiede una connessione. Le modifiche di
              un collega compaiono riaprendo la lavagna.
            </p>
          </details>
        </section>
      ) : null}
    </div>
  );
}
