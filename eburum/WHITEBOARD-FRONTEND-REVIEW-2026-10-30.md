# Lavagna e frontend — verifica dell’analisi del 30 ottobre 2026

Base: `cc3eafd` (PR #17). Ambito confermato: correzioni frontend ancora valide; formato e salvataggio delle foto mantenuti. Nessuna migrazione, dipendenza o variazione dei permessi.

## Esito dei rilievi

| Punto | Esito | Intervento o motivazione |
|---|---|---|
| W1 — serializzazione durante il disegno | Corretto | Il confronto conserva la foto come stringa separata e serializza soltanto titolo, collegamento e annotazioni. Il risultato è memoizzato: le anteprime del puntatore non lo ricalcolano. Il commit confronta soltanto il nuovo contenuto con quello già calcolato, senza la doppia serializzazione dell’intero documento. |
| W2 — foto nel JSONB | Mantenuto e documentato | Decisione confermata dal proprietario. Una sola operazione continua a salvare foto e annotazioni con revisione e controllo della concorrenza. Le lavagne esistenti continuano a riaprirsi senza migrazione. Limiti attuali e percorso futuro descritti sotto. |
| W3 — font del PNG | Corretto | Il titolo esportato usa Figtree. L’esportazione attende il font e usa la famiglia di riserva del sistema se il caricamento fallisce, senza bloccare il download. |
| W4 — numerose proprietà dell’hook | Rinviato, nessun difetto funzionale dimostrato | L’hook è già isolato e alimenta pagina/editor della stessa lavagna. Raggruppare le proprietà non ridurrebbe da solo i render; introdurre un contesto aggiungerebbe un livello senza un secondo caso d’uso. La correzione prestazionale necessaria è W1. Riconsiderare l’API quando altri componenti debbano consumare lo stato in modo indipendente. |
| W5 — alternativa testuale SVG | Corretto preservando l’interazione | Ogni elemento SVG ha un nome accessibile coerente con il pulsante nell’elenco. Il campo richiama anche le istruzioni da tastiera. L’SVG rimane interattivo e raggiungibile: nasconderlo interamente con `aria-hidden` sarebbe incoerente con focus, frecce e Canc. |
| W6 — larghezza desktop | Verificato, disposizione conservata | Il campo attuale occupa già tutta la larghezza disponibile dell’editor, entro il limite comune di 1120 px. La libreria è mostrata separatamente dall’editor. Una colonna laterale aggiunta ora ridurrebbe il campo e cambierebbe l’impianto appena approvato; non viene introdotta come correzione di un problema non riprodotto. |
| F1 — layer CSS | Confermato solo per il foglio attivo, corretto | `app.css` era già importato con `layer(legacy)`. I tre file `soft-club-reference.css`, `soft-club.css`, `dark-theme.css` citati non sono presenti/importati nel checkout attivo. Il caso reale era `communications.css`, importato direttamente da React: ora entra nel layer `components` attraverso `styles.css`. Un test sul CSS compilato intercetta future regole selettore esterne ai layer. |

## Scelta attuale per le foto

Il documento continua a contenere il JPEG ridimensionato. Il caricamento ammette JPG/PNG/WebP fino a 10 MB e 40 megapixel, riduce il lato maggiore a 1400 px e produce JPEG con qualità 0,82. Il data URL finale non può superare 1.400.000 caratteri. La libreria carica soltanto i metadati delle lavagne: la foto viene letta aprendo il singolo documento.

Il vantaggio attuale è l’atomicità di un solo salvataggio con la stessa revisione e le stesse autorizzazioni. Rimane il costo di trasferimento e di spazio della foto codificata: W1 elimina il costo dal percorso di disegno, non cambia il formato conservato.

Una futura migrazione a Storage richiederà insieme bucket privato, policy per squadra/lavagna, gestione dei riferimenti nel documento, lettura dei vecchi documenti, eliminazione dei file orfani e coordinamento di errori/riprova tra caricamento e salvataggio. Va trattata come intervento backend dedicato quando numero o peso delle foto lo giustifichino; non come semplice sostituzione del data URL con un URL pubblico.

## Verifiche

- Prova React con foto sintetica da circa 1 MB: zero serializzazioni dello sfondo durante più movimenti del puntatore, commit, annullamento del tratto, cambio sfondo e ritorno alla foto. Lo stato torna pulito quando il contenuto torna uguale al salvato; nessuna scrittura al server durante la prova.
- Prova browser con foto realmente caricata e convertita: descrizioni degli elementi, selezione dall’elenco, focus sul campo, frecce, Canc, annulla, PNG scaricato e firma del file verificata. Richiesta esplicita di Figtree e download riuscito anche simulando il fallimento di caricamento del font.
- Conservati i test di errore e riprova, revisione concorrente, guard di navigazione e mancato download dopo un cambio di ruolo/sessione.
- Il test di build analizza tutti i fogli CSS pubblicati: nessuna regola selettore senza un layer; i passi dei keyframe sono esclusi perché non sono regole della cascata sui componenti.
- Confronto visivo prima/dopo su telefono chiaro e desktop scuro: layout e identità della lavagna conservati. I controlli automatici coprono entrambi i temi.

Risultati sulla stessa versione del codice:

- `npm run verify`: PASS, con formattazione, lint, build e 174 test (39 dominio, 131 interazioni React, 4 build).
- Chromium: 142 PASS, 2 esclusioni intenzionali per il notch nei progetti desktop; telefono e desktop, tema chiaro/scuro. Baseline esistenti conservate.
- WebKit: 24 PASS a 320 e 390 px, chiaro/scuro, su lavagna, foto, tastiera, esportazione, cambio ruolo, comunicazioni e riunioni.
- Nessuna violazione nei controlli Axe eseguiti; nessun overflow della pagina nei casi verificati.
- `git diff --check`: PASS.

Log locali: `output/whiteboard-verify.log`, `output/whiteboard-chromium.log`, `output/whiteboard-webkit.log`.

Acquisizioni: `output/whiteboard-review/`. Il grafo Graphify esistente conserva riferimenti anteriori allo split della lavagna; la verifica è stata svolta sul codice attuale e sul bundle compilato, senza assumere attuali quei vecchi percorsi.
