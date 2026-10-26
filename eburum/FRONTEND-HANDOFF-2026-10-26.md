# Handoff frontend — 26 ottobre 2026

Archivio analizzato: `eburum-handoff-completo.zip`, 19 file. Confronto con il codice pubblicato dopo il merge `e02c091`. Estratto in `output/handoff-20261026/`, senza sovrascrivere gli handoff precedenti o il lavoro locale in corso.

## Risultato del confronto

Rispetto al pacchetto precedente, sono nuovi il documento `VISUAL-UPLIFT-PUNCHLIST.md` e il suo riferimento nell’indice. Gli altri 17 file sono identici byte per byte. Le vecchie patch si riferiscono a `498863d`: non sono state riapplicate.

Login in italiano, input numerici, spazio per la navbar, chevron, badge, temi, salvataggi flottanti, caricamento PDF su richiesta, animazioni e CI erano già integrati. Le successive correzioni per Messaggi, note gara, barra di salvataggio allenamenti e lavagna mobile restano valide.

## Revisione visiva applicata

| Punto | Intervento |
| --- | --- |
| 1A — Superfici | Ombra chiara leggermente più definita e bordo sottile condiviso; bordo discreto anche in dark. Sfondo, superfici e raggi approvati conservati. |
| 2 — KPI Home | Presenze dell’ultimo allenamento e segnalazioni rosa in gruppi di tre valori tabellari, con etichette e colori semantici. Assenti neutri, infortuni rossi, squalifiche oro. I dati mancanti restano `—`. |
| 3 — Oro | Messaggi da confermare con filetto oro da 3 px; mantenuto il bordo delle gare odierne. Non aggiunte progressioni senza un totale reale o colori decorativi alle CTA. |
| 4 — Secondari | Fondo e bordo leggibili per azioni legacy e variante React secondaria; hover solo per mouse. Primari, focus e controlli trasparenti dedicati conservano il loro ruolo. |
| 5 — Tabellino | Anteprima strutturata con squadre, risultato, titolari ed eventi. Due colonne su desktop. Il testo copiato e il PDF usano la stessa stringa precedente; se gli appunti falliscono compare il testo selezionato per la copia manuale. Escape dei contenuti e protezioni di sessione preservati. |
| 6 — Eventi | Cronologia con binario, minuto tabellare e indicatore per tipo; gol avversari rossi. Modifica con icona, nome accessibile e target da 44 px. Su desktop le note sempre visibili affiancano gli eventi. Nessuna modifica al calcolo del risultato. |
| 7 — Persone e stati vuoti | Riutilizzate le iniziali esistenti, con sfondi coerenti per ruolo nella Rosa. Marchio, avatar dei messaggi e azioni degli stati vuoti già presenti; nessuna foto inventata o nuova dipendenza. |
| 8 — Desktop | Spaziatura regolare fra i blocchi Home; tabellino e gara sfruttano due colonne. Messaggi mostra conteggi reali di avvisi, letture personali da confermare e inviti, con accesso al filtro. Corretta la guida che citava il vecchio menu aggiornamenti. |
| 9 — Rifiniture | Filtri mantenuti su una riga orizzontale scorrevole, come richiesto successivamente dall’utente. Email lunghe con ellissi e valore completo nel DOM/title. Spazio inferiore per il dock conservato. |

Le proposte opzionali 1B (cambio sfondo), oro sulle CTA e contatori animati non sono necessarie per questi interventi e non sono state introdotte.

## Ambito escluso

Nessuna migrazione DB, modifica ai permessi o impostazione a pagamento. La migrazione generale degli editor legacy e le guardie asincrone già in lavorazione restano separate: non vengono pubblicate per effetto di questa revisione visiva.

## Verifiche

- `npm run verify`: build, formattazione, 54 test dominio/runtime, 111 interazioni frontend e 3 test build/PWA.
- Suite Chromium completa: 66 passati, 2 test notch non applicabili al desktop. Sei pagine in due temi e due formati, con baseline geometriche e axe.
- Percorso aggiornato verificato anche su WebKit: 4 test passati, 320/390 px e tema chiaro/scuro. Verifica finale Chromium del percorso: 4 passati, compreso affiancamento delle note su desktop.
- Nuovo test del tabellino: testo copiato identico, fallback manuale, contenuti HTML non eseguibili, gol avversario al minuto zero e formazione di undici nomi.
- Nuovo percorso browser: KPI, filtro letture, apertura/modifica evento, tabellino strutturato, axe del dialogo ed email lunga senza overflow.
- Ispezione visiva a 320, 390 e 1280 px, chiaro/scuro; nessuna modifica delle baseline necessaria. Evidenze in `output/uplift-*`, ignorate da Git.

I test usano dati sintetici e bloccano richieste esterne. Non sono un collaudo su iPhone fisico o di salvataggi in un ambiente Supabase di staging.
