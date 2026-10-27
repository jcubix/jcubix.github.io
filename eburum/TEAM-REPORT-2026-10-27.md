# Report squadra — 27 ottobre 2026

## Uso

Aprire **Altro → Report giocatori e squadra → Squadra**. La vista Giocatore rimane disponibile e mantiene le funzioni esistenti.

La prima colonna contiene il giocatore e resta ferma durante lo scorrimento orizzontale. Le altre colonne mostrano ruolo, allenamenti registrati, presenze, assenze, infortuni, percentuale di presenza, convocazioni, titolarità, subentri, minuti registrati, gol, ammonizioni ed espulsioni. Selezionare l’intestazione per ordinare; selezionarla di nuovo per invertire l’ordine. Un nome apre il report individuale nello stesso periodo.

Periodo: stagione selezionata, ultimi 30/7 giorni, mese corrente, tutto lo storico o intervallo personalizzato. I giocatori disattivati restano inclusi e riconoscibili.

**Esporta CSV** scarica un file UTF-8 con BOM e separatore `;`, compatibile con Excel. È un CSV, non un file `.xlsx`. **Scarica PDF** produce una tabella A4 orizzontale con intestazioni e legenda ripetute su ogni pagina. Gli export seguono il periodo e l’ordinamento visibili.

## Regole dei dati

- Gli allenamenti registrati sono le righe confermate di tipo Allenamento per quel giocatore. Le risposte WhatsApp, le righe da confermare e le riunioni non diventano presenze o assenze.
- La percentuale usa le registrazioni confermate, inclusi gli infortuni nel denominatore. In assenza di registrazioni compare un trattino; il CSV lascia vuoto il valore.
- Le convocazioni comprendono anche quelle programmate nel periodo. Le titolarità richiedono una gara con risultato, minuti o eventi di gioco registrati. Una nota da sola non prova che la gara sia stata giocata.
- I subentri contano le partite con un evento di sostituzione in ingresso; essere convocato in panchina non è un ingresso. Le sostituzioni in uscita non aumentano questo indicatore.
- Minuti e gol sono quelli registrati. I gol avversari senza giocatore non sono attribuiti alla squadra. Ammonizioni ed espulsioni sono separate.
- Esclusi i dati fuori periodo e le attività annullate. Non vengono modificati dati o permessi.

## Implementazione e verifica

Il modello puro è in `app-team-report.js`; vista ed esportazioni sono collegate in `src/team-reports.tsx`. Riutilizzati caricamento dello storico per proprietario (`loadSportPeriod`), controlli di contesto, libreria PDF locale e download già esistenti. Nessuna dipendenza o migrazione nuova. Il CSV neutralizza le formule nei campi testuali.

Verifiche: `npm run verify` con 149 test; suite Chromium con 90 passati e 2 esclusioni previste per notch su desktop; flusso completo del nuovo report su WebKit a 320/390 px nei due temi. Coperti export reali, ordinamento, prima colonna fissa, accessibilità, periodo conservato nel dettaglio, letture storiche fallite e risposte tardive. Una regressione sulle date modificate rapidamente è stata corretta e verificata.

Schermate sintetiche e PDF di prova in `output/` (esclusi da Git). Verifica visiva in chiaro/scuro a 320/390/1280 px e PDF rasterizzato. Non eseguita una prova su iPhone fisico né una lettura dei dati reali della squadra.
