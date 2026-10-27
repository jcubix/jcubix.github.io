# Report squadra — 27 ottobre 2026

## Uso

Aprire **Altro → Report giocatori e squadra → Squadra**. La vista Giocatore rimane disponibile e mantiene le funzioni esistenti.

La prima colonna contiene il giocatore e resta ferma durante lo scorrimento orizzontale. Le altre colonne mostrano ruolo, allenamenti registrati, presenze, assenze, infortuni, percentuale di presenza, convocazioni, titolarità, subentri, minuti registrati, gol, ammonizioni ed espulsioni. Selezionare l’intestazione per ordinare; selezionarla di nuovo per invertire l’ordine. Un nome apre il report individuale nello stesso periodo.

Periodo: stagione selezionata, ultimi 30/7 giorni, mese corrente, tutto lo storico o intervallo personalizzato. I giocatori disattivati restano inclusi e riconoscibili.

**Esporta Excel** scarica un vero file `.xlsx`, con intestazioni blu, righe alternate, filtri sulle colonne, intestazioni e colonna del giocatore bloccate. Numeri e percentuali sono valori numerici utilizzabili per ordinamenti e calcoli; i nomi lunghi vanno a capo. Il foglio riporta periodo e numero di giocatori. **Scarica PDF** produce una tabella A4 orizzontale con intestazioni e legenda ripetute su ogni pagina. Gli export seguono il periodo e l’ordinamento visibili.

## Regole dei dati

- Gli allenamenti registrati sono le righe confermate di tipo Allenamento per quel giocatore. Le risposte WhatsApp, le righe da confermare e le riunioni non diventano presenze o assenze.
- La percentuale usa le registrazioni confermate, inclusi gli infortuni nel denominatore. In assenza di registrazioni compare un trattino; Excel lascia vuota la cella, distinguendola dallo 0%.
- Le convocazioni comprendono anche quelle programmate nel periodo. Le titolarità richiedono una gara con risultato, minuti o eventi di gioco registrati. Una nota da sola non prova che la gara sia stata giocata.
- I subentri contano le partite con un evento di sostituzione in ingresso; essere convocato in panchina non è un ingresso. Le sostituzioni in uscita non aumentano questo indicatore.
- Minuti e gol sono quelli registrati. I gol avversari senza giocatore non sono attribuiti alla squadra. Ammonizioni ed espulsioni sono separate.
- Esclusi i dati fuori periodo e le attività annullate. Non vengono modificati dati o permessi.

## Implementazione e verifica

Il modello è in `app-team-report.js`; vista ed esportazioni sono collegate in `src/team-reports.tsx`. Riutilizzati caricamento dello storico per proprietario (`loadSportPeriod`), controlli di contesto, libreria PDF locale e download già esistenti. Nessuna migrazione. Il precedente export CSV della squadra è stato sostituito; i CSV di Economia restano invariati.

ExcelJS 4.4.0 viene caricato solo all'esportazione, in un modulo separato incluso nella cache PWA. L'override mirato `exceljs → uuid 11.1.1` evita la versione vulnerabile richiesta dalla dipendenza; il percorso utilizzato da ExcelJS è l'API compatibile `v4`. L'audit npm non segnala vulnerabilità. I nomi e i ruoli sono celle testuali, anche se iniziano con `=`, `+`, `-` o `@`; non vengono generati formule, collegamenti esterni o macro.

Durante la generazione entrambi i pulsanti sono disabilitati contro i doppi clic. Un cambio di periodo, squadra o sessione, oppure l'uscita dalla pagina, impedisce il download del risultato precedente. Gli errori sono visibili e consentono un nuovo tentativo.

Verifiche Excel: riapertura del file e confronto di tutte le celle con il modello, tipi numerici e testi non interpretati come formule, filtri e blocco riquadri; download reale nei browser con periodo e ordine scelti; cambio periodo durante il caricamento del modulo senza scaricare dati obsoleti. Controllo indipendente con openpyxl e apertura in Microsoft Excel 16.0 in sola lettura, con verifica di percentuali, filtri e blocco riquadri.

`npm run verify`: 157 test superati. Suite Chromium: 98 superati e 2 esclusioni previste per il notch su desktop. Export e cambio periodo su WebKit a 320/390 px, nei due temi: 8 superati. Verificato anche il download con le restrizioni di produzione `script-src 'self'; worker-src 'self'`, senza introdurre `unsafe-eval` o worker da URL blob.

Schermate sintetiche, Excel e PDF di prova in `output/` (esclusi da Git). Nessuna scrittura sui dati reali della squadra. Non eseguita una prova su iPhone fisico.
