# Eburum — chiusura degli audit UI/UX e workflow

Revisione del 30 ottobre 2026 dei due audit del 29 ottobre. Base: `1a64873`, branch `codex/ui-workflow-audits`.

Gli interventi riguardano la presentazione e la navigazione React. Palette, Figtree, dati, autorizzazioni, contratti delle API e scritture atomiche restano quelli esistenti. Nessuna migrazione, dipendenza o servizio aggiunto. I salvataggi delle prove usano esclusivamente dati sintetici locali.

## Criteri e scelte

- Il precedente requisito del proprietario prevale sulla proposta di mandare a capo i filtri Messaggi: rimangono su una riga scorrevole, con indicazione dello scorrimento e accesso da tastiera.
- Le disponibilità prima della seduta e le presenze confermate rimangono distinguibili. Solo il filtro Tutti/Assenti diventa più leggero; non viene eliminata una fase di verifica dello staff.
- Il suggerimento di 90 minuti richiede un tocco esplicito. Non si salva un orario di fine inventato.
- La pagina è già `lang="it"`. I campi data nativi dipendono dalla lingua del browser/sistema: viene aggiunta una lettura italiana accanto ai campi, senza sostituire il selettore nativo o promettere di controllarne il formato interno.

## Audit UI/UX: 19 punti

| Punto | Esito | Intervento | Verifica su telefono e computer |
|---|---|---|---|
| UI 1 | Fatto | Collegamento Lavagna secondario normale. Nell'allenamento inline il salvataggio compare quando ci sono modifiche; a riposo una breve didascalia sostituisce il pulsante grigio senza spiegazione. | Allenamenti chiaro/scuro; contatore reversibile, errore e riprova; footer separato dal contenuto. |
| UI 2 | Fatto | Tutti/Assenti usa filtri leggeri, distinti dai selettori principali e di fase. | Selezione, ricerca e filtro su Chromium e WebKit, anche a 320 px. |
| UI 3 | Adattato al requisito del proprietario | Filtri Messaggi su una sola riga, scorrimento orizzontale interno, indicazione testuale e barra di scorrimento discreta. | Una sola coordinata verticale per tutti i filtri, ultimo filtro raggiungibile con tastiera, nessun overflow della pagina. |
| UI 4 | Fatto | Stato «Nessuna gara in programma» e azione «Aggiungi gara» per i ruoli autorizzati. | Calendario vuoto e apertura della creazione partita. |
| UI 5 | Fatto | Testo dei pulsanti di creazione su desktop; icone con nome accessibile su mobile. | Pulsanti Allenamenti, Messaggi, Partite e Rosa; test dei ruoli mantenuti. |
| UI 6 | Fatto | Limite comune di 1120 px; Messaggi usa la larghezza disponibile nello stesso contenitore. | Geometrie delle sei pagine principali a 1280 px e assenza di overflow mobile. |
| UI 7 | Fatto | Indicazione «Dalla più vecchia alla più recente», badge da almeno 28 px. Le date e gli avversari al passaggio erano già presenti. | Forma recente e ordine dei risultati, senza modificare gli incontri salvati. |
| UI 8 | Fatto | Peso maggiore al punteggio vincente; badge esito e campo con dimensioni e forma coerenti. | Risultati in casa, in trasferta e pareggi; valori salvati e ordine casa/ospite invariati. |
| UI 9 | Già corretto, verificato | Home: presenti verdi, assenti neutri, infortunati rossi, con etichette. | Statistiche allineate e leggibili nei due temi. |
| UI 10 | Fatto | Etichette «Infortunati» e «Squalificati»; riferimento temporale mantenuto nel testo comune. | Home mobile e desktop, tre valori leggibili. |
| UI 11 | Fatto | Anteprima vuota compatta «Nessun messaggio · Scrivi». | Apertura del compositore dalla Home; nome accessibile completo dell'azione conservato. |
| UI 12 | Fatto | Ricerca visibile prima dell'elenco; suggerimenti sulle azioni presenza/assenza e stati accessibili già presenti conservati. | Ricerca, azioni centrate, filtri e colonne dei nomi su mobile/desktop. |
| UI 13 | Fatto | Il testo esplicativo di Messaggi è raccolto in «Come funziona». | Apertura e chiusura native del dettaglio, contenuto informativo conservato. |
| UI 14 | Fatto | Nello stato Messaggi vuoto rimane una sola azione di creazione visibile. | Verifica esplicita del numero di pulsanti visibili e del pulsante superiore nascosto. |
| UI 15 | Fatto | Rosa mostra il numero reale di giocatori attivi e il criterio di ordinamento; Partite i conteggi reali di gare e risultati. | Dati derivati dalle collezioni correnti, senza numeri di esempio nella UI del prodotto. |
| UI 16 | Già presente, verificato | L'avatar ha già titolo e nome accessibile «Opzioni account e stagione». | Account, selezione stagione, apertura/chiusura e raggiungibilità con safe area. |
| UI 17 | Già presente, verificato | Guida e Messaggi hanno già suggerimenti al passaggio e nomi accessibili. | Test header, guida, notifiche, tastiera e movimento ridotto. |
| UI 18 | Fatto/verificato | Il footer delle azioni conserva un'area propria. Nei moduli di lavoro mobile la navigazione viene nascosta; nelle liste resta lo spazio per raggiungere l'ultimo contenuto. | Geometria dei pannelli, safe area simulata, ultimo controllo raggiungibile e salvataggi dalle barre separate. |
| UI 19 | Fatto | Indicatore documenti da verificare anche accanto ad Altro nella sidebar. Nome «Altro» e descrizione del conteggio separati per l'accessibilità. | Unica voce attiva, conteggio dalla stessa funzione usata negli strumenti, navigazione ed etichette accessibili. |

