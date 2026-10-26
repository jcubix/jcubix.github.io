# Eburum — migrazione del frontend a React

Il frontend usa componenti React per tutte le pagine, schede e finestre. Sono rimossi `FeatureSurface`, montaggio di HTML generato, binder imperativi, estensioni HTML e icone costruite come stringhe. Non servono nuove dipendenze o migrazioni del database.

## Dove lavorare

| Funzione | Componenti |
| --- | --- |
| Applicazione, accesso, navigazione, impostazioni | `src/app.tsx`, `src/main.tsx` |
| Home | `src/dashboard.tsx` |
| Rosa, elenchi partite, strumenti | `src/pages.tsx` |
| Schede giocatore, documenti, utenti | `src/people-editors.tsx` |
| Allenamenti, risposte WhatsApp, presenze e revisione | `src/training-editors.tsx` |
| Gara, convocati, impostazioni, eventi, consultazione | `src/match-editors.tsx` |
| Registro, report, tabellino e dettagli | `src/report-pages.tsx` |
| Cartellini, provvedimenti e gare scontate | `src/discipline-editors.tsx` |
| Storico delle modifiche e priorità | `src/history-editor.tsx` |
| Messaggi e inviti alle riunioni | `src/communications.tsx` |
| Economia | `src/finance.tsx` |
| Lavagna tattica | `src/whiteboard.tsx` |

`src/operational-surfaces.tsx` monta gli editor dichiarativi. `src/ui-service.ts` conserva la pila delle schede e le richieste di chiusura. `src/operational-ui.tsx` condivide campi, feedback, copia testo, blocco dei doppi invii e protezione delle bozze. I dialoghi usano il componente Radix condiviso, inclusi focus, tastiera e viewport mobile.

I moduli `app-*.js` conservano calcoli, caricamento dati, ruoli, esportazioni e chiamate ai servizi. Le piccole funzioni di apertura inoltrano una richiesta al frontend React: non generano più markup. Le nuove interfacce si implementano in `src/*.tsx`; i file JavaScript non sono una seconda UI da mantenere.

## Comportamenti conservati e verifiche di regressione

- Risposte WhatsApp separate dalle presenze effettive; invio dell’intera rosa anche con filtri attivi.
- Bozze conservate dopo errori, conferma prima di scartarle, blocco durante i salvataggi.
- Revisione completa delle presenze; conflitti `PT409`/`40001` richiedono riapertura dal Registro.
- Risultato aggiornato dai gol, attribuzione avversaria esplicita, revisione e cancellazione degli eventi.
- Anteprima delle sostituzioni e minuti automatici in sola lettura.
- Ricaricamento dei dati dopo una scrittura riuscita senza ripetere inserimento o cancellazione.
- Permessi distinti per amministratore, dirigente, allenatore, collaboratore tecnico, segretario, presidente e tesoriere.
- Contesto di utente, squadra e ruolo ricontrollato dopo conferme e risposte asincrone.
- Squalifiche a giornate o fino a una data; conferma e annullamento delle gare scontate.
- Storico completo nei report, ordine cronologico, testo del tabellino e PDF multipagina.
- Collegamenti diretti, pulsante Indietro e contesto del Registro.
- Temi, radius, campi, spaziature e navigazione esistenti; barra Salva gara separata dal dock mobile e dalla navigazione desktop.

## Test

`npm run verify` controlla formattazione, TypeScript, build, dominio, interazioni React e PWA. `npm --prefix tests run browser` verifica Chromium mobile/desktop nei temi chiaro e scuro, accessibilità e geometria. La verifica aggiuntiva WebKit usa viewport da 320 e 390 px nei due temi.

I vecchi test che cliccavano handler del renderer HTML sono stati sostituiti da interazioni sui componenti React reali. La copertura è ripartita così:

| Vecchia verifica | Copertura attuale |
| --- | --- |
| Workflow e separazione allenamenti/presenze | `tests/frontend-interactions.cjs`, `tests/domain-workflows.cjs` |
| Ruoli e segreteria | Matrice dei ruoli React; `tests/staff-access.cjs` conserva i test del servizio utenti |
| Comunicazioni e aggiornamenti | Interazioni React, test realtime su moduli di produzione, test browser |
| Disciplina e gare scontate | Modello delle soglie e correzioni; invio, retry e annullamento negli editor React |
| PDF e tabellino | `tests/match-report.cjs`, `tests/domain-workflows.cjs`, esportazioni e focus nella suite React |
| Sicurezza del runtime | `tests/runtime-safety.cjs`, test React su logout e contesto obsoleto |
| Confine React | `tests/react-boundary.cjs` impedisce il ritorno dei vecchi renderer e binder |

Risultati locali: `npm run verify` superato (24 test di dominio e confine React, 118 interazioni React, 3 controlli PWA/build). Verificati i 70 casi browser precedenti e i 4 casi aggiuntivi WebKit per gli editor. Un worker Chromium Windows è terminato durante la prova del notch; lo stesso caso è passato alla ripetizione isolata. Il ritorno al Registro ha anche una verifica browser dedicata.

I test usano dati sintetici. Non sono state eseguite scritture di prova sui dati reali né modifiche a piani, autorizzazioni o database. La verifica WebKit non sostituisce una prova su un iPhone fisico.
