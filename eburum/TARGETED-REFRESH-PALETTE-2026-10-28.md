# Eburum — aggiornamenti mirati e palette, 28 ottobre 2026

Base: `324b9a5`, successiva alla PR #12. Questa consegna chiude i due lavori sul codice rimasti nel rapporto `CODE-REVIEW-IMPLEMENTATION-2026-10-27.md`; non è un nuovo ridisegno o una modifica del database.

## Aggiornamento dei dati

- `app-data.ts` carica gli ambiti tipizzati; `app-part1.js` coordina le letture; `src/runtime.ts` espone `reloadAffected` agli editor.
- Giocatori: rilettura della sola rosa. Tesseramento e scadenze: sola amministrazione, conservando il riepilogo limitato previsto per il presidente.
- Allenamenti e riunioni: attività interessata, risposte e dati tecnici collegati. Presenze: sessione, partecipazioni e attività collegata, compresi collegamenti rimossi o date corrette fuori stagione.
- Gare: risultato, attività, eventi, convocati/minuti e note tecniche. Le espulsioni mantengono lo snapshot disciplinare autorevole; la cancellazione aggiorna anche le conferme delle gare scontate. I normali aggiornamenti del risultato non rileggono i metadati delle date o le conferme disciplinari estranee.
- Le letture dei record sono filtrate per squadra e identificatori; paginazione e batching esistenti sono conservati. Le tre letture della prima data sportiva servono solo dopo inserimenti, eliminazioni o cambi di data.
- Le patch vengono applicate dopo tutte le risposte: un errore non pubblica metà dello snapshot. Le letture mirate sono serializzate; logout, cambio stagione, contesto/ruolo e un nuovo caricamento completo invalidano i risultati precedenti. Un ruolo diverso restituito dal server attiva il caricamento completo, senza applicare la patch precedente.
- Un errore di lettura dopo una scrittura dagli editor propone il recupero dei dati già previsto dall'app: il pulsante Ricarica non ripete l'inserimento. Gli eventi conservano il loro tentativo successivo di sola lettura.
- I report aperti ricalcolano i dati quando cambiano le righe sottostanti. Restano invariati periodo, ordinamento, Excel/PDF, revisioni, request-id, audit e controlli server.

Il caricamento completo rimane per accesso, cambio stagione, recupero e modifiche del contesto utente. Comunicazioni, Economia e lavagna conservano i rispettivi aggiornamenti mirati già presenti. L'attivazione del giocatore continua a usare direttamente la riga autorevole della scrittura.

## Palette

Rimossi 140 alias di compatibilità e sostituiti 298 riferimenti nei cinque fogli applicativi con i token semantici già approvati: superfici, testo, azione primaria, bordi, successo, avviso e pericolo. Ombre basate sul colore semantico del tema; campo tattico con token dedicato. La tavolozza delle annotazioni e i colori nei file esportati rimangono contenuto, non colori dell'interfaccia da adattare al tema.

Non sono state cambiate geometrie, font, radius o baseline. Il CSS iniziale passa da 210,66 a 206,80 KB non compressi; i fogli specialistici restano caricati su richiesta. Il chunk applicativo cresce da 369,16 a 372,41 KB per la riconciliazione selettiva; Excel e PDF restano separati.

## Verifiche

- `npm run verify`: formattazione, lint senza warning, TypeScript, build, 38 test di dominio/qualità, 128 interazioni React e 3 controlli build/PWA: 169 superati.
- Test mirati su tabelle effettivamente interrogate, snapshot atomici, salvataggi concorrenti, cambio stagione, logout, risposta tardiva, ruolo aggiornato, report aperti e mancata ripetizione di un inserimento già riuscito.
- Test statico contro nuovi alias `--swatch-*` e riferimenti ciclici; contratto TypeScript che rifiuta un ambito gara privo di identificatore.
- Chromium: 106 casi superati, due esclusioni previste per il notch desktop. Le baseline di geometria/palette e le verifiche axe restano invariate.
- 64 catture a 390/1280 px, chiaro/scuro: nessuna differenza geometrica superiore a 2 px nei 63 snapshot DOM confrontabili. Il vecchio snapshot del Registro desktop scuro aveva campionato il caricamento; il calendario è verificato dalla suite. Campione visivo esaminato su Home, allenamento, gara, giocatore, Economia e lavagna. Le differenze cromatiche sono la sostituzione intenzionale dei colori storici con quelli canonici.

Evidenze in `output/`, escluse dalla distribuzione. WebKit aggiuntivo: 28 casi superati a 320/390 px nei due temi. La CI GitHub verifica nuovamente il commit della PR prima della pubblicazione.

## Limiti

Nessuna migrazione, modifica di piani, nuova dipendenza o scrittura sui dati reali. Non eseguiti test tra account su un database di staging, prova su iPhone fisico, configurazione del monitoraggio o ripristino di backup: restano le attività operative separate già indicate.