## Audit workflow: 15 punti

| Punto | Esito | Intervento | Verifica su telefono e computer |
|---|---|---|---|
| WF 1 | Fatto | Navigazione inferiore nascosta durante i moduli con barra azioni e durante la conferma delle presenze. | Creazione allenamento, partita e modifica; pannello scrollabile sopra il footer, tutti i salvataggi ancora associati al proprio form. |
| WF 2 | Parziale per limite del controllo nativo | Italiano già presente sulla pagina, lettura italiana aggiunta ai campi data di allenamenti e organizzazione gara. La lingua interna del selettore resta una preferenza del browser/sistema. | Date ISO salvate invariate; rendering italiano e controllo nativo mantenuti. Nessuna sostituzione con un componente proprietario. |
| WF 3 | Fatto | Nuova partita: avversario, data/orari, Casa/Trasferta, campo e ritrovo. Nessuna scheda Convocati prima della creazione. Dopo il salvataggio rimane la scheda completa esistente. | Ordine DOM dei campi, assenza delle schede premature, creazione e successive operazioni della gara. |
| WF 4 | Fatto | Azione «Imposta durata di 90 minuti» e durata calcolata; la validazione della fine successiva all'inizio era già presente. | Nessun riempimento automatico iniziale, 18:30 → 20:00 solo dopo il tocco; errori italiani e validazione nativa conservati. |
| WF 5 | Fatto | Un solo «Modifica» per persona raccoglie nome, email, password e ruolo. Eliminazione separata in fondo. | Apertura del gruppo, controlli visibili, protezioni proprietario/utente corrente, conferma, errori e invio singolo già coperti dai test. |
| WF 6 | Fatto | Tipo report, giocatore e periodo prima dei risultati; esportazioni dopo il report. Eliminata l'uscita testuale che ripeteva il nome. Il nome necessario nel selettore rimane. | Report individuale e squadra, periodi, ordinamenti, collegamenti, download PDF e Excel effettivamente letti dai test. |
| WF 7 | Fatto | Cronologia prima della scelta del tipo; unico ingresso «Aggiungi evento». Su desktop le note restano affiancate alla cronologia, su mobile sempre visibili. | Editor evento inline, scelta iniziale, modifica, annullamento, protezione delle bozze e aggiornamento del risultato dai gol. |
| WF 8 | Fatto | Senza fondi, Economia mostra lo stato vuoto e l'azione pertinente; niente totali, periodi o schede anticipati. | Stato vuoto amministratore e apertura fondo; permessi economici esistenti conservati. |
| WF 9 | Fatto | Le schede Economia rimangono su una riga con scorrimento interno. | Tutti i pulsanti sulla stessa riga a 320/390/1280 px, entrambi i temi. |
| WF 10 | Fatto | Gestione utenti occupa il workspace della propria pagina, senza Altro sotto il pannello. | URL diretto, vecchio alias, ricaricamento, Indietro/Avanti, ruolo tesoriere respinto. |
| WF 11 | Fatto | Righe compatte con giocatore, gialli, rossi e soglia; apertura dei dettagli al tocco. Il filtro Espulsioni e il dettaglio del singolo giocatore mantengono i provvedimenti aperti. | Espansione, limiti della riga, accessibilità, filtri e monitoraggio delle squalifiche; nessuna variazione nel conteggio o nel saldo delle giornate. |
| WF 12 | Fatto | I dettagli di accesso e salvataggio della Lavagna sono in una sezione richiudibile. | Unica creazione da stato vuoto; strumenti, disegno, annullamento, salvataggio ed esportazione immagine verificati. |
| WF 13 | Fatto | Legenda attività/giorno selezionato e pulsante «Oggi». | Ritorno al giorno e mese correnti partendo da settembre; calendario sempre a sette colonne. |
| WF 14 | Fatto | Titolo precompilato mantenuto, con segnaposto di esempio e nota che indica che è personalizzabile. | Campo editabile, validazione required e persistenza del titolo scelto. |
| WF 15 | Fatto | Nuovi indirizzi `#/users`, `#/expiries`, `#/discipline`; gli altri strumenti erano già pagine. Vecchi `#/more?tool=…` ancora riconosciuti e sostituiti con il percorso canonico. | Apertura diretta, ricaricamento, cronologia e protezione delle modifiche; i vecchi collegamenti rimangono utilizzabili. |

