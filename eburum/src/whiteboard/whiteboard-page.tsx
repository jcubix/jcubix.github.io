import { ArrowUpRight, Plus, Presentation, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { LoadingState } from "../components/ui/loading-state";
import { PageHeading } from "../pages";
import "../whiteboard.css";
import { date } from "./model";
import { useWhiteboard } from "./use-whiteboard";
import { WhiteboardEditor } from "./whiteboard-editor";
export function WhiteboardPage(props: Parameters<typeof useWhiteboard>[0]) {
  const model = useWhiteboard(props);
  const {
    allowed,

    board,
    boards,
    busy,
    close,

    create,

    error,

    hasMore,

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
        ) : boards.length ? (
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
            <Button
              variant="ghost"
              disabled={loading || busy}
              onClick={() => void loadList()}
            >
              Aggiorna elenco
            </Button>
          </div>
          {loading && !boards.length ? (
            <LoadingState label="Caricamento lavagne…" />
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