## Correzioni di integrazione emerse durante la verifica

Il ritorno rapido da un workspace in WebKit ha evidenziato un disallineamento fra stato esterno e URL. Il router ora aggiorna la posizione nello stesso ciclo degli snapshot del runtime. La chiusura dei pannelli durante una navigazione non ripristina una seconda volta il vecchio URL. Una navigazione verso la pagina già attiva non invalida più una lettura di dettaglio in corso. Il parametro della sessione viene rimosso solo all'uscita dalle presenze, senza cancellare i collegamenti in ingresso alle correzioni.

Questi interventi non saltano le conferme per le bozze: sono stati verificati insieme ai passaggi Home/Allenamenti/Registro → presenze nuove o da correggere, alle risposte tardive, ai conflitti di revisione e alla conservazione della bozza dopo un errore.

Il test cronologico dei report ora seleziona un periodo esplicito: i dati sintetici di settembre non dipendono più dal giorno in cui viene eseguita la suite.

## Verifica finale

- `npm run verify`: PASS; formattazione, lint, compilazione e 172 test (39 dominio, 130 interazioni React, 3 build).
- Chromium: 138 test PASS, 2 test di safe area saltati intenzionalmente nei progetti desktop. Matrice 390×844 e 1280×900, chiaro/scuro.
- WebKit: 32 test PASS. Matrice 320×844 e 390×844, chiaro/scuro; strumenti canonici e cronologia, durata allenamento, stati vuoti, eventi, utenti, report, riga Economia, Registro, ricerca, footer con contatore e Lavagna.
- Nessuna violazione nei controlli Axe WCAG A/AA eseguiti sulle pagine principali, sugli editor e sui report; nessun overflow della pagina nei casi verificati.
- Download Excel aperti con ExcelJS e PDF verificati nel contenuto iniziale; prove di errore, doppio invio e cambiamento del periodo mantenute.
- `git diff --check`: PASS. Identità e token della palette di riferimento verificati dalle baseline esistenti, senza rigenerarle.

Comandi eseguiti dalla cartella `eburum`:

```text
npm run verify
node tests/node_modules/@playwright/test/cli.js test --config tests/playwright.config.cjs
node tests/node_modules/@playwright/test/cli.js test --config output/playwright.webkit.config.cjs --grep "audit:|availability keeps|whiteboard tools|searches have"
```

La configurazione locale WebKit usa la suite versionata e i quattro progetti indicati sopra, con risultati in `output/audit-webkit-results/`. Log finali: `output/audit-final-verify.log`, `output/audit-final-chromium.log`, `output/audit-final-webkit.log`.

Le acquisizioni di lavoro sono in `output/audit-views/` e `output/audit-confirm/`; i controlli browser allegano schermate, geometrie e verifiche di accessibilità al report Playwright. Le immagini e i log locali sono artefatti ignorati da Git, non file del prodotto.
